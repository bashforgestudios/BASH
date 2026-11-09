"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNav } from "@/lib/useNav";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
    Camera, Copy, Instagram, Loader2, Check, LogOut, KeyRound, Bell,
    ChevronRight, ChevronLeft, ChevronDown, ChevronsDown, CalendarDays, CheckCircle2, RotateCw, Eye, EyeOff, Pencil, Settings,
    ArrowLeft, Sun, Moon, Monitor, Clock, MoreVertical, Ticket, Palette, QrCode, Compass, Lock, Users, X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import QRCode from "@/components/QRCode";
import Modal from "@/components/Modal";
import { LogoMark, Wordmark } from "@/components/Logo";
import { Btn, Field, inputCls } from "@/components/PanelUI";
import { api, formatErr, resizeImg } from "@/lib/api";
import { CITIES } from "@/lib/geo";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/lib/useTheme";

const errText = (e) => formatErr(e?.response?.data?.detail) || e?.message || "Something went wrong";
const cityName = (slug) => CITIES.find((c) => c.slug === slug)?.name || "";
const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const PREF_KEY = "bash_prefs";
const MOOD_KEY = "bash_mood";
const PREFS = [
    ["reminders", "Event reminders", "A nudge the day before your event"],
    ["booking", "Booking updates", "Approvals, rejections and payment receipts"],
    ["offers", "Offers & new drops", "Presales and events in your city"],
];
const MOODS = [
    ["🔥", "Hyped"],
    ["🥳", "Party mode"],
    ["😎", "Chill"],
    ["🎧", "In the music"],
    ["🍸", "Out for drinks"],
    ["😴", "Low-key"],
];

const PULL_TRIGGER = 60; // px of (dampened) pull needed to open the profile card
const THEME_LABEL = { light: "Light", dark: "Dark", system: "Device", time: "Time of day" };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
    const { user, loading, logout } = useAuth();
    const nav = useNav();
    const { mode } = useTheme();
    const [profile, setProfile] = useState(null);
    const [busy, setBusy] = useState(null); // "top" | "side" (photo uploads)
    const [sheet, setSheet] = useState(null); // edit | settings | appearance | notifications | password | logout | visibility
    const [cardOpen, setCardOpen] = useState(false);
    const [tickets, setTickets] = useState(null);
    const [mood, setMoodState] = useState(null);
    const [pull, setPull] = useState(0);
    const startY = useRef(null);

    useEffect(() => {
        if (!loading && !user) nav("/login?next=/profile");
    }, [loading, user, nav]);

    const load = useCallback(
        () =>
            api
                .get("/profile")
                .then((r) => setProfile(r.data))
                .catch((e) => toast.error(errText(e))),
        [],
    );

    useEffect(() => {
        if (user) load();
    }, [user, load]);

    // Mood is a fun, on-this-device-only status.
    useEffect(() => {
        try {
            const m = localStorage.getItem(MOOD_KEY);
            if (m) setMoodState(MOODS.find(([e]) => e === m) || null);
        } catch {}
    }, []);
    const setMood = (m) => {
        setMoodState(m);
        try {
            if (m) localStorage.setItem(MOOD_KEY, m[0]);
            else localStorage.removeItem(MOOD_KEY);
        } catch {}
    };

    // Tickets shown inside the profile card are fetched the first time it opens.
    useEffect(() => {
        if (cardOpen && tickets === null) {
            api
                .get("/bookings/me")
                .then((r) => setTickets(r.data))
                .catch(() => setTickets([]));
        }
    }, [cardOpen, tickets]);

    // Lock page scroll and allow Escape to close while the card is open.
    useEffect(() => {
        if (!cardOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => e.key === "Escape" && !sheet && setCardOpen(false);
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
        };
    }, [cardOpen, sheet]);

    const onPhoto = (slot, file) => {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Use a JPG, PNG or WebP photo");
        if (file.size > 2 * 1024 * 1024) return toast.error("Photo must be under 2 MB");
        const reader = new FileReader();
        reader.onload = async () => {
            setBusy(slot);
            try {
                const { data } = await api.post("/profile/photo", { slot, data_url: reader.result });
                setProfile(data);
                toast.success("Photo updated");
            } catch (e) {
                toast.error(errText(e));
            } finally {
                setBusy(null);
            }
        };
        reader.readAsDataURL(file);
    };

    const copyId = () =>
        navigator.clipboard
            ?.writeText(profile.bash_id)
            .then(() => toast.success("Bash ID copied"))
            .catch(() => toast.error("Could not copy"));

    // Pull down from the top of the page to open the profile card (touch), or scroll up / tap on desktop.
    const touch = {
        onTouchStart: (e) => {
            startY.current = window.scrollY <= 0 && !cardOpen ? e.touches[0].clientY : null;
        },
        onTouchMove: (e) => {
            if (startY.current == null) return;
            const dy = e.touches[0].clientY - startY.current;
            setPull(dy > 0 ? Math.min(dy * 0.5, 90) : 0);
        },
        onTouchEnd: () => {
            if (startY.current == null) return;
            startY.current = null;
            if (pull >= PULL_TRIGGER) setCardOpen(true);
            setPull(0);
        },
        onWheel: (e) => {
            if (!cardOpen && window.scrollY <= 0 && e.deltaY < -50) setCardOpen(true);
        },
    };

    if (loading || !user || !profile) {
        return (
            <AppShell>
                <div className="p-10 text-fg/60 font-body">Loading…</div>
            </AppShell>
        );
    }

    const visibleTo = profile.discoverable ? "Contacts" : "Only me";
    const close = () => setSheet(null);

    return (
        <AppShell>
            <div className="max-w-xl mx-auto pb-10" {...touch} data-testid="profile-page">
                <Hero
                    profile={profile}
                    busy={busy}
                    onPhoto={onPhoto}
                    mood={mood}
                    setMood={setMood}
                    pull={pull}
                    onBack={() => nav(-1)}
                    onEdit={() => setSheet("edit")}
                    onMenu={() => setSheet("settings")}
                    onOpen={() => setCardOpen(true)}
                />

                <div className="px-4 space-y-7 mt-6">
                    <Link
                        href="/"
                        className="on-media relative block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f0e0d] via-[#1b1512] to-brand/40 px-5 py-6"
                    >
                        <div className="font-body text-lg text-white/80">Out tonight?</div>
                        <div className="font-display text-2xl font-bold mt-0.5">See what&apos;s live now</div>
                        <div className="inline-flex items-center gap-1 font-body text-sm mt-5">
                            Explore <ChevronRight className="w-4 h-4" />
                        </div>
                        <Ticket className="absolute right-5 top-1/2 -translate-y-1/2 w-20 h-20 text-white/15 -rotate-12" />
                    </Link>

                    <Section title="Tickets">
                        <Row icon={Ticket} label="My Tickets" value={String(profile.stats.tickets)} href="/tickets" />
                        <Row icon={QrCode} label="Bash ID & QR" onClick={() => setCardOpen(true)} testid="open-bash-id" />
                        <Row icon={Compass} label="Live Now" href="/" />
                    </Section>

                    <Section title="Manage">
                        <Row icon={Pencil} label="Edit profile" onClick={() => setSheet("edit")} testid="edit-profile" />
                        <Row icon={Palette} label="Appearance" value={THEME_LABEL[mode]} onClick={() => setSheet("appearance")} />
                        <Row icon={Bell} label="Notifications" onClick={() => setSheet("notifications")} />
                        <Row icon={Eye} label="Event visibility" value={visibleTo} onClick={() => setSheet("visibility")} testid="open-visibility" />
                        <Row icon={KeyRound} label="Change password" onClick={() => setSheet("password")} />
                    </Section>

                    <Section title="More">
                        <Row icon={Settings} label="Account settings" onClick={() => setSheet("settings")} testid="open-settings" />
                    </Section>
                    <Section>
                        <Row icon={LogOut} label="Log out" onClick={() => setSheet("logout")} testid="profile-logout-row" />
                    </Section>

                    <div className="flex items-center gap-2 pt-2 text-fg/40">
                        <LogoMark size={24} className="text-brand-fg" />
                        <Wordmark className="text-lg" />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {cardOpen && (
                    <ProfileCard
                        profile={profile}
                        busy={busy}
                        onPhoto={onPhoto}
                        copyId={copyId}
                        mood={mood}
                        setMood={setMood}
                        tickets={tickets}
                        onClose={() => setCardOpen(false)}
                        onEdit={() => setSheet("edit")}
                        onMenu={() => setSheet("settings")}
                        onVisibility={() => setSheet("visibility")}
                    />
                )}
            </AnimatePresence>

            <EditProfileModal open={sheet === "edit"} onClose={close} profile={profile} setProfile={setProfile} />
            <SettingsModal
                open={sheet === "settings"}
                onClose={close}
                email={profile.email}
                profile={profile}
                setProfile={setProfile}
                onLogout={async () => {
                    await logout();
                    nav("/");
                }}
            />
            <Modal open={sheet === "appearance"} onClose={close} title="Appearance" subtitle="Saved on this device.">
                <Appearance />
                <div className="flex justify-end pt-2">
                    <Btn onClick={close}>Done</Btn>
                </div>
            </Modal>
            <Modal open={sheet === "notifications"} onClose={close} title="Notifications" subtitle="Saved on this device.">
                <Preferences />
                <div className="flex justify-end pt-2">
                    <Btn onClick={close}>Done</Btn>
                </div>
            </Modal>
            {sheet === "password" && <PasswordView open onBack={close} onClose={close} />}
            <Modal open={sheet === "logout"} onClose={close} title="Log out?" subtitle="You will need to sign in again on this device.">
                <div className="flex justify-end gap-2">
                    <Btn type="button" onClick={close} data-testid="cancel-logout">Cancel</Btn>
                    <Btn
                        variant="danger"
                        data-testid="profile-logout"
                        onClick={async () => {
                            await logout();
                            nav("/");
                        }}
                    >
                        <LogOut className="w-4 h-4" /> Log out
                    </Btn>
                </div>
            </Modal>
            <VisibilitySheet open={sheet === "visibility"} onClose={close} profile={profile} setProfile={setProfile} />
        </AppShell>
    );
}

/* ------------------------------------------------------------------ */
/* Hero: avatar, mood, name, "Pull to view profile"                    */
/* ------------------------------------------------------------------ */

const circleBtn =
    "w-11 h-11 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur flex items-center justify-center transition text-white";

function Hero({ profile, busy, onPhoto, mood, setMood, pull, onBack, onEdit, onMenu, onOpen }) {
    const ready = pull >= PULL_TRIGGER;
    return (
        <div
            className="on-media relative overflow-hidden rounded-b-[32px] border-x border-b border-white/10 pb-5 md:mt-4 md:rounded-[32px] md:border-t"
            style={{
                background:
                    "radial-gradient(120% 75% at 50% 0%, rgba(214,214,236,0.55) 0%, rgba(120,120,140,0.28) 38%, #131211 88%)",
            }}
        >
            {profile.photo_top && (
                <img
                    src={profile.photo_top}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-35 pointer-events-none"
                />
            )}

            <div className="relative flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)]">
                <button type="button" onClick={onBack} aria-label="Back" className={circleBtn}>
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={onEdit} aria-label="Edit profile" data-testid="edit-profile-top" className={circleBtn}>
                        <Pencil className="w-[18px] h-[18px]" />
                    </button>
                    <button type="button" onClick={onMenu} aria-label="More" className={circleBtn}>
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="relative px-4 pt-4 transition-transform" style={{ transform: `translateY(${pull * 0.5}px)` }}>
                <Avatar profile={profile} busy={busy} onPhoto={onPhoto} mood={mood} setMood={setMood} />
                <div className="text-center mt-9 font-display text-[26px] font-semibold leading-tight break-words" data-testid="profile-name-hero">
                    {profile.name}
                </div>
                <button
                    type="button"
                    onClick={onOpen}
                    data-testid="pull-to-view"
                    className="mx-auto mt-8 flex items-center gap-1.5 font-body text-[15px] font-semibold text-white/90"
                >
                    {ready ? "Release to view profile" : "Pull to view profile"}
                    <ChevronsDown className={`w-4 h-4 transition-transform ${ready ? "translate-y-0.5" : ""}`} />
                </button>
            </div>
        </div>
    );
}

function Avatar({ profile, busy, onPhoto, mood, setMood, small = false }) {
    const [picking, setPicking] = useState(false);
    const w = small ? "w-[104px] h-[140px] rounded-[36px]" : "w-[132px] h-[176px] rounded-[44px]";
    return (
        <div className={`relative mx-auto ${small ? "w-[104px] h-[140px]" : "w-[132px] h-[176px]"}`}>
            <div className={`${w} overflow-hidden bg-[#cfcfe8] ring-1 ring-white/25 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]`}>
                {profile.photo_top ? (
                    <img src={profile.photo_top} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="relative w-full h-full" aria-hidden>
                        <div className="absolute left-1/2 -translate-x-1/2 top-[26%] w-[48%] aspect-square rounded-full bg-[#9c9ecb]" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[78%] h-[34%] rounded-t-full bg-[#9c9ecb]" />
                    </div>
                )}
            </div>

            <PhotoButton
                busy={busy === "top"}
                onFile={(f) => onPhoto("top", f)}
                label="Change photo"
                testid="photo-top"
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-11 h-11 bg-white text-neutral-900 hover:bg-white/90 shadow-lg"
            />

            {mood && (
                <span className="absolute -right-9 top-6 text-[44px] leading-none rotate-6 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)] select-none" aria-label={mood[1]}>
                    {mood[0]}
                </span>
            )}

            <div className="absolute left-[62%] -top-10 z-10">
                <button
                    type="button"
                    onClick={() => setPicking((p) => !p)}
                    data-testid="mood-bubble"
                    className="relative whitespace-nowrap rounded-2xl bg-neutral-800/90 px-4 py-2 font-body text-[13px] text-white shadow-lg"
                >
                    {mood ? mood[1] : "Mood today?"}
                    <span className="absolute left-5 -bottom-1 w-2.5 h-2.5 rotate-45 bg-neutral-800/90" />
                </button>
                <MoodPicker open={picking} mood={mood} setMood={setMood} onDone={() => setPicking(false)} />
            </div>
        </div>
    );
}


function MoodPicker({ open, mood, setMood, onDone }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 top-full mt-2 z-20 flex gap-1 rounded-2xl bg-neutral-900/95 backdrop-blur p-1.5 shadow-xl"
                >
                    {MOODS.map((m) => (
                        <button
                            key={m[0]}
                            type="button"
                            title={m[1]}
                            aria-label={m[1]}
                            onClick={() => {
                                setMood(mood?.[0] === m[0] ? null : m);
                                onDone();
                            }}
                            className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition hover:bg-white/10 ${
                                mood?.[0] === m[0] ? "bg-white/15" : ""
                            }`}
                        >
                            {m[0]}
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function MoodChip({ mood, setMood }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                data-testid="mood-chip"
                className="rounded-full bg-white/10 hover:bg-white/15 px-3 py-1 font-body text-xs text-white/85 transition"
            >
                {mood ? `${mood[0]} ${mood[1]}` : "Mood today?"}
            </button>
            <MoodPicker open={open} mood={mood} setMood={setMood} onDone={() => setOpen(false)} />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Profile card: opens when you pull down on the hero                  */
/* ------------------------------------------------------------------ */

const tierFor = (n) => (n >= 5 ? "Insider" : n >= 2 ? "Regular" : "Member");
const pad2 = (n) => String(n ?? 0).padStart(2, "0");
const isPast = (t) => Boolean(t.used_at) || ["rejected", "cancelled"].includes(t.status);
const ticketLabel = (t) =>
    t.used_at ? "Checked in" : t.status === "approved" ? "Confirmed" : t.status === "pending" ? "Pending" : t.status === "rejected" ? "Rejected" : "Cancelled";

function ProfileCard({ profile, busy, onPhoto, copyId, mood, setMood, tickets, onClose, onEdit, onMenu, onVisibility }) {
    const [filter, setFilter] = useState("all");
    const startY = useRef(null);
    const list = (tickets || []).filter((t) =>
        filter === "all" ? true : filter === "past" ? isPast(t) : !isPast(t) && ["approved", "pending"].includes(t.status),
    );

    // swipe up on the top part of the card to put it away
    const swipe = {
        onTouchStart: (e) => (startY.current = e.touches[0].clientY),
        onTouchEnd: (e) => {
            if (startY.current != null && e.changedTouches[0].clientY - startY.current < -60) onClose();
            startY.current = null;
        },
    };

    return (
        <motion.div
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Profile card"
                data-testid="member-card"
                className="on-media relative h-[calc(100%-16px)] max-w-xl mt-2 mx-2 sm:mx-auto overflow-y-auto no-scrollbar rounded-[32px] border border-white/10 bg-[#141312]"
                initial={{ y: -80, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -80, opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
                <div
                    className="relative px-4 pb-6 pt-4"
                    style={{ background: "radial-gradient(120% 60% at 50% 0%, rgba(190,190,210,0.35) 0%, rgba(110,110,125,0.14) 45%, transparent 85%)" }}
                    {...swipe}
                >
                    <div className="flex items-center justify-between mb-5">
                        <button type="button" onClick={onClose} aria-label="Close profile card" data-testid="close-card" className={circleBtn}>
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={onEdit} aria-label="Edit profile" className={circleBtn}>
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={onMenu} aria-label="More" className={circleBtn}>
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <FlipCard profile={profile} busy={busy} onPhoto={onPhoto} copyId={copyId} mood={mood} setMood={setMood} />
                </div>

                <div className="px-4 pb-10 space-y-8">
                    {/* Tickets: visibility, see all, filter chips */}
                    <section data-testid="card-tickets">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <h3 className="font-display text-xl font-semibold text-white/85">Tickets</h3>
                                <button
                                    type="button"
                                    onClick={onVisibility}
                                    data-testid="visibility-chip"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-body text-xs text-white/75"
                                >
                                    {profile.discoverable ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                    {profile.discoverable ? "Contacts" : "Private"}
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <Link href="/tickets" className="font-body text-sm font-semibold text-white/85 underline decoration-dotted underline-offset-4">
                                See all
                            </Link>
                        </div>

                        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
                            {[
                                ["all", "All"],
                                ["upcoming", "Upcoming"],
                                ["past", "Past"],
                            ].map(([k, l]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setFilter(k)}
                                    className={`shrink-0 rounded-full border px-4 py-1.5 font-body text-sm transition ${
                                        filter === k ? "border-white/70 text-white bg-white/10" : "border-white/15 text-white/70 hover:bg-white/5"
                                    }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4">
                            {tickets === null ? (
                                <div className="flex items-center gap-2 py-8 justify-center text-white/50 font-body text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading tickets…
                                </div>
                            ) : list.length === 0 ? (
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-7 text-center">
                                    <div className="font-body text-sm text-white/60">
                                        {filter === "past" ? "No past tickets yet" : "No tickets here yet"}
                                    </div>
                                    <Link href="/" className="inline-block mt-3 font-body text-sm font-semibold text-brand-ink">
                                        Find an event
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                                    {list.map((t) => (
                                        <Link
                                            key={t.id}
                                            href="/tickets"
                                            className="relative shrink-0 w-40 aspect-[3/4] overflow-hidden rounded-2xl bg-white/10"
                                        >
                                            {t.event_image && (
                                                <img
                                                    loading="lazy"
                                                    src={resizeImg(t.event_image, 400)}
                                                    alt=""
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30" />
                                            <span className="absolute top-2 left-2 rounded-full bg-black/55 backdrop-blur px-2 py-0.5 font-body text-[10px]">
                                                {ticketLabel(t)}
                                            </span>
                                            <div className="absolute bottom-0 inset-x-0 p-3">
                                                <div className="font-display text-sm font-semibold leading-snug line-clamp-2">{t.event_title}</div>
                                                <div className="font-body text-[11px] text-white/65 mt-0.5">{t.event_date}</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                </div>
            </motion.div>
        </motion.div>
    );
}

/* Flippable member card. Front: cover, avatar, stats. Back: Bash ID with QR code and details. */
const CARD_BG = "#1c1c1e";

function FlipCard({ profile, busy, onPhoto, copyId, mood, setMood }) {
    const [flipped, setFlipped] = useState(false);
    const tier = tierFor(profile.stats.tickets);
    const face = {
        gridArea: "1 / 1",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
    };
    const shell = "rounded-[32px] border border-white/10 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.8)]";

    return (
        <div style={{ perspective: "1400px" }} data-testid="flip-card">
            <div
                className="grid transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}
            >
                {/* FRONT */}
                <div
                    className={`${shell} p-2.5 flex flex-col`}
                    style={{ ...face, background: CARD_BG, pointerEvents: flipped ? "none" : "auto" }}
                    aria-hidden={flipped}
                >
                    <div className="relative h-36 rounded-[24px] overflow-hidden">
                        {profile.photo_side ? (
                            <img src={profile.photo_side} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div
                                className="absolute inset-0"
                                style={{ background: "linear-gradient(135deg,#ff5a36 0%,#b4308c 50%,#4b5bff 100%)" }}
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                        <PhotoButton
                            busy={busy === "side"}
                            onFile={(f) => onPhoto("side", f)}
                            label="Change cover photo"
                            testid="photo-side"
                            className="absolute top-3 right-3 w-8 h-8 bg-black/45 hover:bg-black/65 backdrop-blur"
                        />
                        <span
                            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-black/35 backdrop-blur px-3 py-1.5 font-body text-xs"
                            data-testid="profile-tier"
                        >
                            <span className="w-2 h-2 rounded-full bg-brand" /> {tier}
                        </span>
                    </div>

                    <div className="relative -mt-10 ml-3 w-[84px] h-[84px]">
                        <div
                            className="w-full h-full rounded-full overflow-hidden bg-[#cfcfe8]"
                            style={{ boxShadow: `0 0 0 5px ${CARD_BG}` }}
                        >
                            {profile.photo_top ? (
                                <img src={profile.photo_top} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="relative w-full h-full" aria-hidden>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-[24%] w-[44%] aspect-square rounded-full bg-[#9c9ecb]" />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[74%] h-[34%] rounded-t-full bg-[#9c9ecb]" />
                                </div>
                            )}
                        </div>
                        <PhotoButton
                            busy={busy === "top"}
                            onFile={(f) => onPhoto("top", f)}
                            label="Change photo"
                            testid="photo-top"
                            className="absolute -bottom-0.5 -right-0.5 w-8 h-8 bg-white text-neutral-900 hover:bg-white/90 shadow-md"
                        />
                    </div>

                    <div className="px-3 mt-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="font-display text-[26px] font-semibold leading-tight break-words" data-testid="profile-name">
                                {profile.name}
                            </div>
                            <div className="font-mono text-[13px] tracking-widest text-white/55 mt-0.5" data-testid="profile-bash-id">
                                {profile.bash_id}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFlipped(true)}
                            aria-label="Show Bash ID"
                            title="Show Bash ID"
                            className="shrink-0 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
                        >
                            <QrCode className="w-5 h-5 text-white/80" />
                        </button>
                    </div>

                    <div className="px-3 mt-3 flex items-center gap-2 flex-wrap">
                        {profile.city && (
                            <span className="rounded-full bg-white/10 px-3 py-1 font-body text-xs text-white/85">{cityName(profile.city)}</span>
                        )}
                        {profile.instagram && (
                            <span className="rounded-full bg-white/10 px-3 py-1 font-body text-xs text-white/85">@{profile.instagram}</span>
                        )}
                        <MoodChip mood={mood} setMood={setMood} />
                    </div>

                    <div className="px-3 mt-5 grid grid-cols-3 gap-2">
                        {[
                            [Ticket, "text-amber-400", profile.stats.tickets, "Tickets"],
                            [CalendarDays, "text-sky-400", profile.stats.events, "Events"],
                            [CheckCircle2, "text-violet-400", profile.stats.attended, "Check-ins"],
                        ].map(([Icon, tone, n, l]) => (
                            <div key={l}>
                                <div className="flex items-center gap-2">
                                    <Icon className={`w-5 h-5 ${tone}`} />
                                    <span className="font-display text-xl font-bold leading-none">{pad2(n)}</span>
                                </div>
                                <div className="font-body text-xs text-white/50 mt-1.5">{l}</div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => setFlipped(true)}
                        data-testid="flip-card-front-cta"
                        className="mt-5 w-full rounded-[22px] bg-brand text-brand-fg py-4 font-display font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition"
                    >
                        <QrCode className="w-4 h-4" /> Show Bash ID
                    </button>
                </div>

                {/* BACK: Bash ID */}
                <div
                    className={`${shell} holo-border p-[2px]`}
                    style={{ ...face, transform: "rotateY(180deg)", pointerEvents: flipped ? "auto" : "none" }}
                    aria-hidden={!flipped}
                >
                    <div className="relative h-full rounded-[30px] overflow-hidden flex flex-col p-5" style={{ background: CARD_BG }}>
                        <div className="holo-foil absolute inset-0 pointer-events-none opacity-50" />
                        <div className="relative flex items-center justify-between">
                            <div>
                                <div className="font-display text-xl font-semibold">Bash ID</div>
                                <div className="font-body text-xs text-white/50">Show this at the gate</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFlipped(false)}
                                aria-label="Show profile"
                                title="Show profile"
                                className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
                            >
                                <RotateCw className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="relative mt-4 mx-auto rounded-2xl bg-white p-2.5 shadow-xl">
                            <QRCode value={profile.bash_id} label="Bash ID QR code" className="w-36 h-36" />
                        </div>
                        <button
                            type="button"
                            onClick={copyId}
                            aria-label="Copy Bash ID"
                            className="relative mt-3 mx-auto inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 px-4 py-1.5 font-mono text-sm tracking-widest transition"
                        >
                            {profile.bash_id} <Copy className="w-3.5 h-3.5" />
                        </button>

                        <dl className="relative w-full grid grid-cols-2 gap-x-4 gap-y-3 text-left mt-4">
                            <Info label="Email" full data-testid="profile-email">{profile.email}</Info>
                            <Info label="Mobile">{profile.phone ? maskPhone(profile.phone) : "—"}</Info>
                            <Info label="City">{cityName(profile.city) || "—"}</Info>
                            <Info label={profile.id_type ? `${profile.id_type} number` : "ID number"} data-testid="profile-id-masked">
                                {profile.id_masked || "Added on first booking"}
                            </Info>
                            <Info label="Member since">{fmtDate(profile.member_since)}</Info>
                            {profile.instagram && (
                                <Info label="Instagram" full>
                                    <a
                                        href={`https://www.instagram.com/${profile.instagram}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid="instagram-link"
                                        className="inline-flex items-center gap-1.5 text-brand-ink"
                                    >
                                        <Instagram className="w-3.5 h-3.5" /> @{profile.instagram}
                                    </a>
                                </Info>
                            )}
                        </dl>
                        <p className="relative font-body text-[11px] text-white/40 mt-3">
                            Your full ID number is never shown; only the last digits.
                        </p>

                        <button
                            type="button"
                            onClick={() => setFlipped(false)}
                            className="relative mt-4 w-full rounded-[22px] bg-white/10 hover:bg-white/15 py-3.5 font-display font-semibold transition"
                        >
                            Back to profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Info({ label, children, full, ...rest }) {
    return (
        <div className={full ? "col-span-2" : ""}>
            <dt className="font-body text-[9px] uppercase tracking-widest text-white/45">{label}</dt>
            <dd className="font-body text-[13px] text-white/90 break-all leading-snug" {...rest}>
                {children}
            </dd>
        </div>
    );
}

function maskPhone(p) {
    const d = String(p).replace(/\D/g, "").slice(-10);
    return d.length === 10 ? `+91 ${d.slice(0, 2)}•••• ••${d.slice(8)}` : p;
}

function PhotoButton({ busy, onFile, label, testid, className = "w-8 h-8 bg-black/55 hover:bg-black/80 backdrop-blur" }) {
    return (
        <label
            title={label}
            aria-label={label}
            data-testid={testid}
            className={`rounded-full flex items-center justify-center cursor-pointer transition ${className}`}
        >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = "";
                }}
            />
        </label>
    );
}

/* ------------------------------------------------------------------ */
/* Menu: titled groups of tappable rows                                */
/* ------------------------------------------------------------------ */

function Section({ title, children }) {
    return (
        <section>
            {title && <h2 className="font-display text-xl font-semibold mb-3">{title}</h2>}
            <div className="rounded-2xl border border-fg/10 bg-fg/5 px-4 divide-y divide-fg/10">{children}</div>
        </section>
    );
}

function Row({ icon: Icon, label, value, href, onClick, testid }) {
    const inner = (
        <>
            <Icon className="w-[22px] h-[22px] text-fg/60 shrink-0" strokeWidth={1.6} />
            <span className="flex-1 font-display font-semibold text-[15px] text-left">{label}</span>
            {value && <span className="font-body text-sm text-fg/60">{value}</span>}
            <ChevronRight className="w-5 h-5 text-fg/35 shrink-0" />
        </>
    );
    const cls = "w-full flex items-center gap-4 py-[18px] hover:opacity-80 transition";
    return href ? (
        <Link href={href} className={cls} data-testid={testid}>
            {inner}
        </Link>
    ) : (
        <button type="button" onClick={onClick} className={cls} data-testid={testid}>
            {inner}
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* Bottom sheet: who can see the events you are going to               */
/* ------------------------------------------------------------------ */

function VisibilitySheet({ open, onClose, profile, setProfile }) {
    const current = Boolean(profile.discoverable);
    const [pick, setPick] = useState(current);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setPick(current);
    }, [open, current]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && !saving && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, saving, onClose]);

    if (!open) return null;

    const submit = async () => {
        setSaving(true);
        try {
            const { data } = await api.patch("/profile", { discoverable: pick });
            setProfile(data);
            toast.success(pick ? "Contacts can now see events you're going to" : "Only you can see your events");
            onClose();
        } catch (e) {
            toast.error(errText(e));
        } finally {
            setSaving(false);
        }
    };

    const options = [
        [true, "Contacts", "People who have your number saved can see which events you're going to"],
        [false, "Only me", "Only you can see the events you're going to"],
    ];

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
            role="presentation"
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Event visibility"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className="w-full max-w-xl rounded-t-[28px] border border-fg/10 bg-surface pb-6"
                data-testid="visibility-sheet"
            >
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-fg/10">
                    <div>
                        <h2 className="font-display text-xl font-semibold">Event visibility</h2>
                        <p className="font-body text-sm text-fg/60 mt-1">Control who can see the events you&apos;re going to.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close"
                        className="w-10 h-10 rounded-full bg-fg/10 flex items-center justify-center shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div role="radiogroup" aria-label="Event visibility" className="px-5">
                    {options.map(([val, title, sub]) => {
                        const on = pick === val;
                        return (
                            <button
                                key={title}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setPick(val)}
                                className="w-full flex items-center justify-between gap-4 py-4 text-left"
                            >
                                <span>
                                    <span className="block font-display text-lg font-semibold">{title}</span>
                                    <span className="block font-body text-sm text-fg/60">{sub}</span>
                                </span>
                                <span
                                    className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                        on ? "border-brand bg-brand" : "border-fg/30"
                                    }`}
                                >
                                    {on && <span className="w-2.5 h-2.5 rounded-full bg-brand-fg" />}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="px-5 pt-2">
                    <button
                        type="button"
                        onClick={submit}
                        disabled={pick === current || saving}
                        data-testid="visibility-submit"
                        className="w-full rounded-full bg-brand text-brand-fg py-3.5 font-display font-semibold flex items-center justify-center gap-2 disabled:bg-fg/10 disabled:text-fg/40 transition"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Edit profile: one popup, one form                                   */
/* ------------------------------------------------------------------ */

function EditProfileModal({ open, onClose, profile, setProfile }) {
    const initial = {
        name: profile.name || "",
        phone: profile.phone || "",
        city: profile.city || "",
        instagram: profile.instagram ? `@${profile.instagram}` : "",
    };
    const [v, setV] = useState(initial);
    const [saving, setSaving] = useState(false);

    // start from the saved values every time it opens, so Cancel discards edits
    useEffect(() => {
        if (open) setV(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
    const dirty = Object.keys(initial).some((k) => initial[k] !== v[k]);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const changed = Object.fromEntries(Object.keys(initial).filter((k) => initial[k] !== v[k]).map((k) => [k, v[k]]));
            const { data } = await api.patch("/profile", changed);
            setProfile(data);
            toast.success("Profile updated");
            onClose();
        } catch (err) {
            toast.error(errText(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Edit profile" subtitle="Email and date of birth can't be changed here." busy={saving}>
            <form onSubmit={save} className="space-y-3" data-testid="edit-details">
                <Field label="Full name">
                    <input value={v.name} onChange={set("name")} maxLength={80} className={inputCls} data-testid="edit-name" />
                </Field>
                <Field label="Mobile">
                    <input value={v.phone} onChange={set("phone")} inputMode="numeric" className={inputCls} data-testid="edit-phone" />
                </Field>
                <Field label="City">
                    <select value={v.city} onChange={set("city")} className={inputCls} data-testid="edit-city">
                        <option value="" className="text-canvas">Select city</option>
                        {CITIES.map((c) => (
                            <option key={c.slug} value={c.slug} className="text-canvas">{c.name}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Instagram" hint="Optional. Clear the box to remove it.">
                    <input value={v.instagram} onChange={set("instagram")} placeholder="@yourname" className={inputCls} data-testid="instagram-input" />
                </Field>
                <div className="flex justify-end gap-2 pt-1">
                    <Btn type="button" onClick={onClose} disabled={saving} data-testid="cancel-edit">Cancel</Btn>
                    <Btn variant="primary" type="submit" disabled={!dirty || saving} data-testid="details-save">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
                    </Btn>
                </div>
            </form>
        </Modal>
    );
}

/* ------------------------------------------------------------------ */
/* Settings: password, notifications, log out                          */
/* ------------------------------------------------------------------ */

function SettingsModal({ open, onClose, email, profile, setProfile, onLogout }) {
    const [view, setView] = useState("menu"); // menu | password | logout
    useEffect(() => {
        if (open) setView("menu");
    }, [open]);

    const back = () => setView("menu");

    if (view === "password") return <PasswordView open={open} onBack={back} onClose={onClose} />;

    if (view === "logout") {
        return (
            <Modal open={open} onClose={back} title="Log out?" subtitle="You will need to sign in again on this device.">
                <div className="flex justify-end gap-2">
                    <Btn type="button" onClick={back} data-testid="cancel-logout">Cancel</Btn>
                    <Btn variant="danger" onClick={onLogout} data-testid="profile-logout">
                        <LogOut className="w-4 h-4" /> Log out
                    </Btn>
                </div>
            </Modal>
        );
    }

    return (
        <Modal open={open} onClose={onClose} title="Settings" subtitle={email}>
            <div className="divide-y divide-fg/10" data-testid="settings-menu">
                <Appearance />

                <button
                    type="button"
                    onClick={() => setView("password")}
                    data-testid="edit-password"
                    className="w-full flex items-center justify-between gap-3 py-3.5 text-left hover:text-brand-ink transition"
                >
                    <span className="flex items-center gap-3">
                        <KeyRound className="w-4 h-4 text-fg/50" />
                        <span className="font-display font-semibold text-sm">Change password</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-fg/40" />
                </button>

                <Preferences />

                <Privacy profile={profile} setProfile={setProfile} />

                <button
                    type="button"
                    onClick={() => setView("logout")}
                    className="w-full flex items-center gap-3 py-3.5 text-left text-danger-ink hover:opacity-80 transition"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="font-display font-semibold text-sm">Log out</span>
                </button>
            </div>
            <div className="flex justify-end pt-3">
                <Btn type="button" onClick={onClose} data-testid="close-settings">Close</Btn>
            </div>
        </Modal>
    );
}

const THEME_OPTIONS = [
    ["light", "Light", Sun, "Always light"],
    ["dark", "Dark", Moon, "Always dark"],
    ["system", "Device", Monitor, "Match your phone or computer"],
    ["time", "Time of day", Clock, "Light 6 am to 6 pm, dark at night"],
];

function Appearance() {
    const { mode, theme, setMode } = useTheme();
    const hint = THEME_OPTIONS.find(([k]) => k === mode)?.[3];
    return (
        <div className="py-3.5" data-testid="appearance">
            <div className="font-body text-[11px] uppercase tracking-widest text-fg/45 mb-2">Appearance</div>
            <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-4 gap-2">
                {THEME_OPTIONS.map(([key, label, Icon]) => {
                    const on = mode === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setMode(key)}
                            data-testid={`theme-${key}`}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 font-body text-[11px] transition ${
                                on ? "border-brand bg-brand/10 text-fg" : "border-fg/10 bg-fg/5 text-fg/70 hover:bg-fg/10"
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${on ? "text-brand-ink" : ""}`} />
                            {label}
                        </button>
                    );
                })}
            </div>
            <p className="font-body text-xs text-fg/50 mt-2">
                {hint}. Showing {theme} now.
            </p>
        </div>
    );
}

function PasswordView({ open, onBack, onClose }) {
    const [cur, setCur] = useState("");
    const [next, setNext] = useState("");
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (next.length < 8) return toast.error("New password must be at least 8 characters");
        setSaving(true);
        try {
            await api.post("/profile/password", { current: cur, next });
            toast.success("Password changed");
            onClose();
        } catch (err) {
            toast.error(errText(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onBack} title="Change password" subtitle="Other devices will be signed out. You stay signed in here." busy={saving}>
            <form onSubmit={submit} className="space-y-3" data-testid="change-password">
                <Field label="Current password">
                    <input type={show ? "text" : "password"} value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} autoComplete="current-password" />
                </Field>
                <Field label="New password">
                    <input type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} autoComplete="new-password" placeholder="8+ characters" />
                </Field>
                <button type="button" onClick={() => setShow((x) => !x)} className="inline-flex items-center gap-1.5 font-body text-xs text-fg/60 hover:text-fg">
                    {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {show ? "Hide" : "Show"} passwords
                </button>
                <div className="flex justify-end gap-2 pt-1">
                    <Btn type="button" onClick={onBack} disabled={saving} data-testid="cancel-password">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Btn>
                    <Btn variant="primary" type="submit" disabled={!cur || !next || saving} data-testid="save-password">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Update
                    </Btn>
                </div>
            </form>
        </Modal>
    );
}

function Privacy({ profile, setProfile }) {
    const [saving, setSaving] = useState(false);
    const on = Boolean(profile.discoverable);
    const toggle = async () => {
        setSaving(true);
        try {
            const { data } = await api.patch("/profile", { discoverable: !on });
            setProfile(data);
            toast.success(!on ? "Contacts can now see events you're going to" : "You are hidden from contacts");
        } catch (e) {
            toast.error(errText(e));
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="py-3.5" data-testid="privacy">
            <div className="font-body text-[11px] uppercase tracking-widest text-fg/45 mb-1">Privacy</div>
            <button
                type="button"
                onClick={toggle}
                disabled={saving}
                role="switch"
                aria-checked={on}
                data-testid="toggle-discoverable"
                className="w-full flex items-center justify-between gap-4 py-2 text-left"
            >
                <span>
                    <span className="block font-display font-semibold text-sm">Let contacts find me</span>
                    <span className="block font-body text-xs text-fg/50">
                        People who have your number saved can see which events you&apos;re going to. Off by default.
                    </span>
                </span>
                <span className={`relative w-11 h-6 rounded-full shrink-0 transition ${on ? "bg-brand" : "bg-fg/15"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                </span>
            </button>
        </div>
    );
}

function Preferences() {
    const [prefs, setPrefs] = useState({ reminders: true, booking: true, offers: false });
    useEffect(() => {
        try {
            const s = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
            if (s) setPrefs((p) => ({ ...p, ...s }));
        } catch {}
    }, []);
    const toggle = (k) =>
        setPrefs((p) => {
            const n = { ...p, [k]: !p[k] };
            try {
                localStorage.setItem(PREF_KEY, JSON.stringify(n));
            } catch {}
            return n;
        });

    return (
        <div className="py-2" data-testid="prefs">
            <div className="font-body text-[11px] uppercase tracking-widest text-fg/45 pt-2 pb-1">Notifications (this device)</div>
            {PREFS.map(([k, title, sub]) => (
                <button
                    key={k}
                    type="button"
                    onClick={() => toggle(k)}
                    role="switch"
                    aria-checked={prefs[k]}
                    className="w-full flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 -mx-2 text-left hover:bg-fg/5 transition"
                >
                    <span className="flex items-start gap-3 min-w-0">
                        <Bell className="w-4 h-4 mt-1 text-fg/40 shrink-0" />
                        <span>
                            <span className="block font-display font-semibold text-sm">{title}</span>
                            <span className="block font-body text-xs text-fg/50">{sub}</span>
                        </span>
                    </span>
                    <span className={`relative w-11 h-6 rounded-full shrink-0 transition ${prefs[k] ? "bg-brand" : "bg-fg/15"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${prefs[k] ? "left-[22px]" : "left-0.5"}`} />
                    </span>
                </button>
            ))}
        </div>
    );
}
