"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Bell } from "lucide-react";
import AppShell from "@/components/AppShell";
import EventCard from "@/components/EventCard";
import ClubCard from "@/components/ClubCard";
import LocationChip from "@/components/LocationChip";
import { api } from "@/lib/api";
import { CITIES, DEFAULT_CITY } from "@/lib/geo";
import { useLocation } from "@/lib/useLocation";

const CITY_OPTIONS = [{ slug: "all", name: "All India" }, ...CITIES];

const GENRES = [
    { slug: "all", name: "All", img: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=120" },
    { slug: "pop", name: "Pop", img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120" },
    { slug: "rock", name: "Rock", img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120" },
    { slug: "edm", name: "EDM", img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=120" },
    { slug: "hiphop", name: "Hip Hop", img: "https://images.pexels.com/photos/8448547/pexels-photo-8448547.jpeg?w=120" },
    { slug: "techno", name: "Techno", img: "https://images.unsplash.com/photo-1517983079452-bbaa6a081a6b?w=120" },
    { slug: "house", name: "House", img: "https://images.unsplash.com/photo-1517983079452-bbaa6a081a6b?w=120" },
    { slug: "bollywood", name: "Bollywood", img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120" },
    { slug: "classical", name: "Classical", img: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=120" },
];

export default function HomePage() {
    const location = useLocation();
    // The city row overrides the detected city until the detected city changes.
    const [pick, setPick] = useState(null);
    useEffect(() => setPick(null), [location.city]);
    const city = pick ?? (location.city || DEFAULT_CITY);
    const cityName = CITY_OPTIONS.find((c) => c.slug === city)?.name || "Pune";

    const [events, setEvents] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [club, setClub] = useState(null);
    const [genre, setGenre] = useState("all");
    const [q, setQ] = useState("");
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // Wait for a pause in typing before searching: one request per word instead of one per key.
    const [dq, setDq] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDq(q.trim()), 250);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        const cityParam = city === "all" ? undefined : city;
        api.get("/clubs", { params: { city: cityParam } }).then((r) => setClubs(r.data)).catch(() => setClubs([]));
    }, [city]);

    useEffect(() => {
        setLoading(true);
        // Cancel the previous request when the filters change, so a slow old answer can never
        // overwrite a newer one.
        const ctrl = new AbortController();
        api.get("/events", {
            signal: ctrl.signal,
            params: {
                city: city === "all" ? undefined : city,
                genre,
                q: dq || undefined,
                club_id: club || undefined,
            },
        })
            .then((r) => {
                setEvents(r.data);
                setTotal(Number(r.headers["x-total-count"]) || r.data.length);
                setLoading(false);
            })
            .catch((e) => {
                if (e.code !== "ERR_CANCELED") setLoading(false);
            });
        return () => ctrl.abort();
    }, [city, genre, dq, club]);

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-5 md:px-10 py-6 md:py-10">
                {/* Mobile top bar */}
                <div className="md:hidden flex items-start justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center font-display font-bold">
                                B
                            </div>
                            <div className="font-display text-xl">Live Now</div>
                        </div>
                        <LocationChip className="mt-2" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            data-testid="search-icon-btn"
                            className="w-10 h-10 rounded-full bg-fg/5 flex items-center justify-center"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                        <button
                            data-testid="bell-icon-btn"
                            className="w-10 h-10 rounded-full bg-fg flex items-center justify-center"
                        >
                            <Bell className="w-4 h-4 text-canvas" />
                        </button>
                    </div>
                </div>

                {/* Desktop hero */}
                <div className="hidden md:block mb-10">
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-display text-5xl lg:text-7xl font-bold tracking-tight"
                    >
                        Tonight is{" "}
                        <span className="text-brand-ink">
                            calling.
                        </span>
                    </motion.h1>
                    <p className="font-body text-fg/60 mt-3 max-w-xl">
                        Live concerts, club nights and festivals across India — booked in under 60 seconds.
                    </p>
                </div>

                {/* City row */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-display text-lg font-semibold">Pick your city</h2>
                        <span className="text-xs text-fg/50 font-body">{total} events</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 md:mx-0 md:px-0">
                        {CITY_OPTIONS.map((c) => (
                            <button
                                key={c.slug}
                                data-testid={`city-${c.slug}`}
                                onClick={() => {
                                    setPick(c.slug);
                                    setClub(null);
                                }}
                                className={`shrink-0 rounded-full px-4 py-2 font-body text-sm border transition ${
                                    city === c.slug
                                        ? "bg-fg text-canvas border-fg"
                                        : "bg-fg/5 text-fg/80 border-fg/10 hover:bg-fg/10"
                                }`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Clubs in the detected city */}
                {clubs.length > 0 && (
                    <div className="mb-8" data-testid="clubs-strip">
                        <h2 className="font-display text-lg font-semibold mb-3">
                            Clubs in {cityName}
                        </h2>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 md:mx-0 md:px-0">
                            {clubs.map((c) => (
                                <ClubCard
                                    key={c.id}
                                    club={c}
                                    selected={club === c.id}
                                    onSelect={setClub}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Genre bubbles */}
                <div className="mb-8">
                    <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 md:mx-0 md:px-0">
                        {GENRES.map((g) => (
                            <button
                                key={g.slug}
                                data-testid={`genre-${g.slug}`}
                                onClick={() => setGenre(g.slug)}
                                className="shrink-0 flex flex-col items-center gap-2 group"
                            >
                                <div
                                    className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden ring-2 transition ${
                                        genre === g.slug ? "ring-brand" : "ring-fg/10 group-hover:ring-fg/30"
                                    }`}
                                >
                                    <img loading="lazy" decoding="async" src={g.img} alt={g.name} className="w-full h-full object-cover" />
                                </div>
                                <span className={`text-xs font-body ${genre === g.slug ? "text-fg" : "text-fg/60"}`}>
                                    {g.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search */}
                <div className="mb-6 relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
                    <input
                        data-testid="search-input"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search Coldplay, Nucleya, Di Mora…"
                        className="w-full rounded-full bg-fg/5 border border-fg/10 pl-11 pr-4 py-3 font-body text-sm placeholder:text-fg/30 focus:outline-none focus:ring-2 focus:ring-brand/50"
                    />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {loading
                        ? Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="h-[420px] rounded-3xl bg-fg/5 animate-pulse" />
                          ))
                        : events.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}
                </div>

                {!loading && events.length === 0 && (
                    <div className="text-center py-20 text-fg/50 font-body" data-testid="no-events-msg">
                        No events found. Try a different city, club or genre.
                    </div>
                )}
            </div>
        </AppShell>
    );
}
