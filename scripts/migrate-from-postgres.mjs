// One-time import of the old Neon Postgres data into MongoDB.
//
//   DATABASE_URL=<neon url> MONGODB_URI=<mongo url> node scripts/migrate-from-postgres.mjs
//
// Safe to run more than once: every row is upserted by its id. Existing Mongo data is not deleted.
// Passwords keep working (same scrypt hashes). Everyone signs in again because sessions are now JWT cookies.
import { neon } from "@neondatabase/serverless";
import { MongoClient } from "mongodb";
import { setServers } from "node:dns";

const { DATABASE_URL, MONGODB_URI, MONGODB_DB = "bash" } = process.env;
if (!DATABASE_URL || !MONGODB_URI) {
    console.error("Set DATABASE_URL (old Neon) and MONGODB_URI (new MongoDB).");
    process.exit(1);
}

const sql = neon(DATABASE_URL);
const q = (text) => (typeof sql.query === "function" ? sql.query(text) : sql(text));
setServers(["1.1.1.1"]);
const mongo = await new MongoClient(MONGODB_URI).connect();
const db = mongo.db(MONGODB_DB);

async function copy(table, collection, { key = "id", map = (r) => r } = {}) {
    let rows;
    try {
        rows = await q(`SELECT * FROM ${table}`);
    } catch (e) {
        console.log(`- ${table}: skipped (${e.message})`);
        return;
    }
    if (!rows.length) return console.log(`- ${table}: 0 rows`);
    const ops = rows.map((r) => {
        const doc = map(r);
        return { replaceOne: { filter: { [key]: doc[key] }, replacement: doc, upsert: true } };
    });
    await db.collection(collection).bulkWrite(ops, { ordered: false });
    console.log(`- ${table}: ${rows.length} rows -> ${collection}`);
}

// jsonb tables (events, clubs) become flat documents
const flat = (r) => ({ ...r.data, id: r.id, created_at: r.created_at });

await copy("users", "users", {
    map: (r) => ({ ...r, dob: r.dob ? new Date(r.dob).toISOString().slice(0, 10) : null, token_version: 0 }),
});
await copy("events", "events", { map: flat });
await copy("clubs", "clubs", { map: flat });
await copy("bookings", "bookings");
await copy("id_photos", "id_photos", { key: "booking_id" });
await copy("scan_logs", "scan_logs");
await copy("email_logs", "email_logs");
await copy("payment_gateways", "payment_gateways");
await copy("business_leads", "business_leads");
await copy("club_applications", "club_applications", { key: "club_id" });
await copy("club_documents", "club_documents");
await copy("assets", "assets");

await mongo.close();
console.log("Done. Start the app once so it creates the indexes, then sign in again.");
