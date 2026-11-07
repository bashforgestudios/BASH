import { NextResponse } from "next/server";
import {
    addHit,
    burnPasswordCheck,
    clearHits,
    clientIp,
    findUserByEmail,
    hitCount,
    sessionResponse,
    startSession,
    verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const WINDOW = 10 * 60 * 1000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

async function handle(req) {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password ?? "").slice(0, 200);
    const emailKey = `login:email:${email}`;
    const ipKey = `login:ip:${clientIp(req)}`;

    if ((await hitCount(emailKey, WINDOW)) >= MAX_PER_EMAIL || (await hitCount(ipKey, WINDOW)) >= MAX_PER_IP) {
        return NextResponse.json({ detail: "Too many failed attempts. Try again in a few minutes." }, { status: 429 });
    }

    const user = email ? await findUserByEmail(email) : null;
    const valid = user ? await verifyPassword(password, user.password_hash) : (await burnPasswordCheck(password), false);
    if (!valid) {
        await Promise.all([addHit(emailKey), addHit(ipKey)]);
        return NextResponse.json({ detail: "Invalid email or password" }, { status: 401 });
    }

    await clearHits(emailKey);
    return sessionResponse(user, await startSession(user));
}

export async function POST(req) {
    try {
        return await handle(req);
    } catch (e) {
        console.error("login failed:", e);
        return NextResponse.json({ detail: "Server error: " + (e?.message || "unknown") + " (check /api/health)" }, { status: 500 });
    }
}
