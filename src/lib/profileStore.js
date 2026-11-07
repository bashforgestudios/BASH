// Server-only profile store: name, email, Bash ID, masked ID number, Instagram, two photos.
// Only the LAST 4 digits of an ID number are ever stored (in bookings), so the full
// Aadhaar number is never shown or kept.
import crypto from "crypto";
import { col, NO_ID } from "@/lib/db";
import { BookingError } from "@/lib/bookingStore";
import { CITIES } from "@/lib/geo";
import { hashPassword, MIN_PASSWORD, revokeAllSessions, verifyPassword } from "@/lib/auth";

const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_BYTES = 2 * 1024 * 1024;
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const iso = (v) => (v ? new Date(v).toISOString() : null);

const maskId = (type, last4) => (type === "Aadhaar" ? `XXXX XXXX ${last4}` : `${type} •••• ${last4}`);

/** Accepts "@name", "name", or a full instagram.com link. Returns the bare username, or null. */
export function normalizeInstagram(raw) {
    let v = String(raw ?? "").trim();
    if (!v) return null;
    v = v
        .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
        .replace(/[?#].*$/, "")
        .replace(/\/.*$/, "")
        .replace(/^@/, "");
    if (!HANDLE_RE.test(v)) {
        throw new BookingError("Enter a valid Instagram username, for example @yourname", 422);
    }
    return v;
}

export async function getProfile(userId) {
    const [users, bookings] = await Promise.all([col("users"), col("bookings")]);
    const u = await users.findOne({ id: userId }, NO_ID);
    if (!u) return null;
    const live = { user_id: userId, status: { $in: ["approved", "pending"] } };
    const [latest, tickets, attended, eventIds] = await Promise.all([
        bookings.findOne({ user_id: userId }, { sort: { created_at: -1 }, projection: { _id: 0, id_type: 1, id_last4: 1 } }),
        bookings.countDocuments(live),
        bookings.countDocuments({ user_id: userId, used_at: { $ne: null } }),
        bookings.distinct("event_id", live),
    ]);
    return {
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        city: u.city || null,
        dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : null,
        role: u.role || "user",
        stats: { tickets, attended, events: eventIds.length },
        bash_id: u.bash_id,
        instagram: u.instagram ?? null,
        photo_top: u.photo_top ?? null,
        photo_side: u.photo_side ?? null,
        id_type: latest?.id_type ?? null,
        id_masked: latest ? maskId(latest.id_type, latest.id_last4) : null,
        member_since: iso(u.created_at),
    };
}

export async function updateInstagram(userId, raw) {
    const handle = normalizeInstagram(raw);
    await (await col("users")).updateOne({ id: userId }, { $set: { instagram: handle } });
    return getProfile(userId);
}

/** slot: "top" | "side". Replaces the old photo and deletes its stored image. */
export async function setProfilePhoto(userId, slot, dataUrl) {
    if (slot !== "top" && slot !== "side") throw new BookingError("Unknown photo slot", 422);
    const m = IMAGE_RE.exec(String(dataUrl || ""));
    if (!m) throw new BookingError("Photo must be a JPG, PNG or WebP image", 422);
    if (Buffer.byteLength(m[2], "base64") > MAX_BYTES) throw new BookingError("Photo must be under 2 MB", 422);

    const [users, assets] = await Promise.all([col("users"), col("assets")]);
    const assetId = crypto.randomBytes(12).toString("hex");
    await assets.insertOne({ id: assetId, mime: m[1], data: m[2], created_at: new Date() });
    const url = `/api/assets/${assetId}`;

    const field = slot === "top" ? "photo_top" : "photo_side";
    const cur = await users.findOne({ id: userId }, { projection: { _id: 0, [field]: 1 } });
    await users.updateOne({ id: userId }, { $set: { [field]: url } });
    const old = cur?.[field];
    if (old) await assets.deleteOne({ id: old.replace("/api/assets/", "") });
    return getProfile(userId);
}

/** Body: any of { name, phone, city, instagram }. Only the fields that are sent are changed. */
export async function updateDetails(userId, b = {}) {
    const users = await col("users");
    const set = {};
    if (b.name !== undefined) {
        const name = String(b.name).trim().slice(0, 80);
        if (!name) throw new BookingError("Name can't be empty", 422);
        set.name = name;
    }
    if (b.phone !== undefined) {
        const phone = String(b.phone).replace(/[\s-]/g, "").slice(0, 15);
        if (!/^(\+91)?[6-9]\d{9}$/.test(phone)) throw new BookingError("Enter a valid 10-digit mobile number", 422);
        set.phone = phone;
    }
    if (b.city !== undefined) {
        const city = String(b.city).trim();
        if (!CITIES.some((c) => c.slug === city)) throw new BookingError("Choose a city from the list", 422);
        set.city = city;
    }
    if (b.instagram !== undefined) set.instagram = normalizeInstagram(b.instagram);
    if (Object.keys(set).length) await users.updateOne({ id: userId }, { $set: set });
    return getProfile(userId);
}

/** Changes the password and signs the account out everywhere. The caller starts a fresh session for this device. */
export async function changePassword(userId, current, next) {
    const users = await col("users");
    const u = await users.findOne({ id: userId }, { projection: { _id: 0, password_hash: 1 } });
    if (!u || !(await verifyPassword(String(current ?? ""), u.password_hash))) {
        throw new BookingError("Current password is incorrect", 403);
    }
    const n = String(next ?? "");
    if (n.length < MIN_PASSWORD || n.length > 200) throw new BookingError(`New password must be at least ${MIN_PASSWORD} characters`, 422);
    await users.updateOne({ id: userId }, { $set: { password_hash: await hashPassword(n) } });
    await revokeAllSessions(userId);
    return { ok: true };
}
