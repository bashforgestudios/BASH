"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useNav } from "@/lib/useNav";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarPlus, Share2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import TicketPass from "@/components/TicketPass";
import { api, inr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function MyTicketsPage() {
    const { user, loading: authLoading } = useAuth();
    const nav = useNav();
    const sp = useSearchParams();
    const highlight = sp.get("new");
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("upcoming");

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            nav("/login?next=/tickets");
            return;
        }
        api.get("/bookings/me")
            .then((r) => setTickets(r.data))
            .finally(() => setLoading(false));
    }, [user, authLoading, nav]);

    // Past = already scanned at the gate, or no longer valid (rejected / cancelled).
    // Upcoming = everything still waiting to be used.
    const isPast = (t) => Boolean(t.used_at) || ["rejected", "cancelled"].includes(t.status);
    const upcoming = tickets.filter((t) => !isPast(t) && ["approved", "pending"].includes(t.status));
    const past = tickets.filter(isPast);
    const filtered = tab === "upcoming" ? upcoming : past;

    const share = async (t) => {
        const text = `🎟 I'm going to ${t.event_title} at ${t.event_venue} on ${t.event_date}! Ticket: ${t.ticket_code}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: "Bash Ticket", text });
            } else {
                await navigator.clipboard.writeText(text);
                alert("Ticket details copied!");
            }
        } catch {}
    };

    const addToCal = (t) => {
        const d = new Date(t.event_date + " " + t.event_time);
        if (Number.isNaN(d.getTime())) {
            alert("Could not read this event's date for the calendar.");
            return;
        }
        const start = encodeURIComponent(d.toISOString().replace(/[-:]|\.\d{3}/g, ""));
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.event_title)}&location=${encodeURIComponent(t.event_venue + ", " + t.event_city)}&dates=${start}/${start}`;
        window.open(url, "_blank");
    };

    return (
        <AppShell>
            <div className="max-w-3xl mx-auto px-5 md:px-10 py-6 md:py-10">
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => nav(-1)}
                        data-testid="tickets-back-btn"
                        className="md:hidden w-10 h-10 rounded-full bg-fg/5 flex items-center justify-center"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
                        Your Events
                    </h1>
                </div>

                <div
                    role="tablist"
                    className="grid grid-cols-2 gap-1 rounded-2xl bg-fg/5 border border-fg/10 p-1 mb-6 font-body text-sm"
                >
                    {[
                        ["upcoming", "Upcoming", upcoming.length],
                        ["past", "Past", past.length],
                    ].map(([id, label, n]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={tab === id}
                            data-testid={`filter-${id}`}
                            onClick={() => setTab(id)}
                            className={`rounded-xl px-4 py-2.5 transition ${
                                tab === id ? "bg-fg text-canvas font-semibold" : "text-fg/60 hover:text-fg"
                            }`}
                        >
                            {label} <span className="opacity-60">({n})</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-fg/50 font-body">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div
                        className="text-center py-20 text-fg/50 font-body"
                        data-testid="no-tickets-msg"
                    >
                        {tab === "upcoming" ? (
                            <>
                                No upcoming tickets.{" "}
                                <Link href="/" className="text-brand-ink underline">
                                    Browse events
                                </Link>
                            </>
                        ) : (
                            "No past events yet. Tickets move here once they're scanned at the gate."
                        )}
                    </div>
                ) : (
                    <div className="space-y-10">
                        {filtered.map((t, i) => (
                            <TicketStub
                                key={t.id}
                                ticket={t}
                                index={i}
                                highlighted={t.id === highlight}
                                onShare={() => share(t)}
                                onCal={() => addToCal(t)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function TicketStub({ ticket, index, highlighted, onShare, onCal }) {
    const canShare = ticket.status === "approved" && ticket.ticket_code;
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.08 }}
            data-testid={`ticket-${ticket.id}`}
            className="mx-auto w-full max-w-md"
        >
            <TicketPass ticket={ticket} highlighted={highlighted} />

            <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                    data-testid={`add-cal-${ticket.id}`}
                    onClick={onCal}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-fg/5 border border-fg/10 px-4 py-3.5 font-body text-sm hover:bg-fg/10 transition"
                >
                    <CalendarPlus className="w-4 h-4" /> Add to Calendar
                </button>
                <button
                    data-testid={`share-ticket-${ticket.id}`}
                    onClick={onShare}
                    disabled={!canShare}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-fg/5 border border-fg/10 px-4 py-3.5 font-body text-sm hover:bg-fg/10 transition disabled:opacity-40 disabled:hover:bg-fg/5"
                >
                    <Share2 className="w-4 h-4" /> Share
                </button>
            </div>
        </motion.div>
    );
}
