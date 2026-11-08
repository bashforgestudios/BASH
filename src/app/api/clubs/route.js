import { listClubs } from "@/lib/clubStore";
import { ok, publicCache, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
    const city = new URL(req.url).searchParams.get("city") || undefined;
    return ok(await listClubs({ city }), 200, publicCache(60));
});
