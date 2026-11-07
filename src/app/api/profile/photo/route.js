import { requireUser } from "@/lib/roles";
import { setProfilePhoto } from "@/lib/profileStore";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Body: { slot: "top" | "side", data_url }
export const POST = route(async (req) => {
    const { user, error } = await requireUser(req);
    if (error) return error;
    const b = await req.json().catch(() => ({}));
    return ok(await setProfilePhoto(user.id, String(b.slot ?? ""), b.data_url));
});
