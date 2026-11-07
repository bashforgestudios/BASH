// Server-only club onboarding. Applications: club_applications. Documents: club_documents.
// A new club is created hidden (is_active false) with verification "pending_documents".
// It becomes live only when a developer approves it, and its club admin can create events only then.
import crypto from "crypto";
import { col, NO_ID } from "@/lib/db";
import { BookingError } from "@/lib/bookingStore";
import { createClub, getClub, updateClub, listClubs } from "@/lib/clubStore";
import { validateApplication, DOCUMENTS, DOC_MIME, MAX_DOC_BYTES } from "@/lib/clubOnboarding";
import { CITIES } from "@/lib/geo";

const iso = (v) => (v ? new Date(v).toISOString() : null);
const DOC_KINDS = DOCUMENTS.map((d) => d.kind);
const cityOf = (slug) => CITIES.find((c) => c.slug === slug);

async function loadApp(clubId) {
    const apps = await col("club_applications");
    return apps.findOne({ club_id: clubId }, NO_ID);
}

// Document metadata only (no file data).
async function loadDocs(clubId) {
    const docs = await col("club_documents");
    return docs
        .find({ club_id: clubId }, { projection: { _id: 0, id: 1, kind: 1, file_name: 1, mime: 1, status: 1, reviewer_note: 1, uploaded_at: 1 } })
        .toArray();
}

async function insertApplication(clubId, application) {
    const apps = await col("club_applications");
    const now = new Date();
    await apps.insertOne({
        club_id: clubId,
        data: application,
        status: "pending_documents",
        reviewer_note: null,
        created_at: now,
        updated_at: now,
        decided_at: null,
    });
}

/** Everything still stopping approval. An empty list means the club is ready. */
export function blockersFor(application, docs) {
    const { errors } = validateApplication(application, { forApproval: true });
    const out = [...errors];
    for (const d of DOCUMENTS.filter((x) => x.req)) {
        const doc = docs.find((x) => x.kind === d.kind);
        if (!doc) out.push(`${d.label}: not uploaded`);
        else if (doc.status === "rejected") out.push(`${d.label}: rejected, upload a new copy`);
        else if (doc.status !== "approved") out.push(`${d.label}: waiting for your review`);
    }
    return out;
}

export async function createApplication(raw) {
    const { application, errors } = validateApplication(raw);
    if (errors.length) throw new BookingError(errors.join(" · "), 422);
    const city = cityOf(application.city_slug);

    const club = await createClub({
        name: application.trade_name,
        city: city.name,
        city_slug: city.slug,
        address: application.venue_address,
        capacity: Number(application.fire_noc_capacity),
        is_active: false,
        verification_status: "pending_documents",
    });
    await insertApplication(club.id, application);
    return club;
}

/**
 * Starts an application from a public lead. Unlike createApplication this does not require the
 * full form: only what the club already told us is filled in. The rest shows up as blockers in the
 * review drawer, and the developer completes it while talking to the club.
 */
export async function createApplicationFromLead(lead) {
    const city = cityOf(lead.city_slug);
    if (!city) throw new BookingError("Lead has an unknown city", 422);

    const application = {
        trade_name: lead.club_name,
        city_slug: lead.city_slug,
        admin_name: lead.contact_name,
        admin_mobile: lead.phone,
        admin_email: lead.email,
        instagram: lead.instagram || "",
        website: lead.website || "",
    };
    const club = await createClub({
        name: lead.club_name,
        city: city.name,
        city_slug: city.slug,
        address: "",
        capacity: 0, // set from the Fire NOC capacity when the club is approved
        is_active: false,
        verification_status: "pending_documents",
        lead_id: lead.id,
    });
    await insertApplication(club.id, application);
    return club;
}

export async function updateApplication(clubId, raw) {
    const app = await loadApp(clubId);
    if (!app) throw new BookingError("Application not found", 404);
    if (app.status === "approved") throw new BookingError("Reopen this club before editing its details", 409);

    const { application, errors } = validateApplication(raw);
    if (errors.length) throw new BookingError(errors.join(" · "), 422);
    const city = cityOf(application.city_slug);

    await updateClub(clubId, {
        name: application.trade_name,
        city: city.name,
        city_slug: city.slug,
        address: application.venue_address,
        capacity: Number(application.fire_noc_capacity),
    });
    await (await col("club_applications")).updateOne({ club_id: clubId }, { $set: { data: application, updated_at: new Date() } });
    return getApplicationDetail(clubId);
}

export async function getApplicationDetail(clubId) {
    const app = await loadApp(clubId);
    if (!app) return null;
    const docs = (await loadDocs(clubId)).map((d) => ({ ...d, uploaded_at: iso(d.uploaded_at) }));
    const club = await getClub(clubId);
    const blockers = app.status === "approved" ? [] : blockersFor(app.data, docs);
    return {
        club,
        status: app.status,
        reviewer_note: app.reviewer_note,
        application: app.data,
        documents: docs,
        blockers,
        can_approve: app.status !== "approved" && blockers.length === 0,
    };
}

export async function listApplications() {
    const [appsCol, docsCol] = await Promise.all([col("club_applications"), col("club_documents")]);
    const apps = await appsCol.find({}, NO_ID).sort({ updated_at: -1 }).toArray();
    const docs = await docsCol.find({}, { projection: { _id: 0, club_id: 1, kind: 1, status: 1 } }).toArray();
    const clubs = new Map((await listClubs({ includeInactive: true })).map((c) => [c.id, c]));
    const required = DOCUMENTS.filter((d) => d.req);

    return apps.map((a) => {
        const mine = docs.filter((d) => d.club_id === a.club_id);
        return {
            club_id: a.club_id,
            status: a.status,
            reviewer_note: a.reviewer_note,
            trade_name: a.data.trade_name,
            city_name: clubs.get(a.club_id)?.city || a.data.city_slug,
            capacity: clubs.get(a.club_id)?.capacity ?? null,
            docs_approved: required.filter((r) => mine.some((m) => m.kind === r.kind && m.status === "approved")).length,
            docs_required: required.length,
        };
    });
}

export async function saveDocument(clubId, kind, fileName, dataUrl) {
    const app = await loadApp(clubId);
    if (!app) throw new BookingError("Application not found", 404);
    if (app.status === "approved") throw new BookingError("Reopen this club before changing documents", 409);
    if (!DOC_KINDS.includes(kind)) throw new BookingError("Unknown document type", 422);

    const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ""));
    if (!m || !DOC_MIME.includes(m[1].toLowerCase())) {
        throw new BookingError("Upload a JPG, PNG, WebP or PDF file", 422);
    }
    if (Buffer.byteLength(m[2], "base64") > MAX_DOC_BYTES) throw new BookingError("File must be under 3 MB", 422);

    const name = String(fileName || kind).replace(/[^\w.\- ()]/g, "_").slice(0, 80);
    const docs = await col("club_documents");
    await docs.deleteMany({ club_id: clubId, kind });
    await docs.insertOne({
        id: crypto.randomBytes(12).toString("hex"),
        club_id: clubId,
        kind,
        file_name: name,
        mime: m[1].toLowerCase(),
        data: m[2],
        status: "pending",
        reviewer_note: null,
        uploaded_at: new Date(),
    });
    return getApplicationDetail(clubId);
}

export async function getDocumentData(clubId, docId) {
    const docs = await col("club_documents");
    const row = await docs.findOne({ id: docId, club_id: clubId }, { projection: { _id: 0, file_name: 1, mime: 1, data: 1 } });
    if (!row) throw new BookingError("Document not found", 404);
    return { file_name: row.file_name, data_url: `data:${row.mime};base64,${row.data}` };
}

/** action: approve | reject (reason required) | reset (back to waiting for review) */
export async function decideDocument(clubId, docId, action, note) {
    const app = await loadApp(clubId);
    if (!app) throw new BookingError("Application not found", 404);
    if (app.status === "approved") throw new BookingError("Reopen this club before changing documents", 409);

    const status = { approve: "approved", reject: "rejected", reset: "pending" }[action];
    if (!status) throw new BookingError("Unknown action", 422);
    const why = action === "reject" ? String(note ?? "").trim() : null;
    if (action === "reject" && why.length < 3) throw new BookingError("Write why the document is rejected", 422);

    const res = await (await col("club_documents")).updateOne({ id: docId, club_id: clubId }, { $set: { status, reviewer_note: why } });
    if (!res.matchedCount) throw new BookingError("Document not found", 404);
    return getApplicationDetail(clubId);
}

/** action: approve | reject (reason required) | reopen */
export async function decideApplication(clubId, action, reason) {
    const app = await loadApp(clubId);
    if (!app) throw new BookingError("Application not found", 404);

    if (action === "approve") {
        const detail = await getApplicationDetail(clubId);
        if (detail.blockers.length) {
            const more = detail.blockers.length > 3 ? ` and ${detail.blockers.length - 3} more` : "";
            throw new BookingError(`Not ready to approve: ${detail.blockers.slice(0, 3).join("; ")}${more}`, 409);
        }
        await updateClub(clubId, {
            verification_status: "approved",
            is_active: true,
            verified_at: new Date().toISOString(),
            capacity: Number(app.data.fire_noc_capacity),
        });
        const now = new Date();
        await (await col("club_applications")).updateOne({ club_id: clubId }, { $set: { status: "approved", reviewer_note: null, decided_at: now, updated_at: now } });
        await (await col("business_leads")).updateMany({ club_id: clubId }, { $set: { status: "converted", updated_at: now } });
    } else if (action === "reject") {
        const why = String(reason ?? "").trim();
        if (why.length < 3) throw new BookingError("Write the reason for rejecting", 422);
        await updateClub(clubId, { verification_status: "rejected", is_active: false });
        const now = new Date();
        await (await col("club_applications")).updateOne({ club_id: clubId }, { $set: { status: "rejected", reviewer_note: why, decided_at: now, updated_at: now } });
    } else if (action === "reopen") {
        await updateClub(clubId, { verification_status: "pending_documents", is_active: false });
        await (await col("club_applications")).updateOne({ club_id: clubId }, { $set: { status: "pending_documents", reviewer_note: null, updated_at: new Date() } });
    } else {
        throw new BookingError("Unknown action", 422);
    }
    return getApplicationDetail(clubId);
}
