import { requireRole } from "@/lib/roles";
import { updateLead } from "@/lib/leadStore";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Developer: change a lead's status or save call notes.
export const PATCH = route(async (req, { params }) => {
    const { error } = await requireRole(req, ["developer"]);
    if (error) return error;
    const b = await req.json().catch(() => ({}));
    return ok(await updateLead(params.id, { status: b.status, dev_notes: b.dev_notes }));
});
