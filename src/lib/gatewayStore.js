// Server-only payment gateway settings (collection: payment_gateways).
// Secrets (API secret keys) are never stored here; only the public key id and on/off/mode.
// The checkout is still a simulation: wire the chosen gateway's SDK into /api/bookings/pay.
import { col } from "@/lib/db";

const FIELDS = { projection: { _id: 0, id: 1, name: 1, enabled: 1, mode: 1, key_id: 1, updated_at: 1 } };

export async function listGateways() {
    const gateways = await col("payment_gateways");
    return gateways.find({}, FIELDS).sort({ name: 1 }).toArray();
}

export async function activeGateway() {
    const gateways = await col("payment_gateways");
    return gateways.findOne({ enabled: true }, { projection: { _id: 0, id: 1, name: 1 }, sort: { name: 1 } });
}

export async function updateGateway(id, patch) {
    const gateways = await col("payment_gateways");
    const c = await gateways.findOne({ id });
    if (!c) return null;
    const enabled = typeof patch.enabled === "boolean" ? patch.enabled : c.enabled;
    const mode = ["test", "live"].includes(patch.mode) ? patch.mode : c.mode;
    const keyId = patch.key_id !== undefined ? String(patch.key_id).trim().slice(0, 80) || null : c.key_id;
    return gateways.findOneAndUpdate(
        { id },
        { $set: { enabled, mode, key_id: keyId, updated_at: new Date() } },
        { returnDocument: "after", ...FIELDS },
    );
}
