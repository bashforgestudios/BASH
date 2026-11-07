import { NextResponse } from "next/server";
import { findUserById, setAuthCookies, startSession } from "@/lib/auth";
import { requireUser } from "@/lib/roles";
import { changePassword } from "@/lib/profileStore";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Body: { current, next }. Every other device is signed out; this one gets a fresh session.
export const POST = route(async (req) => {
    const { user, error } = await requireUser(req);
    if (error) return error;
    const b = await req.json().catch(() => ({}));
    await changePassword(user.id, b.current, b.next);
    const fresh = await findUserById(user.id);
    return setAuthCookies(NextResponse.json({ ok: true }), await startSession(fresh));
});
