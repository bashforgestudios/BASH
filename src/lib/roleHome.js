// Client + server safe: where each role lands after signing in, and which roles may open which pages.
export const homeFor = (role) =>
    ({ club_admin: "/club", gate: "/gate", developer: "/dev" })[role] || "/";

export const ALL_ROLES = ["user", "club_admin", "gate", "developer"];

// Page rules, first match wins. Used by middleware.js. The pages themselves also check, but the
// middleware stops a wrong-role visitor before any panel code is sent to the browser.
export const PAGE_RULES = [
    { prefix: "/club", roles: ["club_admin"] },
    { prefix: "/create-event", roles: ["club_admin"] },
    { prefix: "/gate", roles: ["gate", "club_admin"] },
    { prefix: "/dev", roles: ["developer"] },
    { prefix: "/tickets", roles: ALL_ROLES },
    { prefix: "/profile", roles: ALL_ROLES },
    { prefix: "/book", roles: ALL_ROLES },
];

// API rules (coarse gate in middleware; each route handler still calls requireRole).
export const API_RULES = [
    { prefix: "/api/dev", roles: ["developer"] },
    { prefix: "/api/club", roles: ["club_admin", "gate"] }, // gate may read /api/club/scans
    { prefix: "/api/gate", roles: ["gate", "club_admin"] },
];

export const matchesPrefix = (pathname, prefix) => pathname === prefix || pathname.startsWith(prefix + "/");

/** Only same-site paths are allowed as a post-login redirect ("/club", never "//evil.com" or "https://..."). */
export function safeNext(next, fallback = "/") {
    const n = String(next ?? "");
    if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return fallback;
    return n;
}
