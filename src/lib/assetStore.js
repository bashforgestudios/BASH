// Server-only store for public images (event flyers, profile photos). Served by /api/assets/[id].
import crypto from "crypto";
import { col } from "@/lib/db";

const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_BYTES = 2 * 1024 * 1024;

export async function saveFlyer(dataUrl) {
    const m = IMAGE_RE.exec(String(dataUrl || ""));
    if (!m) return { error: "Upload a JPG, PNG or WebP image" };
    if (Buffer.byteLength(m[2], "base64") > MAX_BYTES) return { error: "Flyer must be under 2 MB" };
    const assets = await col("assets");
    const id = crypto.randomBytes(12).toString("hex");
    await assets.insertOne({ id, mime: m[1], data: m[2], created_at: new Date() });
    return { id, url: `/api/assets/${id}` };
}

export async function getAsset(id) {
    const assets = await col("assets");
    return assets.findOne({ id: String(id) }, { projection: { _id: 0, mime: 1, data: 1 } });
}
