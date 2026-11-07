// Server-only bookings store (MongoDB collections: bookings, id_photos, scan_logs).
//
// Booking statuses:
//   awaiting_payment  created, not paid yet (holds quota)
//   pending           paid (or free guestlist request) and waiting in the club's review queue
//   approved          ticket issued (ticket_code set), can be scanned at the gate
//   rejected          club declined it (review_reason set)
//   cancelled         cancelled by the club (review_reason set)
// used_at is set when a gate admits the ticket; the status stays "approved".
import crypto from "crypto";
import { col, isDup, NO_ID } from "@/lib/db";

export class BookingError extends Error {
    constructor(message, status = 422) {
        super(message);
        this.status = status;
    }
}

const iso = (v) => (v ? new Date(v).toISOString() : null);
const ACTIVE = ["awaiting_payment", "pending", "approved"];
const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Fields returned to clients (never the user id).
const view = ({ user_id, ...rest }) => ({
    ...rest,
    paid_at: iso(rest.paid_at),
    created_at: iso(rest.created_at),
    used_at: iso(rest.used_at),
    reviewed_at: iso(rest.reviewed_at),
});

// Adds ID photo status for club staff: on_file | deleted | none. `photo` is the id_photos row (without the image).
const withPhotoStatus = (row, photo) => {
    let photo_status = "none";
    if (photo) photo_status = photo.deleted_at ? "deleted" : "on_file";
    return { ...view(row), photo_status, photo_deleted_at: iso(photo?.deleted_at) };
};

async function photoRows(bookingIds) {
    if (!bookingIds.length) return new Map();
    const photos = await col("id_photos");
    const rows = await photos
        .find({ booking_id: { $in: bookingIds } }, { projection: { _id: 0, booking_id: 1, deleted_at: 1 } })
        .toArray();
    return new Map(rows.map((r) => [r.booking_id, r]));
}

const genCode = () => `BASH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// ticket_code has a unique index; on the (very unlikely) collision try a new code.
async function withTicketCode(run) {
    for (let i = 0; i < 5; i++) {
        try {
            return await run(genCode());
        } catch (e) {
            if (!isDup(e)) throw e;
        }
    }
    throw new Error("Could not allocate a ticket code");
}

/** Count of seats held per "eventId::tierName" (awaiting payment, pending or approved). */
export async function soldCounts() {
    const bookings = await col("bookings");
    const rows = await bookings
        .aggregate([
            { $match: { status: { $in: ACTIVE } } },
            { $group: { _id: { event_id: "$event_id", tier: "$tier" }, n: { $sum: "$quantity" } } },
        ])
        .toArray();
    return new Map(rows.map((r) => [`${r._id.event_id}::${r._id.tier}`, r.n]));
}

export async function listBookingsForUser(userId) {
    const bookings = await col("bookings");
    const rows = await bookings.find({ user_id: userId }, NO_ID).sort({ created_at: -1 }).toArray();
    return rows.map(view);
}

export async function createBooking(d) {
    const bookings = await col("bookings");
    const doc = {
        id: crypto.randomBytes(12).toString("hex"),
        user_id: d.user_id,
        club_id: d.club_id ?? null,
        event_id: d.event_id,
        tier: d.tier,
        quantity: d.quantity,
        amount: d.amount,
        booking_type: d.booking_type,
        status: "awaiting_payment",
        attendee_name: d.attendee_name,
        attendee_email: d.attendee_email,
        attendee_phone: d.attendee_phone,
        id_type: d.id_type,
        id_last4: d.id_last4,
        event_title: d.event_title ?? null,
        event_venue: d.event_venue ?? null,
        event_city: d.event_city ?? null,
        event_date: d.event_date ?? null,
        event_time: d.event_time ?? null,
        event_image: d.event_image ?? null,
        ticket_code: null,
        payment_method: null,
        payment_gateway: null,
        paid_at: null,
        review_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        transferred_from: null,
        used_at: null,
        created_at: new Date(),
    };
    await bookings.insertOne(doc);
    const { _id, ...rest } = doc;
    return view(rest);
}

/** Throws a BookingError unless the value is a JPG/PNG/WebP data URL under the size limit. */
export function checkIdPhoto(dataUrl) {
    const m = IMAGE_RE.exec(String(dataUrl || ""));
    if (!m) throw new BookingError("ID photo must be a JPG, PNG or WebP image", 422);
    if (Buffer.byteLength(m[2], "base64") > MAX_PHOTO_BYTES) {
        throw new BookingError("ID photo must be under 2 MB", 422);
    }
    return m[0];
}

/** Stores the ID photo for a booking. Call checkIdPhoto() first so nothing is half-saved. */
export async function saveIdPhoto(bookingId, dataUrl) {
    const data = checkIdPhoto(dataUrl);
    const photos = await col("id_photos");
    await photos.updateOne(
        { booking_id: bookingId },
        { $set: { data, deleted_at: null }, $setOnInsert: { booking_id: bookingId, created_at: new Date() } },
        { upsert: true },
    );
    return true;
}

/** Blanks the ID photo and records when it was deleted. Called on every final decision. */
async function deleteIdPhoto(bookingId) {
    const photos = await col("id_photos");
    await photos.updateOne({ booking_id: bookingId, deleted_at: null }, { $set: { data: "", deleted_at: new Date() } });
}

/**
 * Pays a booking. Non-exclusive bookings are approved immediately with a ticket code;
 * guestlist and exclusive bookings wait in the club's queue ("pending").
 */
export async function payBooking({ bookingId, userId, method, gateway }) {
    const bookings = await col("bookings");
    const b = await bookings.findOne({ id: bookingId, user_id: userId }, NO_ID);
    if (!b) return null;
    if (b.status === "approved" || b.status === "pending") return view(b); // already paid: idempotent
    if (b.status !== "awaiting_payment") {
        throw new BookingError(`This booking is ${b.status} and cannot be paid`, 409);
    }

    const next = b.booking_type === "non_exclusive" ? "approved" : "pending";
    // the status filter makes this atomic: two simultaneous payments cannot both win
    const updated = await withTicketCode((code) =>
        bookings.findOneAndUpdate(
            { id: bookingId, user_id: userId, status: "awaiting_payment" },
            {
                $set: {
                    status: next,
                    ticket_code: next === "approved" ? code : null,
                    payment_method: method,
                    payment_gateway: gateway,
                    paid_at: new Date(),
                },
            },
            { returnDocument: "after", ...NO_ID },
        ),
    );
    if (!updated) throw new BookingError("This booking was changed, please refresh", 409);
    return view(updated);
}

/* ---------------- club side ---------------- */

export async function listBookingsForClub(clubId) {
    const bookings = await col("bookings");
    const rows = await bookings.find({ club_id: clubId }, NO_ID).sort({ created_at: -1 }).limit(500).toArray();
    const photos = await photoRows(rows.map((r) => r.id));
    return rows.map((r) => withPhotoStatus(r, photos.get(r.id)));
}

export async function getClubBooking(id, clubId) {
    const bookings = await col("bookings");
    const row = await bookings.findOne({ id, club_id: clubId }, NO_ID);
    if (!row) return null;
    return withPhotoStatus(row, (await photoRows([id])).get(id));
}

/** The ID photo for review. Returns null once it has been deleted. */
export async function getIdPhotoForReview(id, clubId) {
    const bookings = await col("bookings");
    const owned = await bookings.findOne({ id, club_id: clubId }, { projection: { _id: 0, id: 1 } });
    if (!owned) return null;
    const photos = await col("id_photos");
    const p = await photos.findOne({ booking_id: id }, NO_ID);
    if (!p || p.deleted_at || !p.data) return null;
    return p.data;
}

const reasonOf = (reason) => {
    const r = String(reason ?? "").trim().slice(0, 300);
    if (r.length < 3) throw new BookingError("Please write a short reason (at least 3 characters)", 422);
    return r;
};

/**
 * Club decisions: approve | reject | cancel | transfer.
 * Reject and cancel delete the guest's ID photo. Approve keeps it for the gate.
 */
export async function reviewBooking({ bookingId, clubId, reviewerId, action, reason, attendee }) {
    const bookings = await col("bookings");
    const b = await bookings.findOne({ id: bookingId, club_id: clubId }, NO_ID);
    if (!b) throw new BookingError("Booking not found for your club", 404);

    if (action === "approve") {
        if (b.status !== "pending") throw new BookingError(`Only pending bookings can be approved (this one is ${b.status})`, 409);
        const up = await withTicketCode((code) =>
            bookings.updateOne(
                { id: bookingId, status: "pending" },
                { $set: { status: "approved", ticket_code: code, reviewed_at: new Date(), reviewed_by: reviewerId, review_reason: null } },
            ),
        );
        if (!up.modifiedCount) throw new BookingError("This booking was changed, please refresh", 409);
        // the ID photo stays until the gate makes its decision (see decideScan)
    } else if (action === "reject") {
        if (b.status !== "pending") throw new BookingError(`Only pending bookings can be rejected (this one is ${b.status})`, 409);
        const why = reasonOf(reason);
        await bookings.updateOne(
            { id: bookingId, status: "pending" },
            { $set: { status: "rejected", review_reason: why, reviewed_at: new Date(), reviewed_by: reviewerId } },
        );
        await deleteIdPhoto(bookingId);
    } else if (action === "cancel") {
        if (!ACTIVE.includes(b.status)) throw new BookingError(`This booking is already ${b.status}`, 409);
        if (b.used_at) throw new BookingError("This ticket was already used at the gate", 409);
        const why = reasonOf(reason);
        await bookings.updateOne(
            { id: bookingId },
            { $set: { status: "cancelled", review_reason: why, reviewed_at: new Date(), reviewed_by: reviewerId } },
        );
        await deleteIdPhoto(bookingId);
    } else if (action === "transfer") {
        if (!["pending", "approved"].includes(b.status) || b.used_at) {
            throw new BookingError("Only unused pending or approved tickets can be transferred", 409);
        }
        await bookings.updateOne(
            { id: bookingId },
            {
                $set: {
                    attendee_name: attendee.name,
                    attendee_email: attendee.email,
                    attendee_phone: attendee.phone,
                    transferred_from: `${b.attendee_name} <${b.attendee_email}>`,
                    reviewed_at: new Date(),
                    reviewed_by: reviewerId,
                },
            },
        );
    } else {
        throw new BookingError("Unknown action", 422);
    }
    return getClubBooking(bookingId, clubId);
}

/* ---------------- gate ---------------- */

const normalizeCode = (code) => String(code ?? "").trim().toUpperCase().slice(0, 40);

async function logScan({ bookingId = null, code, clubId, gate, result, reason = null, b = null }) {
    const scans = await col("scan_logs");
    const id = crypto.randomBytes(12).toString("hex");
    await scans.insertOne({
        id,
        booking_id: bookingId,
        ticket_code: code,
        event_id: b?.event_id ?? null,
        club_id: clubId,
        gate_user_id: gate.id,
        gate_name: gate.name,
        result,
        reason,
        attendee_name: b?.attendee_name ?? null,
        attendee_phone: b?.attendee_phone ?? null,
        event_title: b?.event_title ?? null,
        tier: b?.tier ?? null,
        quantity: b?.quantity ?? null,
        scanned_at: new Date(),
        decided_at: null,
    });
    return id;
}

/**
 * Step 1 of the gate flow: a QR (or typed) code is read. Nothing is admitted yet.
 * Returns the guest details so the gate can check them. Every read is logged as a scan.
 * result: scanned (eligible, waiting for a decision) | not_approved | already_used | invalid
 */
export async function lookupTicket({ code, clubId, gate }) {
    const clean = normalizeCode(code);
    if (!clean) throw new BookingError("Enter a ticket code", 422);

    const bookings = await col("bookings");
    const found = await bookings.findOne({ ticket_code: clean }, NO_ID);
    const row = found && found.club_id === clubId ? found : null;

    if (!row) {
        const scan_id = await logScan({ code: clean, clubId, gate, result: "invalid", reason: "No ticket with this code at your venue" });
        return { result: "invalid", reason: "No ticket with this code at your venue", scan_id, booking: null };
    }

    const booking = withPhotoStatus(row, (await photoRows([row.id])).get(row.id));
    let result;
    let reason = null;
    if (row.status !== "approved") {
        result = "not_approved";
        reason = row.status === "pending" ? "Not approved by the club yet" : `Ticket is ${row.status}`;
    } else if (row.used_at) {
        result = "already_used";
        reason = `Already admitted at ${new Date(row.used_at).toLocaleTimeString("en-IN")}`;
    } else {
        result = "scanned";
    }

    const scan_id = await logScan({ bookingId: row.id, code: clean, clubId, gate, result, reason, b: row });
    return { result, reason, scan_id, booking };
}

/**
 * Step 2: the gate approves (admits) or declines the guest shown by lookupTicket.
 * Approving sets used_at so the ticket cannot be used twice. The ID photo is deleted
 * once the door has decided, whichever the decision is.
 */
export async function decideScan({ scanId, clubId, gate, decision }) {
    if (!["approve", "decline"].includes(decision)) {
        throw new BookingError("Decision must be approve or decline", 422);
    }
    const scans = await col("scan_logs");
    const s = await scans.findOne({ id: scanId, club_id: clubId }, NO_ID);
    if (!s) throw new BookingError("Scan not found", 404);
    if (s.result !== "scanned") {
        throw new BookingError(`This scan is already ${s.result.replace("_", " ")}`, 409);
    }

    let final;
    let reason = null;
    if (decision === "approve") {
        const bookings = await col("bookings");
        // used_at: null is the atomic guard: only one gate can admit a ticket
        const up = await bookings.updateOne(
            { id: s.booking_id, club_id: clubId, status: "approved", used_at: null },
            { $set: { used_at: new Date() } },
        );
        if (up.modifiedCount) {
            final = "admitted";
        } else {
            final = "already_used";
            reason = "Admitted a moment ago at another gate";
        }
    } else {
        final = "declined";
        reason = "Entry refused at the gate";
    }

    await scans.updateOne({ id: scanId }, { $set: { result: final, reason, decided_at: new Date() } });
    if (s.booking_id) await deleteIdPhoto(s.booking_id);
    return { result: final, reason, scan_id: scanId };
}

export async function listScans(clubId, limit = 200) {
    const scans = await col("scan_logs");
    const rows = await scans.find({ club_id: clubId }, NO_ID).sort({ scanned_at: -1 }).limit(limit).toArray();
    return rows.map((r) => ({ ...r, scanned_at: iso(r.scanned_at), decided_at: iso(r.decided_at) }));
}

export { IMAGE_RE, MAX_PHOTO_BYTES };
