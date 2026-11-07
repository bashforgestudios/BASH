// Server-only: gate accounts belong to one club. Club admins create and remove them.
import { col } from "@/lib/db";
import { bumpTokenVersion, createUser } from "@/lib/auth";

export async function listGates(clubId) {
    const users = await col("users");
    return users
        .find({ role: "gate", club_id: clubId }, { projection: { _id: 0, id: 1, name: 1, email: 1, created_at: 1 } })
        .sort({ created_at: -1 })
        .toArray();
}

/** Returns the new user, or null when the email is already registered. */
export async function createGate({ clubId, name, email, password }) {
    return createUser({ name, email, password, role: "gate", club_id: clubId });
}

/** Demotes a gate account back to a normal user. Returns false if it is not one of this club's gates. */
export async function removeGate(id, clubId) {
    const users = await col("users");
    const res = await users.updateOne({ id, role: "gate", club_id: clubId }, { $set: { role: "user", club_id: null } });
    if (!res.modifiedCount) return false;
    await bumpTokenVersion(id); // the gate's current sessions stop working immediately
    return true;
}
