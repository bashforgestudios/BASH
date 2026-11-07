// Server-only club store. Seed clubs come from src/data/seedClubs.js; clubs created or
// edited in the developer panel are stored in MongoDB (collection: clubs, one flat document each).
import crypto from "crypto";
import { seedClubs } from "@/data/seedClubs";
import { col, NO_ID } from "@/lib/db";

async function readDbClubs() {
    try {
        const clubs = await col("clubs");
        const rows = await clubs.find({}, NO_ID).toArray();
        return rows.map(({ created_at, ...rest }) => rest);
    } catch (e) {
        console.error("clubStore: could not read clubs from MongoDB:", e.message);
        return [];
    }
}

export async function listClubs({ city, includeInactive = false } = {}) {
    const map = new Map(seedClubs.map((c) => [c.id, c]));
    for (const r of await readDbClubs()) {
        map.set(r.id, { ...(map.get(r.id) || {}), ...r });
    }
    let clubs = [...map.values()];
    if (!includeInactive) clubs = clubs.filter((c) => c.is_active !== false);
    if (city && city !== "all") clubs = clubs.filter((c) => c.city_slug === city);
    return clubs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClub(id, { includeInactive = true } = {}) {
    if (!id) return null;
    const all = await listClubs({ includeInactive });
    return all.find((c) => c.id === id) || null;
}

export async function createClub(data) {
    const clubs = await col("clubs");
    const id = `club-${crypto.randomBytes(8).toString("hex")}`;
    const { id: _i, ...clean } = data;
    await clubs.insertOne({ ...clean, id, created_at: new Date() });
    return { ...clean, id };
}

export async function updateClub(id, patch) {
    const current = await getClub(id);
    if (!current) return null;
    const { id: _ignored, ...next } = { ...current, ...patch };
    const clubs = await col("clubs");
    // upsert: editing a seed club stores an override document with the same id
    await clubs.replaceOne({ id }, { ...next, id, created_at: new Date() }, { upsert: true });
    return { ...next, id };
}
