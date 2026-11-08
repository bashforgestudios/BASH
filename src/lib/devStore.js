// Server-only queries for the developer panel (MongoDB).
import { col, NO_ID } from "@/lib/db";
import { listClubs } from "@/lib/clubStore";
import { clubEventStats } from "@/lib/eventStore";
import { memo } from "@/lib/memo";

export const ROLES = ["user", "club_admin", "gate", "developer"];

// Dashboards are read-heavy and a few seconds old is fine, so they are cached for 5 s.
// Concurrent requests share one computation. Writes that change them call forget("dev:").
const DASH_TTL = 5000;

export const devOverview = () => memo("dev:overview", DASH_TTL, computeOverview);
export const clubsDetail = () => memo("dev:clubs", DASH_TTL, computeClubsDetail);

async function computeOverview() {
    const [users, bookings, scans, leads] = await Promise.all([col("users"), col("bookings"), col("scan_logs"), col("business_leads")]);
    const [roles, byStatus, byResult, newLeads] = await Promise.all([
        users.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]).toArray(),
        bookings.aggregate([{ $group: { _id: "$status", n: { $sum: 1 }, amount: { $sum: "$amount" } } }]).toArray(),
        scans.aggregate([{ $group: { _id: "$result", n: { $sum: 1 } } }]).toArray(),
        leads.countDocuments({ status: "new" }),
    ]);
    return {
        roles: roles.map((r) => ({ role: r._id, n: r.n })),
        bookings: byStatus.map((r) => ({ status: r._id, n: r.n, amount: r.amount })),
        scans: byResult.map((r) => ({ result: r._id, n: r.n })),
        new_leads: newLeads,
    };
}

/**
 * Every club with its events, quota allocation, booking counts and staff.
 * One pass per data source, grouped into hash maps by club id, so the work is O(clubs + events + groups)
 * rather than filtering every list once per club.
 */
async function computeClubsDetail() {
    const [clubs, eventStats, bookings, users] = await Promise.all([
        listClubs({ includeInactive: true }),
        clubEventStats(),
        col("bookings"),
        col("users"),
    ]);
    const [counts, staff] = await Promise.all([
        bookings
            .aggregate([{ $group: { _id: { club_id: "$club_id", status: "$status" }, n: { $sum: 1 }, amount: { $sum: "$amount" } } }])
            .toArray(),
        users
            .find(
                { role: { $in: ["club_admin", "gate"] }, club_id: { $ne: null } },
                { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, club_id: 1 } },
            )
            .toArray(),
    ]);

    const bookingsByClub = new Map(); // club_id -> { byStatus, revenue }
    for (const r of counts) {
        const entry = bookingsByClub.get(r._id.club_id) || { byStatus: {}, revenue: 0 };
        entry.byStatus[r._id.status] = r.n;
        if (r._id.status === "approved") entry.revenue += r.amount;
        bookingsByClub.set(r._id.club_id, entry);
    }
    const staffByClub = new Map();
    for (const m of staff) {
        if (!staffByClub.has(m.club_id)) staffByClub.set(m.club_id, []);
        staffByClub.get(m.club_id).push(m);
    }

    return clubs.map((c) => {
        const ev = eventStats.get(c.id) || { total: 0, published: 0, quota: 0 };
        const b = bookingsByClub.get(c.id) || { byStatus: {}, revenue: 0 };
        return {
            ...c,
            events_total: ev.total,
            events_published: ev.published,
            quota_allocated: ev.quota,
            bookings: b.byStatus,
            revenue: b.revenue,
            staff: staffByClub.get(c.id) || [],
        };
    });
}

export async function listUsers() {
    const users = await col("users");
    return users
        .find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, club_id: 1, created_at: 1 } })
        .sort({ created_at: -1 })
        .limit(300)
        .toArray();
}

/** Changes a role. Bumps token_version so the user's existing access tokens stop working at once. */
export async function setUserRole(id, role, clubId) {
    const users = await col("users");
    return users.findOneAndUpdate(
        { id },
        { $set: { role, club_id: clubId }, $inc: { token_version: 1 } },
        { returnDocument: "after", projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, club_id: 1 } },
    );
}

export async function listAllBookings() {
    const bookings = await col("bookings");
    return bookings
        .find(
            {},
            {
                projection: {
                    _id: 0, id: 1, club_id: 1, event_title: 1, event_venue: 1, tier: 1, quantity: 1, amount: 1,
                    booking_type: 1, status: 1, attendee_name: 1, attendee_email: 1, ticket_code: 1, used_at: 1, created_at: 1,
                },
            },
        )
        .sort({ created_at: -1 })
        .limit(200)
        .toArray();
}

/** Every QR scan and gate decision across all clubs, newest first. */
export async function listAllScans(limit = 500) {
    const scans = await col("scan_logs");
    const rows = await scans.find({}, NO_ID).sort({ scanned_at: -1 }).limit(limit).toArray();
    return rows.map((r) => ({
        ...r,
        scanned_at: r.scanned_at ? new Date(r.scanned_at).toISOString() : null,
        decided_at: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    }));
}
