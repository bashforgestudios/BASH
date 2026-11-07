// Server-only queries for the developer panel (MongoDB).
import { col, NO_ID } from "@/lib/db";
import { listClubs } from "@/lib/clubStore";
import { listEvents } from "@/lib/eventStore";
import { sumQuota } from "@/lib/eventSchema";

export const ROLES = ["user", "club_admin", "gate", "developer"];

export async function devOverview() {
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

/** Every club with its events, quota allocation, booking counts and staff. */
export async function clubsDetail() {
    const clubs = await listClubs({ includeInactive: true });
    const events = await listEvents({ includeDrafts: true });
    const [bookings, users] = await Promise.all([col("bookings"), col("users")]);
    const counts = (
        await bookings
            .aggregate([{ $group: { _id: { club_id: "$club_id", status: "$status" }, n: { $sum: 1 }, amount: { $sum: "$amount" } } }])
            .toArray()
    ).map((r) => ({ club_id: r._id.club_id, status: r._id.status, n: r.n, amount: r.amount }));
    const staff = await users
        .find(
            { role: { $in: ["club_admin", "gate"] }, club_id: { $ne: null } },
            { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, club_id: 1 } },
        )
        .toArray();

    return clubs.map((c) => {
        const mine = events.filter((e) => e.club_id === c.id);
        const byStatus = {};
        let revenue = 0;
        for (const r of counts.filter((x) => x.club_id === c.id)) {
            byStatus[r.status] = r.n;
            if (r.status === "approved") revenue += r.amount;
        }
        return {
            ...c,
            events_total: mine.length,
            events_published: mine.filter((e) => e.status === "published").length,
            quota_allocated: mine.reduce((s, e) => s + sumQuota(e.tiers), 0),
            bookings: byStatus,
            revenue,
            staff: staff.filter((s) => s.club_id === c.id),
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
