import { NextResponse } from "next/server";
import { col } from "@/lib/db";

export const dynamic = "force-dynamic";

// Visit /api/health after deploying to see what is misconfigured. Never exposes secret values.
export async function GET() {
    const checks = {
        MONGODB_URI: Boolean(process.env.MONGODB_URI),
        AUTH_SECRET: Boolean(process.env.AUTH_SECRET) && process.env.AUTH_SECRET.length >= 32,
        database: "not checked",
    };
    if (checks.MONGODB_URI) {
        try {
            const users = await col("users");
            checks.database = `ok (${await users.estimatedDocumentCount()} users)`;
        } catch (e) {
            checks.database = `error: ${e.message}`;
        }
    }
    const ok = checks.MONGODB_URI && checks.AUTH_SECRET && checks.database.startsWith("ok");
    return NextResponse.json(checks, { status: ok ? 200 : 500 });
}
