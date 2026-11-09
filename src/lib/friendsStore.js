// Server-only: "which of my contacts are going to this event".
//
// Privacy rules
//   - The caller sends phone numbers from their own address book. They are used for this one lookup and
//     are never stored or logged.
//   - Only accounts that switched on "Let contacts find me" (users.contacts_discoverable) can match.
//   - A match only counts when that account has a paid or approved booking for the event.
//   - The reply holds just the matched number and the account's display name, nothing else.
import { col } from "@/lib/db";
import { normalizePhone, phoneForms } from "@/lib/phone";

export const MAX_NUMBERS = 2000;

export async function friendsGoing({ eventId, viewerId, phones }) {
    const wanted = new Set();
    for (const raw of phones.slice(0, MAX_NUMBERS)) {
        const d = normalizePhone(raw);
        if (d) wanted.add(d);
    }
    if (!wanted.size) return { friends: [], checked: 0 };

    const forms = [...wanted].flatMap(phoneForms);
    const users = await col("users");
    const candidates = await users
        .find(
            { phone: { $in: forms }, contacts_discoverable: true, id: { $ne: viewerId } },
            { projection: { _id: 0, id: 1, name: 1, phone: 1 } },
        )
        .toArray();
    if (!candidates.length) return { friends: [], checked: wanted.size };

    const bookings = await col("bookings");
    const going = new Set(
        await bookings.distinct("user_id", {
            event_id: eventId,
            user_id: { $in: candidates.map((c) => c.id) },
            status: { $in: ["approved", "pending"] },
        }),
    );

    const friends = candidates
        .filter((c) => going.has(c.id))
        .map((c) => ({ phone: normalizePhone(c.phone), name: String(c.name).split(" ")[0] }));
    return { friends, checked: wanted.size };
}
