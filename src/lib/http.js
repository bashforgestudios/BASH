// Server-only response helpers. Every API route wraps its handler in route() so
// store errors turn into a readable { detail } response instead of a crash.
import { NextResponse } from "next/server";
import { BookingError } from "@/lib/bookingStore";

export const ok = (data, status = 200, headers) => NextResponse.json(data, { status, headers });

// Shared-cache header for public, anonymous data: CDNs keep it `s` seconds and may serve a stale copy while refreshing.
export const publicCache = (s, swr = s * 4) => ({ "Cache-Control": `public, s-maxage=${s}, stale-while-revalidate=${swr}` });
export const fail = (detail, status = 422) => NextResponse.json({ detail }, { status });

export function route(fn) {
    return async (req, ctx) => {
        try {
            return await fn(req, ctx);
        } catch (e) {
            if (e instanceof BookingError) return fail(e.message, e.status);
            console.error("API error:", e);
            return fail(e?.message || "Server error", 500);
        }
    };
}
