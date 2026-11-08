// Server-only event store.
// Seed events live in src/data/seedEvents.js (static, shipped with the build).
// Events created by club admins are stored in MongoDB (collection: events, one flat document each).
//
// Speed notes
//   - Seed events are converted once at startup and indexed by id in a Map (O(1) lookup).
//   - Filtering, ranking and the result limit run inside MongoDB (indexed), not in JavaScript
//     after downloading every event.
//   - Public listings are "lean": the heavy detail fields are left out (the detail page loads them).
//   - Seats left are computed only for the events being returned, with one covered-index aggregate.
import crypto from "crypto";
import { seedEvents } from "@/data/seedEvents";
import { clubIdFor } from "@/data/seedClubs";
import { col, NO_ID } from "@/lib/db";
import { soldCounts } from "@/lib/bookingStore";
import { forget, memo } from "@/lib/memo";

const iso = (v) => new Date(v).toISOString();

// fields only the detail page needs
const HEAVY = ["description", "lineup", "gallery", "reviews", "faqs", "location", "info", "hero_image"];
const LEAN_PROJECTION = { _id: 0, ...Object.fromEntries(HEAVY.map((k) => [k, 0])) };
const lean = (e) => {
    const out = { ...e };
    for (const k of HEAVY) delete out[k];
    return out;
};

function fromSeed(e) {
    return {
        status: "published",
        booking_type: "non_exclusive",
        featured: false,
        homepage_placement: "none",
        ...e,
        genre_slugs: [e.genre_slug],
        club_id: clubIdFor(e.venue, e.city),
        seeded: true,
    };
}

// built once per server instance
const SEED = seedEvents.map(fromSeed);
const SEED_LEAN = SEED.map(lean);
const SEED_BY_ID = new Map(SEED.map((e) => [e.id, e]));

function fromDb(r) {
    return {
        status: "published",
        booking_type: "non_exclusive",
        featured: false,
        homepage_placement: "none",
        ...r,
        genre_slugs: r.genre_slugs || [r.genre_slug].filter(Boolean),
        created_at: iso(r.created_at),
        seeded: false,
    };
}

const rank = (e) => (e.homepage_placement === "hero" ? 2 : e.featured ? 1 : 0);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Adds `remaining` to every tier that has a quota (null = no quota). Looks only at events that have quotas. */
async function attachRemaining(events) {
    const quotaIds = events.filter((e) => e.tiers?.some((t) => t.quota)).map((e) => e.id);
    const sold = quotaIds.length ? await soldCounts(quotaIds) : new Map();
    return events.map((e) => ({
        ...e,
        tiers: e.tiers?.map((t) => ({
            ...t,
            remaining: t.quota ? Math.max(0, t.quota - (sold.get(`${e.id}::${t.name}`) || 0)) : null,
        })),
    }));
}

/**
 * Search events. Returns { events, total }. `total` counts every match, `events` is at most `limit` long.
 * lean (default false): leave out the heavy detail fields. limit: max events returned.
 */
export async function searchEvents({ city, genre, q, club_id, includeDrafts = false, lean: leanOut = false, limit = 0 } = {}) {
    const cityF = city && city !== "all" ? city : null;
    const genreF = genre && genre !== "all" ? genre : null;
    const needle = q ? q.toLowerCase() : null;

    // ----- created events: filter in MongoDB
    const match = {};
    if (!includeDrafts) match.status = "published";
    if (club_id) match.club_id = club_id;
    if (cityF) match.city_slug = cityF;
    if (genreF) match.genre_slugs = genreF;
    if (needle) {
        const re = new RegExp(escapeRe(q), "i");
        match.$or = ["title", "artist", "venue", "city", "genre"].map((f) => ({ [f]: re }));
    }

    const cap = limit > 0 ? limit : 0;
    const pipeline = [
        { $match: match },
        { $addFields: { _rank: { $cond: [{ $eq: ["$homepage_placement", "hero"] }, 2, { $cond: ["$featured", 1, 0] }] } } },
        { $sort: { _rank: -1, created_at: -1 } },
        ...(cap ? [{ $limit: cap }] : []),
        { $project: { _id: 0, _rank: 0, ...(leanOut ? Object.fromEntries(HEAVY.map((k) => [k, 0])) : {}) } },
    ];

    const [created, createdTotal] = await Promise.all([
        (await col("events")).aggregate(pipeline).toArray(),
        (await col("events")).countDocuments(match),
    ]);

    // ----- seed events: tiny, filtered in memory
    const seeds = (leanOut ? SEED_LEAN : SEED).filter(
        (e) =>
            (includeDrafts || e.status === "published") &&
            (!club_id || e.club_id === club_id) &&
            (!cityF || e.city_slug === cityF) &&
            (!genreF || e.genre_slugs.includes(genreF)) &&
            (!needle || [e.title, e.artist, e.venue, e.city, e.genre].join(" ").toLowerCase().includes(needle)),
    );

    // created ones first (newest first), then seeds; stable sort keeps that order inside each rank
    let events = [...created.map(fromDb), ...seeds];
    events.sort((a, b) => rank(b) - rank(a));
    if (cap) events = events.slice(0, cap);

    return { events: await attachRemaining(events), total: createdTotal + seeds.length };
}

/** Public listing (published only, unless includeDrafts for club/developer views). */
export async function listEvents(opts = {}) {
    return (await searchEvents(opts)).events;
}

/** Same as searchEvents, but identical calls within a few seconds share one result. For public pages. */
export function searchEventsCached(opts, ttlMs = 5000) {
    return memo(`events:search:${JSON.stringify(opts)}`, ttlMs, () => searchEvents(opts));
}

export async function getEvent(id, { includeDrafts = false } = {}) {
    let event = SEED_BY_ID.get(id) || null;
    if (!event) {
        const row = await (await col("events")).findOne({ id }, NO_ID);
        if (!row) return null;
        event = fromDb(row);
    }
    if (!includeDrafts && event.status !== "published") return null;
    const [withSeats] = await attachRemaining([event]);
    return withSeats;
}

/**
 * Per-club event counts for the developer dashboard, computed in one pass:
 * Map(club_id -> { total, published, quota }).
 */
export async function clubEventStats() {
    const stats = new Map();
    const add = (id, status, quota) => {
        const s = stats.get(id) || { total: 0, published: 0, quota: 0 };
        s.total += 1;
        if (status === "published") s.published += 1;
        s.quota += quota;
        stats.set(id, s);
    };
    for (const e of SEED) add(e.club_id, e.status, (e.tiers || []).reduce((n, t) => n + (Number(t.quota) || 0), 0));

    const rows = await (await col("events"))
        .aggregate([
            {
                $group: {
                    _id: "$club_id",
                    total: { $sum: 1 },
                    published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
                    quota: { $sum: { $sum: "$tiers.quota" } },
                },
            },
        ])
        .toArray();
    for (const r of rows) {
        const s = stats.get(r._id) || { total: 0, published: 0, quota: 0 };
        stats.set(r._id, { total: s.total + r.total, published: s.published + r.published, quota: s.quota + r.quota });
    }
    return stats;
}

export async function createEvent(data) {
    const events = await col("events");
    const id = crypto.randomBytes(12).toString("hex");
    const created_at = new Date();
    const { id: _i, created_at: _c, seeded: _s, ...clean } = data;
    await events.insertOne({ ...clean, id, created_at });
    forget("events:");
    forget("dev:");
    return { ...clean, id, created_at: iso(created_at) };
}

export async function updateEvent(id, data) {
    const events = await col("events");
    const cur = await events.findOne({ id }, { projection: { _id: 0, created_at: 1 } });
    if (!cur) return null;
    const { id: _i, created_at: _c, seeded: _s, ...clean } = data;
    await events.replaceOne({ id }, { ...clean, id, created_at: cur.created_at });
    forget("events:");
    forget("dev:");
    return { ...clean, id, created_at: iso(cur.created_at) };
}
