// Edge-safe JWT helpers (jose). Used by middleware.js and by src/lib/auth.js.
// Do not import anything Node-only or database-related here: middleware runs on the Edge runtime.
import { SignJWT, jwtVerify } from "jose";

export const ISSUER = "bash";
export const AUDIENCE = "bash-web";

export const ACCESS_TTL_S = 15 * 60; // 15 minutes
export const REFRESH_TTL_S = 7 * 24 * 60 * 60; // 7 days

export const ACCESS_COOKIE = "bash_at"; // httpOnly access JWT
export const REFRESH_COOKIE = "bash_rt"; // httpOnly refresh JWT, only sent to /api/auth/*
export const SESSION_FLAG = "bash_sid"; // readable flag so the UI knows a session exists (holds no secret)

let cached = null;
function secretKey() {
    if (cached) return cached;
    let secret = process.env.AUTH_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("AUTH_SECRET is not set. Generate one with: openssl rand -hex 32");
        }
        secret = "dev-only-insecure-secret-change-me-0123456789";
    } else if (secret.length < 32 && process.env.NODE_ENV === "production") {
        throw new Error("AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32");
    }
    cached = new TextEncoder().encode(secret);
    return cached;
}

/** Short-lived access token. Carries role and club so middleware can route without a database call. */
export function signAccessToken(user) {
    return new SignJWT({
        typ: "access",
        role: user.role || "user",
        club: user.club_id || null,
        tv: user.token_version || 0,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TTL_S}s`)
        .sign(secretKey());
}

/** Long-lived refresh token. Its jti is stored in the database so it can be rotated and revoked. */
export function signRefreshToken({ userId, jti, family }) {
    return new SignJWT({ typ: "refresh", fam: family })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(`${REFRESH_TTL_S}s`)
        .sign(secretKey());
}

/** Returns the payload when the signature, expiry, issuer, audience and token type all check out; otherwise null. */
export async function verifyJwt(token, type) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secretKey(), {
            issuer: ISSUER,
            audience: AUDIENCE,
            algorithms: ["HS256"],
        });
        return payload.typ === type ? payload : null;
    } catch {
        return null;
    }
}
