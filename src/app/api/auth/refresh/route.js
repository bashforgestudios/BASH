import { NextResponse } from "next/server";
import { clearAuthCookies, readCookie, rotateSession, sessionResponse, setAuthCookies } from "@/lib/auth";
import { REFRESH_COOKIE } from "@/lib/jwt";
import { safeNext } from "@/lib/roleHome";

export const dynamic = "force-dynamic";

// POST: the app calls this when an access token has expired. Returns the user and sets new cookies.
export async function POST(req) {
    try {
        const out = await rotateSession(readCookie(req, REFRESH_COOKIE));
        if (out.error) {
            const res = NextResponse.json({ detail: out.error }, { status: 401 });
            // "just refreshed" races keep the cookies; anything else means the session is over
            return out.error.includes("Retry") ? res : clearAuthCookies(res);
        }
        return sessionResponse(out.user, out);
    } catch (e) {
        console.error("refresh failed:", e);
        return NextResponse.json({ detail: "Server error" }, { status: 500 });
    }
}

// GET ?next=/club: used by middleware when someone opens a protected page with an expired access
// token. Refreshes, then sends the browser back to the page. On failure goes to the login page.
export async function GET(req) {
    const url = new URL(req.url);
    const next = safeNext(url.searchParams.get("next"), "/");
    try {
        const out = await rotateSession(readCookie(req, REFRESH_COOKIE));
        if (out.error) {
            const to = new URL(`/login?next=${encodeURIComponent(next)}`, url);
            return clearAuthCookies(NextResponse.redirect(to));
        }
        return setAuthCookies(NextResponse.redirect(new URL(next, url)), out);
    } catch (e) {
        console.error("refresh redirect failed:", e);
        return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url));
    }
}
