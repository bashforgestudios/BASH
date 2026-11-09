import { requireUser } from "@/lib/roles";
import { getProfile, updateDetails } from "@/lib/profileStore";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Any signed-in user: their own profile.
export const GET = route(async (req) => {
    const { user, error } = await requireUser(req);
    if (error) return error;
    return ok(await getProfile(user.id));
});

// Body: any of { name, phone, city, instagram, discoverable }
export const PATCH = route(async (req) => {
    const { user, error } = await requireUser(req);
    if (error) return error;
    const b = await req.json().catch(() => ({}));
    return ok(await updateDetails(user.id, b));
});
