import { NextResponse } from "next/server";
import { clearAuthCookies, endSession, getUserFromRequest, readCookie } from "@/lib/auth";
import { REFRESH_COOKIE } from "@/lib/jwt";

export const dynamic = "force-dynamic";

// Body: { everywhere: true } also signs out every other device.
export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const user = body.everywhere ? await getUserFromRequest(req) : null;
        await endSession(readCookie(req, REFRESH_COOKIE), { everywhere: Boolean(body.everywhere && user), userId: user?.id });
    } catch (e) {
        console.error("logout cleanup failed:", e); // still clear the cookies below
    }
    return clearAuthCookies(NextResponse.json({ ok: true }));
}
