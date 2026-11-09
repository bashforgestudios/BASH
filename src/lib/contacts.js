"use client";
// Phone contacts, browser side.
//   - Contact Picker API: the browser shows its own "choose contacts" sheet and hands back only what the
//     person ticks. Supported in Chrome on Android. Not available on iPhone/Safari or desktop browsers.
//   - Fallback: paste numbers by hand.
// The chosen contacts are kept ONLY in this browser's localStorage (so the check can run again on other
// events without asking every time) and can be removed at any time. They are never saved on our servers.
import { normalizePhone } from "@/lib/phone";

const KEY = "bash_contacts";

export const pickerSupported = () =>
    typeof navigator !== "undefined" && "contacts" in navigator && typeof window !== "undefined" && "ContactsManager" in window;

/** Opens the system contact picker. Returns [{ name, phone }] (valid Indian mobile numbers only), or null if dismissed. */
export async function pickContacts() {
    let picked;
    try {
        picked = await navigator.contacts.select(["name", "tel"], { multiple: true });
    } catch (e) {
        if (e?.name === "AbortError") return null;
        throw e;
    }
    const out = [];
    for (const c of picked || []) {
        const name = (c.name && c.name[0]) || "";
        for (const t of c.tel || []) {
            const phone = normalizePhone(t);
            if (phone) out.push({ name, phone });
        }
    }
    return out;
}

/** Parses pasted text ("98xxxxxxxx, 99xxxxxxxx" or one per line) into [{ name: "", phone }]. */
export function parseNumbers(text) {
    const out = [];
    for (const part of String(text || "").split(/[\n,;]+/)) {
        const phone = normalizePhone(part);
        if (phone) out.push({ name: "", phone });
    }
    return out;
}

export function loadSaved() {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || "[]");
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

export function saveContacts(list) {
    const seen = new Map();
    for (const c of list) if (!seen.has(c.phone) || (!seen.get(c.phone).name && c.name)) seen.set(c.phone, c);
    const unique = [...seen.values()];
    try {
        localStorage.setItem(KEY, JSON.stringify(unique));
    } catch {}
    return unique;
}

export function clearSaved() {
    try {
        localStorage.removeItem(KEY);
    } catch {}
}
