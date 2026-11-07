import { requireUser } from "@/lib/roles";
import { listBookingsForUser } from "@/lib/bookingStore";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
    const { user, error } = await requireUser(req);
    if (error) return error;
    return ok(await listBookingsForUser(user.id));
});
