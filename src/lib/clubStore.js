// Server-only club store. Seed clubs come from src/data/seedClubs.js; clubs created or
// edited in the developer panel are stored in MongoDB (collection: clubs, one flat document each).
//
// The merged club list is built once, kept for a few seconds, and indexed by id (Map), so
// getClub() is O(1) instead of rebuilding and scanning the whole list on every call.
import crypto from "crypto";
import { seedClubs } from "@/data/seedClubs";
import { col, NO_ID } from "@/lib/db";
import { forget, memo } from "@/lib/memo";

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

// { all: sorted array, byId: Map, byCity: Map(slug -> sorted array) }
function loadIndex() {
    return memo("clubs:index", 10_000, async () => {
        const map = new Map(seedClubs.map((c) => [c.id, c]));
        for (const r of await readDbClubs()) map.set(r.id, { ...(map.get(r.id) || {}), ...r });
        const all = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
        const byCity = new Map();
        for (const c of all) {
            if (!byCity.has(c.city_slug)) byCity.set(c.city_slug, []);
            byCity.get(c.city_slug).push(c);
        }
        return { all, byId: new Map(all.map((c) => [c.id, c])), byCity };
    });
}

export async function listClubs({ city, includeInactive = false } = {}) {
    const idx = await loadIndex();
    const list = city && city !== "all" ? idx.byCity.get(city) || [] : idx.all;
    return includeInactive ? list : list.filter((c) => c.is_active !== false);
}

export async function getClub(id, { includeInactive = true } = {}) {
    if (!id) return null;
    const club = (await loadIndex()).byId.get(id) || null;
    if (!club) return null;
    return includeInactive || club.is_active !== false ? club : null;
}

export async function createClub(data) {
    const clubs = await col("clubs");
    const id = `club-${crypto.randomBytes(8).toString("hex")}`;
    const { id: _i, ...clean } = data;
    await clubs.insertOne({ ...clean, id, created_at: new Date() });
    forget("clubs:");
    forget("dev:");
    return { ...clean, id };
}

export async function updateClub(id, patch) {
    const current = await getClub(id);
    if (!current) return null;
    const { id: _ignored, ...next } = { ...current, ...patch };
    const clubs = await col("clubs");
    // upsert: editing a seed club stores an override document with the same id
    await clubs.replaceOne({ id }, { ...next, id, created_at: new Date() }, { upsert: true });
    forget("clubs:");
    forget("dev:");
    return { ...next, id };
}
