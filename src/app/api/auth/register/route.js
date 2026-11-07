import { NextResponse } from "next/server";
import { allow, clientIp, createUser, MIN_PASSWORD, sessionResponse, startSession } from "@/lib/auth";
import { CITIES } from "@/lib/geo";
import { updateInstagram } from "@/lib/profileStore";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ageFrom(dob) {
    const d = new Date(dob);
    if (isNaN(d)) return 0;
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a;
}

async function handle(req) {
    // 10 sign-ups per hour per IP
    if (!(await allow(`register:ip:${clientIp(req)}`, 10, 60 * 60 * 1000))) {
        return NextResponse.json({ detail: "Too many sign-ups from this network. Try again later." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim().slice(0, 80);
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password ?? "");

    if (!name) return NextResponse.json({ detail: "Name is required" }, { status: 422 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ detail: "Enter a valid email address" }, { status: 422 });
    if (password.length < MIN_PASSWORD || password.length > 200)
        return NextResponse.json({ detail: `Password must be at least ${MIN_PASSWORD} characters` }, { status: 422 });

    const phone = String(body.phone ?? "").replace(/[\s-]/g, "").slice(0, 15);
    const city = String(body.city ?? "").trim();
    const dob = String(body.dob ?? "").slice(0, 10);
    const instagram = String(body.instagram ?? "").trim().replace(/^@/, "").slice(0, 30);

    if (!/^(\+91)?[6-9]\d{9}$/.test(phone))
        return NextResponse.json({ detail: "Enter a valid 10-digit mobile number" }, { status: 422 });
    if (!CITIES.some((c) => c.slug === city))
        return NextResponse.json({ detail: "Choose your city" }, { status: 422 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || ageFrom(dob) < 18)
        return NextResponse.json({ detail: "You must be 18 or older to sign up" }, { status: 422 });

    const user = await createUser({ name, email, password, phone, city, dob });
    if (!user) return NextResponse.json({ detail: "This email is already registered" }, { status: 409 });

    if (instagram) {
        try {
            await updateInstagram(user.id, instagram);
        } catch {}
    }

    return sessionResponse(user, await startSession(user), 201);
}

export async function POST(req) {
    try {
        return await handle(req);
    } catch (e) {
        console.error("register failed:", e);
        return NextResponse.json(
            { detail: "Server error: " + (e?.message || "unknown") + " (check /api/health)" },
            { status: 500 },
        );
    }
}
