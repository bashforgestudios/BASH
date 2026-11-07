// Shared (server + client): the short "request access" form a club fills in, and the
// pipeline statuses the Bash team moves it through in the Developer panel.
import { CITIES } from "@/lib/geo";

export const LEAD_STATUSES = [
    { id: "new", label: "New", tone: "blue" },
    { id: "contacted", label: "Contacted", tone: "amber" },
    { id: "onboarding", label: "Onboarding", tone: "amber" },
    { id: "converted", label: "Live", tone: "green" },
    { id: "declined", label: "Declined", tone: "red" },
];

export const CONTACT_PREFS = [
    { id: "call", label: "Call me" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "email", label: "Email" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cleans and checks a lead. Returns { lead, errors }. */
export function validateLead(raw = {}) {
    const s = (k, max) => String(raw[k] ?? "").trim().slice(0, max);
    const lead = {
        club_name: s("club_name", 120),
        city_slug: s("city_slug", 40),
        contact_name: s("contact_name", 80),
        phone: s("phone", 20).replace(/[\s()-]/g, ""),
        email: s("email", 200).toLowerCase(),
        instagram: s("instagram", 60).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, ""),
        website: s("website", 200),
        contact_pref: CONTACT_PREFS.some((p) => p.id === raw.contact_pref) ? raw.contact_pref : "call",
        message: s("message", 500),
    };
    const errors = [];
    if (!lead.club_name) errors.push("Enter your club or venue name");
    if (!CITIES.some((c) => c.slug === lead.city_slug)) errors.push("Pick your city");
    if (!lead.contact_name) errors.push("Enter your name");
    if (!/^\+?\d{10,13}$/.test(lead.phone)) errors.push("Enter a 10 digit mobile number");
    if (!EMAIL.test(lead.email)) errors.push("Enter a valid email address");
    return { lead, errors };
}
