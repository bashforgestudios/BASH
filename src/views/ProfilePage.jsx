"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNav } from "@/lib/useNav";
import { toast } from "sonner";
import {
    Camera, Copy, Instagram, Loader2, Check, RotateCw, LogOut, KeyRound, Bell,
    ChevronRight, Eye, EyeOff, Pencil, Settings, ArrowLeft, Sun, Moon, Monitor, Clock,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import QRCode from "@/components/QRCode";
import Modal from "@/components/Modal";
import { Btn, Field, inputCls } from "@/components/PanelUI";
import { api, formatErr } from "@/lib/api";
import { CITIES } from "@/lib/geo";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/lib/useTheme";

const errText = (e) => formatErr(e?.response?.data?.detail) || e?.message || "Something went wrong";
const cityName = (slug) => CITIES.find((c) => c.slug === slug)?.name || "";
const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const PREF_KEY = "bash_prefs";
const PREFS = [
    ["reminders", "Event reminders", "A nudge the day before your event"],
    ["booking", "Booking updates", "Approvals, rejections and payment receipts"],
    ["offers", "Offers & new drops", "Presales and events in your city"],
];

export default function ProfilePage() {
    const { user, loading, logout } = useAuth();
    const nav = useNav();
    const [profile, setProfile] = useState(null);
    const [busy, setBusy] = useState(null); // "top" | "side" (photo uploads)
    const [editing, setEditing] = useState(false);
    const [settings, setSettings] = useState(false);

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

    if (loading || !user || !profile) {
        return (
            <AppShell>
                <div className="p-10 text-fg/60 font-body">Loading…</div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="max-w-5xl mx-auto px-4 md:px-10 py-8 space-y-8">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">My Profile</h1>
                    <div className="flex items-center gap-2">
                        <Btn variant="primary" onClick={() => setEditing(true)} data-testid="edit-profile">
                            <Pencil className="w-4 h-4" /> Edit profile
                        </Btn>
                        <button
                            type="button"
                            onClick={() => setSettings(true)}
                            aria-label="Settings"
                            title="Settings"
                            data-testid="open-settings"
                            className="w-10 h-10 rounded-full border border-fg/10 bg-fg/5 hover:bg-fg/10 flex items-center justify-center transition"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">
                    <MemberCard profile={profile} busy={busy} onPhoto={onPhoto} copyId={copyId} />
                    <div className="space-y-6 min-w-0">
                        <QuickLinks />
                        <p className="font-body text-xs text-fg/40">
                            Photos are JPG, PNG or WebP, up to 2 MB. Your full ID number is never shown; only the last digits.
                        </p>
                    </div>
                </div>
            </div>

            <EditProfileModal open={editing} onClose={() => setEditing(false)} profile={profile} setProfile={setProfile} />
            <SettingsModal
                open={settings}
                onClose={() => setSettings(false)}
                email={profile.email}
                profile={profile}
                setProfile={setProfile}
                onLogout={async () => {
                    await logout();
                    nav("/");
                }}
            />
        </AppShell>
    );
}

/* ------------------------------------------------------------------ */
/* Holographic member card: solid, tap to flip                        */
/* ------------------------------------------------------------------ */

const tierFor = (n) => (n >= 5 ? "Insider" : n >= 2 ? "Regular" : "Member");
const face = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };

function MemberCard({ profile, busy, onPhoto, copyId }) {
    const [flipped, setFlipped] = useState(false);
    const tier = tierFor(profile.stats.tickets);
    const stop = (e) => e.stopPropagation();

    return (
        <div className="mx-auto w-full max-w-[340px]" data-testid="member-card">
            <div style={{ perspective: "1400px" }}>
                <div className="relative aspect-[5/7.6]" style={{ transformStyle: "preserve-3d" }}>
                    <div
                        className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}
                    >
                        {/* FRONT */}
                        <div
                            className="holo-border absolute inset-0 rounded-[28px] p-[2px] cursor-pointer shadow-[0_25px_60px_-20px_rgba(0,0,0,0.55)]"
                            style={face}
                            onClick={() => setFlipped(true)}
                            aria-hidden={flipped}
                        >
                            <div className="on-media relative h-full w-full rounded-[26px] overflow-hidden bg-[#171513]">
                                {profile.photo_top ? (
                                    <img src={profile.photo_top} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 bg-brand flex items-center justify-center">
                                        <span className="font-display font-bold text-[140px] text-fg/25 leading-none">
                                            {profile.name?.[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/30" />
                                <div className="holo-foil absolute inset-0 pointer-events-none" />

                                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-display font-bold text-sm">B</div>
                                        <span className="font-display text-lg tracking-tight">Bash</span>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={stop}>
                                        <span className="rounded-full bg-fg/15 backdrop-blur px-3 py-1 font-body text-[10px] uppercase tracking-[0.2em]" data-testid="profile-tier">
                                            {tier}
                                        </span>
                                        <PhotoButton busy={busy === "top"} onFile={(f) => onPhoto("top", f)} label="Change cover photo" testid="photo-top" />
                                    </div>
                                </div>

                                <div className="absolute bottom-0 inset-x-0 p-5 space-y-3">
                                    <div>
                                        <div className="font-display text-3xl font-bold leading-tight break-words" data-testid="profile-name">
                                            {profile.name}
                                        </div>
                                        <div className="font-mono text-sm tracking-widest text-fg/80 mt-1" data-testid="profile-bash-id">
                                            {profile.bash_id}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {profile.city && (
                                            <span className="rounded-full bg-fg/15 backdrop-blur px-3 py-1 font-body text-xs">
                                                {cityName(profile.city)}
                                            </span>
                                        )}
                                        {profile.instagram && (
                                            <span className="rounded-full bg-fg/15 backdrop-blur px-3 py-1 font-body text-xs">
                                                @{profile.instagram}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                        {[
                                            [profile.stats.tickets, "Tickets"],
                                            [profile.stats.events, "Events"],
                                            [profile.stats.attended, "Check-ins"],
                                        ].map(([n, l]) => (
                                            <div key={l} className="rounded-xl bg-black/35 backdrop-blur border border-fg/10 py-2 text-center">
                                                <div className="font-display text-xl font-bold leading-none">{n}</div>
                                                <div className="font-body text-[9px] uppercase tracking-widest text-fg/60 mt-1">{l}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BACK */}
                        <div
                            className="holo-border absolute inset-0 rounded-[28px] p-[2px] cursor-pointer shadow-[0_25px_60px_-20px_rgba(0,0,0,0.55)]"
                            style={{ ...face, transform: "rotateY(180deg)" }}
                            onClick={() => setFlipped(false)}
                            aria-hidden={!flipped}
                        >
                            <div className="on-media relative h-full w-full rounded-[26px] overflow-hidden bg-[#171513] flex flex-col">
                                <div className="holo-foil absolute inset-0 pointer-events-none opacity-60" />

                                <div className="relative h-[24%] shrink-0">
                                    {profile.photo_side ? (
                                        <img src={profile.photo_side} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 bg-brand flex items-center justify-center font-body text-xs text-brand-fg/60">
                                            Add a second photo
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#121110] to-transparent" />
                                    <div className="absolute top-3 right-3" onClick={stop}>
                                        <PhotoButton busy={busy === "side"} onFile={(f) => onPhoto("side", f)} label="Change second photo" testid="photo-side" />
                                    </div>
                                </div>

                                <div className="relative flex-1 min-h-0 px-5 pb-4 -mt-9 flex flex-col items-center gap-3 overflow-y-auto no-scrollbar">
                                    <div className="rounded-2xl bg-white p-2 shadow-xl shrink-0">
                                        <QRCode value={profile.bash_id} label="Bash ID QR code" className="w-28 h-28" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            stop(e);
                                            copyId();
                                        }}
                                        aria-label="Copy Bash ID"
                                        className="inline-flex items-center gap-2 rounded-full bg-fg/10 hover:bg-fg/20 px-4 py-1.5 font-mono text-sm tracking-widest transition shrink-0"
                                    >
                                        {profile.bash_id} <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    <dl className="w-full grid grid-cols-2 gap-x-4 gap-y-2.5 text-left">
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
                                                    onClick={stop}
                                                    data-testid="instagram-link"
                                                    className="inline-flex items-center gap-1.5 text-brand-ink hover:text-brand-ink"
                                                >
                                                    <Instagram className="w-3.5 h-3.5" /> @{profile.instagram}
                                                </a>
                                            </Info>
                                        )}
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Btn onClick={() => setFlipped((f) => !f)} data-testid="flip-card">
                    <RotateCw className="w-4 h-4" /> {flipped ? "Show front" : "Flip for QR & details"}
                </Btn>
            </div>
        </div>
    );
}

function Info({ label, children, full, ...rest }) {
    return (
        <div className={full ? "col-span-2" : ""}>
            <dt className="font-body text-[9px] uppercase tracking-widest text-fg/45">{label}</dt>
            <dd className="font-body text-[13px] text-fg/90 break-all leading-snug" {...rest}>
                {children}
            </dd>
        </div>
    );
}

function maskPhone(p) {
    const d = String(p).replace(/\D/g, "").slice(-10);
    return d.length === 10 ? `+91 ${d.slice(0, 2)}•••• ••${d.slice(8)}` : p;
}

function PhotoButton({ busy, onFile, label, testid }) {
    return (
        <label
            title={label}
            aria-label={label}
            data-testid={testid}
            className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur flex items-center justify-center cursor-pointer transition"
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

function QuickLinks() {
    const links = [
        ["/tickets", "My Tickets", "See your passes and QR codes"],
        ["/", "Live Now", "Find something happening tonight"],
    ];
    return (
        <div className="rounded-3xl border border-fg/10 bg-fg/5 divide-y divide-fg/10">
            {links.map(([href, title, sub]) => (
                <Link key={href} href={href} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-fg/5 transition">
                    <div>
                        <div className="font-display font-semibold">{title}</div>
                        <div className="font-body text-xs text-fg/50">{sub}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-fg/40" />
                </Link>
            ))}
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
