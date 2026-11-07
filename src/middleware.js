// Route protection. Runs on the Edge before a page or API route is served.
//
//   Pages  /club /gate /dev /tickets /profile /book ...  need a valid access JWT with an allowed role.
//          Expired access token + a live session  -> silently refreshed through /api/auth/refresh.
//          No session                              -> /login?next=<page>
//          Wrong role                              -> that role's own home page
//   API    /api/dev /api/club /api/gate             coarse role check here; every handler also calls
//                                                   requireRole(), which re-reads the role from the database.
//   CSRF   Browser calls that change data must come from this site (Origin check) when they rely on cookies.
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, SESSION_FLAG, verifyJwt } from "@/lib/jwt";
import { API_RULES, PAGE_RULES, homeFor, matchesPrefix } from "@/lib/roleHome";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

const json = (detail, status) => NextResponse.json({ detail }, { status });

function crossSite(req) {
    if (SAFE.has(req.method)) return false;
    if ((req.headers.get("authorization") || "").startsWith("Bearer ")) return false; // not cookie-based
    const origin = req.headers.get("origin");
    if (!origin) return false; // same-origin fetches from older browsers, curl, server-to-server
    try {
        return new URL(origin).host !== req.nextUrl.host;
    } catch {
        return true;
    }
}

export async function middleware(req) {
    const { pathname, search } = req.nextUrl;

    if (pathname.startsWith("/api/")) {
        if (crossSite(req)) return json("Cross-site request blocked", 403);

        const rule = API_RULES.find((r) => matchesPrefix(pathname, r.prefix));
        if (!rule) return NextResponse.next(); // public or self-guarded route

        const header = req.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies.get(ACCESS_COOKIE)?.value;
        const payload = await verifyJwt(token, "access");
        if (!payload) return json("Sign in first", 401);
        if (!rule.roles.includes(payload.role)) return json("Your account cannot do this", 403);
        return NextResponse.next();
    }

    const rule = PAGE_RULES.find((r) => matchesPrefix(pathname, r.prefix));
    if (!rule) return NextResponse.next();

    const here = pathname + search;
    const payload = await verifyJwt(req.cookies.get(ACCESS_COOKIE)?.value, "access");

    if (!payload) {
        const hasSession = req.cookies.get(SESSION_FLAG)?.value === "1";
        const to = hasSession
            ? new URL(`/api/auth/refresh?next=${encodeURIComponent(here)}`, req.url)
            : new URL(`/login?next=${encodeURIComponent(here)}`, req.url);
        return NextResponse.redirect(to);
    }

    if (!rule.roles.includes(payload.role)) {
        return NextResponse.redirect(new URL(homeFor(payload.role), req.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/:path*",
        "/club/:path*", "/club",
        "/gate/:path*", "/gate",
        "/dev/:path*", "/dev",
        "/tickets/:path*", "/tickets",
        "/profile/:path*", "/profile",
        "/book/:path*",
        "/create-event",
    ],
};
