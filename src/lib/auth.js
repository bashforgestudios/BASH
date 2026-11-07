// Server-only auth: users in MongoDB, scrypt password hashes, JWT sessions.
//
// Session model
//   access token   JWT, 15 min, httpOnly cookie `bash_at` (or "Authorization: Bearer" for API clients)
//   refresh token  JWT, 7 days, httpOnly cookie `bash_rt` scoped to /api/auth, jti stored in `refresh_tokens`
//   rotation       every refresh issues a new refresh token and revokes the old one. Replaying an
//                  already-used refresh token revokes the whole token family (stolen-token defence).
//   token_version  stored on the user. Role changes, password changes and "log out everywhere" bump it,
//                  which kills every access token issued before.
import crypto from "crypto";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { newBashId } from "@/lib/bashId";
import { col, NO_ID, isDup } from "@/lib/db";
import {
    ACCESS_COOKIE,
    ACCESS_TTL_S,
    REFRESH_COOKIE,
    REFRESH_TTL_S,
    SESSION_FLAG,
    signAccessToken,
    signRefreshToken,
    verifyJwt,
} from "@/lib/jwt";

const scrypt = promisify(crypto.scrypt);

export const MIN_PASSWORD = 8;

/* ---------- passwords ---------- */
export async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)).toString("hex");
    return `${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
    const [salt, hash] = String(stored).split(":");
    if (!salt || !hash) return false;
    const attempt = await scrypt(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return attempt.length === expected.length && crypto.timingSafeEqual(attempt, expected);
}

// Checked when the email is unknown, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;
export const burnPasswordCheck = (password) => verifyPassword(password, DUMMY_HASH);

/* ---------- users ---------- */
export const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || "user",
    club_id: u.club_id || null,
});

export async function findUserByEmail(email) {
    const users = await col("users");
    return users.findOne({ email: String(email).trim().toLowerCase() }, NO_ID);
}

export async function findUserById(id) {
    const users = await col("users");
    return users.findOne({ id: String(id) }, NO_ID);
}

/** Returns the new user, or null when the email is already registered. */
export async function createUser({ name, email, password, role = "user", club_id = null, phone = null, city = null, dob = null }) {
    const users = await col("users");
    const doc = {
        id: crypto.randomBytes(12).toString("hex"),
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        password_hash: await hashPassword(password),
        role,
        club_id,
        bash_id: newBashId(),
        phone,
        city,
        dob, // "YYYY-MM-DD"
        instagram: null,
        photo_top: null,
        photo_side: null,
        token_version: 0,
        created_at: new Date(),
    };
    try {
        await users.insertOne(doc);
    } catch (e) {
        if (isDup(e)) return null; // email already registered
        throw e;
    }
    const { _id, ...rest } = doc;
    return rest;
}

/** Invalidates every access token issued so far for this user (role change, password change, logout everywhere). */
export async function bumpTokenVersion(userId) {
    const users = await col("users");
    await users.updateOne({ id: userId }, { $inc: { token_version: 1 } });
}

/* ---------- sessions ---------- */
export async function startSession(user, { family } = {}) {
    const tokens = await col("refresh_tokens");
    const jti = crypto.randomBytes(16).toString("hex");
    const fam = family || crypto.randomBytes(12).toString("hex");
    await tokens.insertOne({
        jti,
        family: fam,
        user_id: user.id,
        created_at: new Date(),
        expires_at: new Date(Date.now() + REFRESH_TTL_S * 1000),
        revoked_at: null,
        replaced_by: null,
    });
    return {
        access: await signAccessToken(user),
        refresh: await signRefreshToken({ userId: user.id, jti, family: fam }),
        jti,
    };
}

/**
 * Exchanges a refresh token for a new pair. Returns { user, access, refresh } or { error }.
 * error.reuse = true means a revoked token was replayed and the whole family was revoked.
 */
export async function rotateSession(refreshToken) {
    const payload = await verifyJwt(refreshToken, "refresh");
    if (!payload) return { error: "Session expired. Sign in again." };

    const tokens = await col("refresh_tokens");
    const rec = await tokens.findOne({ jti: payload.jti }, NO_ID);
    if (!rec) return { error: "Session expired. Sign in again." };

    if (rec.revoked_at) {
        // Two tabs refreshing at once is normal: give a 10 second grace before treating it as theft.
        const justRotated = rec.replaced_by && Date.now() - new Date(rec.revoked_at).getTime() < 10_000;
        if (justRotated) return { error: "Session was just refreshed. Retry." };
        await tokens.updateMany({ family: rec.family, revoked_at: null }, { $set: { revoked_at: new Date() } });
        return { error: "Session expired. Sign in again.", reuse: true };
    }

    const user = await findUserById(rec.user_id);
    if (!user) return { error: "Session expired. Sign in again." };

    const next = await startSession(user, { family: rec.family });
    const claimed = await tokens.updateOne(
        { jti: rec.jti, revoked_at: null },
        { $set: { revoked_at: new Date(), replaced_by: next.jti } },
    );
    if (!claimed.modifiedCount) {
        // lost a race with another request using the same token
        await tokens.deleteOne({ jti: next.jti });
        return { error: "Session was just refreshed. Retry." };
    }
    return { user, access: next.access, refresh: next.refresh };
}

/** Logout: revoke this device's refresh-token family. `everywhere` revokes all devices and kills access tokens. */
export async function endSession(refreshToken, { everywhere = false, userId = null } = {}) {
    const tokens = await col("refresh_tokens");
    const payload = await verifyJwt(refreshToken, "refresh");
    const uid = userId || payload?.sub;
    if (everywhere && uid) {
        await tokens.updateMany({ user_id: uid, revoked_at: null }, { $set: { revoked_at: new Date() } });
        await bumpTokenVersion(uid);
    } else if (payload?.fam) {
        await tokens.updateMany({ family: payload.fam, revoked_at: null }, { $set: { revoked_at: new Date() } });
    }
}

/** Revokes every refresh token of a user (used after password change). */
export async function revokeAllSessions(userId) {
    const tokens = await col("refresh_tokens");
    await tokens.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: new Date() } });
    await bumpTokenVersion(userId);
}

/* ---------- cookies ---------- */
const secure = () => process.env.NODE_ENV === "production";

export function setAuthCookies(res, { access, refresh }) {
    const base = { httpOnly: true, sameSite: "lax", secure: secure(), path: "/" };
    res.cookies.set(ACCESS_COOKIE, access, { ...base, maxAge: ACCESS_TTL_S });
    res.cookies.set(REFRESH_COOKIE, refresh, { ...base, path: "/api/auth", maxAge: REFRESH_TTL_S });
    res.cookies.set(SESSION_FLAG, "1", { ...base, httpOnly: false, maxAge: REFRESH_TTL_S });
    return res;
}

export function clearAuthCookies(res) {
    const base = { sameSite: "lax", secure: secure(), maxAge: 0 };
    res.cookies.set(ACCESS_COOKIE, "", { ...base, httpOnly: true, path: "/" });
    res.cookies.set(REFRESH_COOKIE, "", { ...base, httpOnly: true, path: "/api/auth" });
    res.cookies.set(SESSION_FLAG, "", { ...base, httpOnly: false, path: "/" });
    return res;
}

/** JSON response for login / register / refresh: sets the cookies and returns the access token for API clients. */
export function sessionResponse(user, tokens, status = 200) {
    const res = NextResponse.json(
        { user: publicUser(user), token: tokens.access, expires_in: ACCESS_TTL_S },
        { status },
    );
    return setAuthCookies(res, tokens);
}

/* ---------- reading the caller ---------- */
export function readCookie(req, name) {
    return req.cookies?.get?.(name)?.value || "";
}

/** The access token from "Authorization: Bearer <jwt>" or the bash_at cookie. */
export function accessTokenFrom(req) {
    const header = req.headers.get("authorization") || "";
    if (header.startsWith("Bearer ")) return header.slice(7);
    return readCookie(req, ACCESS_COOKIE);
}

/** Verifies the JWT and loads the user. Returns null for a missing, expired, tampered or outdated token. */
export async function getUserFromRequest(req) {
    const payload = await verifyJwt(accessTokenFrom(req), "access");
    if (!payload?.sub) return null;
    const user = await findUserById(payload.sub);
    if (!user) return null;
    if ((payload.tv || 0) !== (user.token_version || 0)) return null; // role/password changed since issue
    return user;
}

/* ---------- rate limiting (stored in MongoDB so it works across serverless instances) ---------- */
export function clientIp(req) {
    const fwd = req.headers.get("x-forwarded-for") || "";
    return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function hitCount(key, windowMs) {
    const rl = await col("rate_limits");
    return rl.countDocuments({ key, created_at: { $gt: new Date(Date.now() - windowMs) } });
}
export async function addHit(key) {
    const rl = await col("rate_limits");
    await rl.insertOne({ key, created_at: new Date() });
}
export async function clearHits(key) {
    const rl = await col("rate_limits");
    await rl.deleteMany({ key });
}

/** Counts this call and returns false when the key has used up `max` calls in the window. */
export async function allow(key, max, windowMs) {
    if ((await hitCount(key, windowMs)) >= max) return false;
    await addHit(key);
    return true;
}
