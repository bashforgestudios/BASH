import { searchEventsCached } from "@/lib/eventStore";
import { ok, publicCache, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

// Public listing: published events only, without the heavy detail fields.
// ?limit=N (default 100, max 200). The X-Total-Count header holds how many events match in all.
export const GET = route(async (req) => {
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "", 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { events, total } = await searchEventsCached({
        city: sp.get("city") || undefined,
        genre: sp.get("genre") || undefined,
        q: (sp.get("q") || "").slice(0, 80) || undefined,
        club_id: sp.get("club_id") || undefined,
        lean: true,
        limit,
    });
    return ok(events, 200, { ...publicCache(15), "X-Total-Count": String(total) });
});
