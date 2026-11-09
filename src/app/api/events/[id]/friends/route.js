import { allow } from "@/lib/auth";
import { requireUser } from "@/lib/roles";
import { getEvent } from "@/lib/eventStore";
import { friendsGoing, MAX_NUMBERS } from "@/lib/friendsStore";
import { fail, ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Body: { phones: ["98xxxxxxxx", ...] } from the person's own address book.
// Returns { friends: [{ phone, name }], checked }. See lib/friendsStore.js for the privacy rules.
export const POST = route(async (req, { params }) => {
    const { user, error } = await requireUser(req);
    if (error) return error;

    // stops someone from scanning many numbers to find out who is attending
    if (!(await allow(`friends:${user.id}`, 30, 60 * 60 * 1000))) return fail("Too many checks. Try again later.", 429);

    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.phones)) return fail("phones must be a list", 422);
    if (body.phones.length > MAX_NUMBERS) return fail(`Send at most ${MAX_NUMBERS} numbers at a time`, 422);

    const event = await getEvent(params.id);
    if (!event) return fail("Event not found", 404);

    return ok(await friendsGoing({ eventId: event.id, viewerId: user.id, phones: body.phones.map(String) }));
});
