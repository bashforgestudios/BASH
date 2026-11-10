"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Map as MapIcon, CalendarDays, CalendarPlus, MapPin, Clock } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ACCENT = "#c8f169"; // volt, as in the reference design

/** "30 March 2026" + "9:30 PM" -> Date (or null when the text can't be read). */
export function ticketDate(t) {
    const d = new Date(`${t.event_date} ${t.event_time || ""}`.trim());
    if (!Number.isNaN(d.getTime())) return d;
    const d2 = new Date(t.event_date);
    return Number.isNaN(d2.getTime()) ? null : d2;
}

const keyOf = (y, m, d) => `${y}-${m}-${d}`;

/**
 * Full-screen "Events Calendar" sheet: months laid out as a grid, days with a ticket show the
 * event's photo as a circle with the date on top. Tap one to see it and add it to Google Calendar.
 */
export default function EventsCalendar({ tickets, selectedId, onClose, onAdd }) {
    const [activeId, setActiveId] = useState(selectedId);
    const scroller = useRef(null);

    // Tickets that have a readable date, grouped by day.
    const { byDay, months } = useMemo(() => {
        const byDay = new Map();
        let min = null;
        let max = null;
        for (const t of tickets) {
            const d = ticketDate(t);
            if (!d) continue;
            const k = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
            byDay.set(k, [...(byDay.get(k) || []), { t, d }]);
            const m = d.getFullYear() * 12 + d.getMonth();
            min = min == null ? m : Math.min(min, m);
            max = max == null ? m : Math.max(max, m);
        }
        const sel = tickets.find((t) => t.id === selectedId);
        const sd = sel && ticketDate(sel);
        const start = sd ? sd.getFullYear() * 12 + sd.getMonth() : min ?? new Date().getFullYear() * 12 + new Date().getMonth();
        const from = Math.min(start, min ?? start);
        const to = Math.min(Math.max(start + 1, max ?? start), from + 11); // at least 2 months, at most a year
        const months = [];
        for (let m = from; m <= to; m++) months.push({ y: Math.floor(m / 12), m: m % 12 });
        return { byDay, months };
    }, [tickets, selectedId]);

    const active = tickets.find((t) => t.id === activeId);

    // Scroll the chosen event's month into view and close on Escape.
    useEffect(() => {
        scroller.current?.querySelector("[data-selected='true']")?.scrollIntoView({ block: "center" });
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const today = new Date();
    const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
    const mapUrl = active
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${active.event_venue || ""} ${active.event_city || ""}`)}`
        : "#";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Events Calendar"
                data-testid="events-calendar"
                className="on-media flex h-full w-full flex-col overflow-hidden bg-[#1a1a1a] sm:h-[min(820px,94vh)] sm:max-w-[400px] sm:rounded-[2.5rem] sm:border sm:border-white/10 sm:shadow-2xl"
            >
                {/* Title bar */}
                <div className="relative flex items-center justify-center px-5 pb-3 pt-5">
                    <button
                        onClick={onClose}
                        aria-label="Back"
                        data-testid="calendar-back"
                        className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="font-body text-base font-semibold text-white">Events Calendar</h2>
                </div>

                {/* Tabs: venue map · calendar (current) · add to Google Calendar */}
                <div className="grid grid-cols-3 border-b border-white/10">
                    <a
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open venue in maps"
                        className="flex justify-center py-3 text-white/50 transition hover:text-white"
                    >
                        <MapIcon className="h-5 w-5" />
                    </a>
                    <div className="flex justify-center border-b-2 py-3" style={{ borderColor: ACCENT, color: ACCENT }} aria-current="page">
                        <CalendarDays className="h-5 w-5" />
                    </div>
                    <button
                        onClick={() => active && onAdd(active)}
                        disabled={!active}
                        aria-label="Add to Google Calendar"
                        data-testid="calendar-add-tab"
                        className="flex justify-center py-3 text-white/50 transition hover:text-white disabled:opacity-30"
                    >
                        <CalendarPlus className="h-5 w-5" />
                    </button>
                </div>

                {/* Months */}
                <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
                    {months.map(({ y, m }) => {
                        const lead = new Date(y, m, 1).getDay();
                        const count = new Date(y, m + 1, 0).getDate();
                        return (
                            <section key={`${y}-${m}`} className="mb-8">
                                <h3 className="mb-4 text-center font-body text-sm font-semibold text-white">
                                    {MONTHS[m]} {y}
                                </h3>
                                <div className="mb-2 grid grid-cols-7 text-center font-body text-[11px] text-white/60">
                                    {DAYS.map((d) => (
                                        <div key={d}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-y-3 text-center">
                                    {Array.from({ length: lead }).map((_, i) => (
                                        <div key={`e${i}`} />
                                    ))}
                                    {Array.from({ length: count }).map((_, i) => {
                                        const day = i + 1;
                                        const k = keyOf(y, m, day);
                                        const events = byDay.get(k);
                                        const first = events?.[0];
                                        const isActive = events?.some((e) => e.t.id === activeId);
                                        return (
                                            <div key={day} className="flex items-center justify-center">
                                                {first ? (
                                                    <button
                                                        onClick={() => setActiveId(first.t.id)}
                                                        data-selected={isActive ? "true" : undefined}
                                                        data-testid={`cal-day-${k}`}
                                                        aria-label={`${first.t.event_title}, ${day} ${MONTHS[m]}`}
                                                        className={`relative h-9 w-9 overflow-hidden rounded-full transition ${
                                                            isActive ? "scale-110 ring-2 ring-offset-2 ring-offset-[#1a1a1a]" : "ring-0"
                                                        }`}
                                                        style={isActive ? { "--tw-ring-color": ACCENT } : undefined}
                                                    >
                                                        {first.t.event_image ? (
                                                            <img src={first.t.event_image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="absolute inset-0 bg-gradient-to-br from-[#e8431f] to-[#7a1f0c]" />
                                                        )}
                                                        <span className="absolute inset-0 bg-black/45" />
                                                        <span className="relative font-body text-xs font-semibold text-white">{day}</span>
                                                        {events.length > 1 && (
                                                            <span className="absolute -right-0.5 -top-0.5 h-3 min-w-3 rounded-full bg-white px-0.5 text-[8px] font-bold leading-3 text-black">
                                                                {events.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className={`flex h-9 w-9 items-center justify-center font-body text-xs ${
                                                            k === todayKey ? "rounded-full border border-white/40 text-white" : "text-white/80"
                                                        }`}
                                                    >
                                                        {day}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>

                {/* Selected event */}
                {active && (
                    <div className="border-t border-white/10 bg-[#222] p-4" data-testid="calendar-active">
                        <div className="flex items-center gap-3">
                            {active.event_image && (
                                <img src={active.event_image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                            )}
                            <div className="min-w-0">
                                <div className="truncate font-display text-base font-semibold text-white">{active.event_title}</div>
                                <div className="mt-0.5 flex items-center gap-3 font-body text-[11px] text-white/60">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{active.event_date} · {active.event_time}</span>
                                </div>
                                <div className="flex items-center gap-1 truncate font-body text-[11px] text-white/60">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {active.event_venue}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => onAdd(active)}
                            data-testid="calendar-add-google"
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-body text-sm font-semibold text-black transition hover:brightness-95"
                            style={{ background: ACCENT }}
                        >
                            <CalendarPlus className="h-4 w-4" /> Add to Google Calendar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
