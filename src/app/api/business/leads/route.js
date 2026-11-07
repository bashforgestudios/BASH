import { allow, clientIp } from "@/lib/auth";
import { createLead } from "@/lib/leadStore";
import { notifyNewLead } from "@/lib/email";
import { fail, ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Public: a club asks to join. No account is created here. The Bash team follows up and
// onboards the club from the Developer panel (Leads tab).
export const POST = route(async (req) => {
    if (!(await allow(`lead:ip:${clientIp(req)}`, 5, 60 * 60 * 1000))) return fail("Too many requests. Try again later.", 429);
    const body = await req.json().catch(() => ({}));
    // Honeypot: real people never see or fill this field. Pretend it worked.
    if (body.company_site) return ok({ ok: true }, 201);

    const lead = await createLead(body);
    await notifyNewLead(lead);
    return ok({ ok: true }, 201);
});
