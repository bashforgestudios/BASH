// Server-only: club "request access" leads (table: business_leads) and the step that turns
// a lead into a hidden club + onboarding application + club admin login.
import crypto from "crypto";
import { col, NO_ID } from "@/lib/db";
import { BookingError } from "@/lib/bookingStore";
import { LEAD_STATUSES, validateLead } from "@/lib/leads";
import { CITIES } from "@/lib/geo";
import { createUser, findUserByEmail } from "@/lib/auth";
import { createApplicationFromLead } from "@/lib/onboardingStore";
import { setUserRole } from "@/lib/devStore";

const iso = (v) => (v ? new Date(v).toISOString() : null);
const shape = (r) => ({
    ...r,
    city_name: CITIES.find((c) => c.slug === r.city_slug)?.name || r.city_slug,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
});

/** Public sign-up. Max 3 requests per email per day, so the form cannot be used to spam the inbox. */
export async function createLead(raw) {
    const { lead, errors } = validateLead(raw);
    if (errors.length) throw new BookingError(errors.join(" · "), 422);

    const leads = await col("business_leads");
    const recent = await leads.countDocuments({ email: lead.email, created_at: { $gt: new Date(Date.now() - 24 * 3600 * 1000) } });
    if (recent >= 3) throw new BookingError("We already have your request. We will be in touch soon.", 429);

    const now = new Date();
    const doc = {
        id: crypto.randomBytes(12).toString("hex"),
        club_name: lead.club_name,
        city_slug: lead.city_slug,
        contact_name: lead.contact_name,
        phone: lead.phone,
        email: lead.email,
        instagram: lead.instagram ?? null,
        website: lead.website ?? null,
        contact_pref: lead.contact_pref,
        message: lead.message ?? null,
        status: "new",
        dev_notes: null,
        club_id: null,
        created_at: now,
        updated_at: now,
    };
    await leads.insertOne(doc);
    const { _id, ...rest } = doc;
    return shape(rest);
}

export async function listLeads() {
    const leads = await col("business_leads");
    const rows = await leads
        .aggregate([
            {
                $addFields: {
                    _rank: { $switch: { branches: [
                        { case: { $eq: ["$status", "new"] }, then: 0 },
                        { case: { $eq: ["$status", "contacted"] }, then: 1 },
                        { case: { $eq: ["$status", "onboarding"] }, then: 2 },
                    ], default: 3 } },
                },
            },
            { $sort: { _rank: 1, created_at: -1 } },
            { $limit: 300 },
            { $project: { _id: 0, _rank: 0 } },
        ])
        .toArray();
    return rows.map(shape);
}

async function getLead(id) {
    const leads = await col("business_leads");
    return leads.findOne({ id }, NO_ID);
}

export async function updateLead(id, { status, dev_notes }) {
    if (status !== undefined && !LEAD_STATUSES.some((s) => s.id === status)) {
        throw new BookingError("Unknown status", 422);
    }
    const set = { updated_at: new Date() };
    if (status !== undefined) set.status = status;
    if (dev_notes !== undefined) set.dev_notes = String(dev_notes).slice(0, 2000);
    const leads = await col("business_leads");
    const row = await leads.findOneAndUpdate({ id }, { $set: set }, { returnDocument: "after", ...NO_ID });
    if (!row) throw new BookingError("Lead not found", 404);
    return shape(row);
}

const PW_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from(crypto.randomBytes(10), (b) => PW_CHARS[b % PW_CHARS.length]).join("");

/**
 * Start onboarding: creates the hidden club + a prefilled application (the existing
 * Club applications flow takes over from here) and a club admin login for the lead's email.
 * Returns the temporary password once. It is not stored anywhere in readable form.
 */
export async function convertLead(id) {
    const lead = await getLead(id);
    if (!lead) throw new BookingError("Lead not found", 404);
    if (lead.club_id) throw new BookingError("Onboarding already started for this lead", 409);

    // Check the login first so we never leave a half-created club behind.
    const existing = await findUserByEmail(lead.email);
    if (existing && existing.role !== "user") {
        throw new BookingError(`${lead.email} already belongs to a ${existing.role} account. Use a different email for this club.`, 409);
    }

    const club = await createApplicationFromLead(lead);

    let password = null;
    let linkedExisting = false;
    if (existing) {
        await setUserRole(existing.id, "club_admin", club.id);
        linkedExisting = true;
    } else {
        password = tempPassword();
        await createUser({ name: lead.contact_name, email: lead.email, password, role: "club_admin", club_id: club.id });
    }

    await (await col("business_leads")).updateOne({ id }, { $set: { status: "onboarding", club_id: club.id, updated_at: new Date() } });
    return { club_id: club.id, admin_email: lead.email, temp_password: password, linked_existing: linkedExisting };
}
