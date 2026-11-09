// MongoDB connection (server only).
//
// One MongoClient is cached on globalThis so Next.js dev hot reloads and Vercel warm
// invocations reuse the same connection pool instead of opening a new one per request.
//
// Every document keeps its own string `id` (the same 24-char hex ids the app always used)
// next to Mongo's internal _id. Reads hide _id with NO_ID, so store code returns the same
// shapes it did when the data lived in Postgres.
import { MongoClient } from "mongodb";
import crypto from "crypto";
import { promisify } from "util";
import { seedClubs } from "@/data/seedClubs";
import { newBashId } from "@/lib/bashId";
import dns from "node:dns";

const scrypt = promisify(crypto.scrypt);

export const NO_ID = { projection: { _id: 0 } };

function getClientPromise() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not set. Add your MongoDB connection string to .env.local (and to your host's env vars).");
    }
    if (!globalThis._bashMongo) {
        dns.setServers(["1.1.1.1"]);
        
        const client = new MongoClient(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true,
        });
        globalThis._bashMongo = client.connect().catch((e) => {
            globalThis._bashMongo = null; // let the next request retry
            throw e;
        });
    }
    return globalThis._bashMongo;
}

export async function getDb() {
    const client = await getClientPromise();
    return client.db(process.env.MONGODB_DB || "bash");
}

/** Returns a collection after the indexes and seed data are in place. */
export async function col(name) {
    await ensureReady();
    return (await getDb()).collection(name);
}

/** Mongo duplicate-key error (unique index hit). */
export const isDup = (e) => e?.code === 11000;

/* ---------- indexes (idempotent) ---------- */
const INDEXES = [
    ["users", { id: 1 }, { unique: true }],
    ["users", { email: 1 }, { unique: true }],
    ["users", { bash_id: 1 }, { unique: true, partialFilterExpression: { bash_id: { $type: "string" } } }],
    ["users", { role: 1, club_id: 1 }, {}],
    ["users", { created_at: -1 }, {}],
    ["users", { phone: 1 }, { partialFilterExpression: { phone: { $type: "string" } } }],
    ["events", { id: 1 }, { unique: true }],
    ["events", { created_at: -1 }, {}],
    ["events", { status: 1, city_slug: 1, created_at: -1 }, {}],
    ["events", { club_id: 1, status: 1 }, {}],
    ["events", { genre_slugs: 1 }, {}],
    ["clubs", { id: 1 }, { unique: true }],
    ["bookings", { id: 1 }, { unique: true }],
    ["bookings", { ticket_code: 1 }, { unique: true, partialFilterExpression: { ticket_code: { $type: "string" } } }],
    ["bookings", { user_id: 1, created_at: -1 }, {}],
    ["bookings", { club_id: 1, created_at: -1 }, {}],
    // covered index: seat counting reads only the index, never the booking documents
    ["bookings", { event_id: 1, status: 1, tier: 1, quantity: 1 }, {}],
    // covered index for the dashboard totals
    ["bookings", { status: 1, amount: 1 }, {}],
    ["bookings", { club_id: 1, status: 1, amount: 1 }, {}],
    ["bookings", { user_id: 1, status: 1, event_id: 1 }, {}],
    ["id_photos", { booking_id: 1 }, { unique: true }],
    ["scan_logs", { id: 1 }, { unique: true }],
    ["scan_logs", { club_id: 1, scanned_at: -1 }, {}],
    ["scan_logs", { scanned_at: -1 }, {}],
    ["scan_logs", { result: 1 }, {}],
    ["email_logs", { id: 1 }, { unique: true }],
    ["payment_gateways", { id: 1 }, { unique: true }],
    ["business_leads", { id: 1 }, { unique: true }],
    ["business_leads", { status: 1, created_at: -1 }, {}],
    ["business_leads", { email: 1, created_at: -1 }, {}],
    ["club_applications", { club_id: 1 }, { unique: true }],
    ["club_documents", { id: 1 }, { unique: true }],
    ["club_documents", { club_id: 1, kind: 1 }, {}],
    ["assets", { id: 1 }, { unique: true }],
    // Auth: refresh tokens expire on their own (TTL), throttle rows disappear after an hour.
    ["refresh_tokens", { jti: 1 }, { unique: true }],
    ["refresh_tokens", { user_id: 1 }, {}],
    ["refresh_tokens", { family: 1 }, {}],
    ["refresh_tokens", { expires_at: 1 }, { expireAfterSeconds: 0 }],
    ["rate_limits", { key: 1, created_at: -1 }, {}],
    ["rate_limits", { created_at: 1 }, { expireAfterSeconds: 3600 }],
];

const GATEWAY_SEEDS = [
    ["razorpay", "Razorpay", true],
    ["stripe", "Stripe", false],
    ["payu", "PayU", false],
    ["cashfree", "Cashfree", false],
];

// Demo accounts, one per role. On by default in development; in production they are only
// created when DEMO_USER=on is set explicitly.
const demoEnabled = () =>
    process.env.DEMO_USER === "on" || (process.env.NODE_ENV !== "production" && process.env.DEMO_USER !== "off");

const demoAccounts = () => {
    const puneClub = seedClubs.find((c) => c.city_slug === "pune")?.id ?? null;
    return [
        { name: "Test User", email: "test@bash.in", password: "test1234", role: "user", club_id: null },
        { name: "Ballrs Club Admin", email: "club@bash.in", password: "club1234", role: "club_admin", club_id: puneClub },
        { name: "Ballrs Gate", email: "gate@bash.in", password: "gate1234", role: "gate", club_id: puneClub },
        { name: "Bash Developer", email: "dev@bash.in", password: "dev12345", role: "developer", club_id: null },
    ];
};

let ready = null;

/**
 * Creates indexes on first use (once per server instance) and seeds gateways and demo
 * accounts. Every store function goes through col(), so no manual setup step is required.
 */
export function ensureReady() {
    if (!ready) {
        ready = (async () => {
            const db = await getDb();
            // All in parallel: one network round trip instead of ~35 in a row. On a cold serverless start
            // with a remote database that was the biggest part of the first request's delay.
            await Promise.all([
                ...INDEXES.map(([name, keys, opts]) => db.collection(name).createIndex(keys, opts)),
                ...GATEWAY_SEEDS.map(([id, name, enabled]) =>
                    db.collection("payment_gateways").updateOne(
                        { id },
                        { $setOnInsert: { id, name, enabled, mode: "test", key_id: null, updated_at: new Date() } },
                        { upsert: true },
                    ),
                ),
            ]);

            if (demoEnabled()) {
                await Promise.all(demoAccounts().map(async (acc) => {
                    const salt = crypto.randomBytes(16).toString("hex");
                    const hash = (await scrypt(acc.password, salt, 64)).toString("hex");
                    await db.collection("users").updateOne(
                        { email: acc.email },
                        {
                            $setOnInsert: {
                                id: crypto.randomBytes(12).toString("hex"),
                                name: acc.name,
                                email: acc.email,
                                password_hash: `${salt}:${hash}`,
                                role: acc.role,
                                club_id: acc.club_id,
                                bash_id: newBashId(),
                                token_version: 0,
                                created_at: new Date(),
                            },
                        },
                        { upsert: true },
                    );
                }));
            }
        })().catch((e) => {
            ready = null; // let the next request try again
            throw e;
        });
    }
    return ready;
}
