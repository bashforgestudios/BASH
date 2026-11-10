"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import EventsCalendar from "@/components/EventsCalendar";
import { api } from "@/lib/api";
import { openGoogleCalendar, ticketDate } from "@/lib/calendar";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY = 24 * 3600 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function whenText(d) {
    const n = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
    if (n <= 0) return "tonight";
    if (n === 1) return "tomorrow";
    return `in ${n} days`;
}

/**
 * A tear-off calendar card: the date tile shows your next event, a strip of photos shows what's
 * coming, and tapping it opens the Events Calendar with every ticket on it.
 * Pass `tickets` when the page already has them; otherwise the card loads them itself.
 */
export default function CalendarLauncher({ tickets: given, className = "" }) {
    const [loaded, setLoaded] = useState(null);
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (given) return;
        let live = true;
        api.get("/bookings/me")
            .then((r) => live && setLoaded(r.data))
            .catch(() => live && setLoaded([]));
        return () => {
            live = false;
        };
    }, [given]);

    const tickets = given ?? loaded;

    const { valid, upcoming } = useMemo(() => {
        const valid = (tickets || []).filter((t) => !["rejected", "cancelled"].includes(t.status));
        const cutoff = Date.now() - 6 * 3600 * 1000; // an event happening tonight still counts as next
        const upcoming = valid
            .filter((t) => !t.used_at)
            .map((t) => ({ t, d: ticketDate(t) }))
            .filter((x) => x.d && x.d.getTime() >= cutoff)
            .sort((a, b) => a.d - b.d);
        return { valid, upcoming };
    }, [tickets]);

    const next = upcoming[0];
    const photos = upcoming.filter((x) => x.t.event_image).slice(0, 4);
    const more = upcoming.length - photos.length;

    let sub = "Loading your events…";
    if (tickets) sub = next ? `Next: ${next.t.event_title} · ${whenText(next.d)}` : "Nothing planned yet. Tap to browse your calendar.";

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                data-testid="calendar-launcher"
                aria-label="Open your event calendar"
                className={`group relative w-full overflow-hidden rounded-3xl border border-fg/10 bg-gradient-to-br from-fg/10 to-fg/[0.03] p-4 text-left transition hover:border-fg/25 active:scale-[0.99] ${className}`}
            >
                <div className="flex items-center gap-4">
                    {/* tear-off date tile */}
                    <div className="relative h-[72px] w-16 shrink-0 -rotate-3 overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-lg transition-transform duration-300 group-hover:rotate-0">
                        <div className="bg-[#e8431f] py-1 text-center font-body text-[10px] font-bold tracking-widest text-white">
                            {next ? MON[next.d.getMonth()] : "BASH"}
                        </div>
                        <span aria-hidden className="absolute left-3 top-0 h-2 w-1 rounded-b-full bg-neutral-900/70" />
                        <span aria-hidden className="absolute right-3 top-0 h-2 w-1 rounded-b-full bg-neutral-900/70" />
                        <div className="flex h-[46px] items-center justify-center font-display text-3xl font-bold">
                            {next ? next.d.getDate() : <CalendarDays className="h-7 w-7 text-neutral-400" />}
                        </div>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="font-display text-lg font-semibold leading-tight">Your event calendar</div>
                        <div className="mt-0.5 truncate font-body text-sm text-fg/60">{sub}</div>
                        {photos.length > 0 && (
                            <div className="mt-2.5 flex items-center">
                                {photos.map((x, i) => (
                                    <img
                                        key={x.t.id}
                                        src={x.t.event_image}
                                        alt=""
                                        className={`h-7 w-7 rounded-full border-2 border-canvas object-cover ${i ? "-ml-2" : ""}`}
                                        onError={(e) => (e.currentTarget.style.display = "none")}
                                    />
                                ))}
                                {more > 0 && <span className="ml-2 font-body text-xs text-fg/50">+{more}</span>}
                            </div>
                        )}
                    </div>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg/10 transition group-hover:bg-fg group-hover:text-canvas">
                        <ChevronRight className="h-4 w-4" />
                    </span>
                </div>
            </button>

            {open && <EventsCalendar tickets={valid} selectedId={next?.t.id ?? valid[0]?.id ?? null} onClose={close} onAdd={openGoogleCalendar} />}
        </>
    );
}
