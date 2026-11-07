import { requireRole } from "@/lib/roles";
import { convertLead } from "@/lib/leadStore";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Developer: start onboarding. Creates the hidden club, a prefilled application and the club admin login.
export const POST = route(async (req, { params }) => {
    const { error } = await requireRole(req, ["developer"]);
    if (error) return error;
    return ok(await convertLead(params.id), 201);
});
