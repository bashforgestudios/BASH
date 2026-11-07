"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Copy, Rocket, ExternalLink, Save } from "lucide-react";
import { Card, Field, Btn, Badge, Empty, inputCls, fmtDateTime } from "@/components/PanelUI";
import { ReviewDrawer } from "@/components/ClubOnboarding";
import { api, formatErr } from "@/lib/api";
import { LEAD_STATUSES, CONTACT_PREFS } from "@/lib/leads";

const errText = (e) => formatErr(e?.response?.data?.detail) || e?.message || "Something went wrong";
const STATUS = Object.fromEntries(LEAD_STATUSES.map((s) => [s.id, s]));
const wa = (phone) => {
    const d = phone.replace(/\D/g, "");
    return `https://wa.me/${d.length === 10 ? "91" + d : d}`;
};
const copy = (text, msg) => navigator.clipboard?.writeText(text).then(() => toast.success(msg), () => toast.error("Copy failed"));

export default function LeadsInbox() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("open");
    const [reviewId, setReviewId] = useState(null);
    const [creds, setCreds] = useState(null); // shown once after "Start onboarding"

    const load = useCallback(() => {
        return api
            .get("/dev/leads")
            .then((r) => setLeads(r.data))
            .catch((e) => toast.error(errText(e)))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const shown = leads.filter((l) =>
        filter === "all" ? true : filter === "open" ? ["new", "contacted"].includes(l.status) : l.status === filter,
    );
    const count = (f) => leads.filter((l) => (f === "open" ? ["new", "contacted"].includes(l.status) : l.status === f)).length;

    return (
        <>
            <Card
                title="Club leads"
                subtitle="Clubs that used Request access. Call them, then start onboarding to create their club, a prefilled application and their login."
            >
                <div className="flex gap-2 flex-wrap mb-4" data-testid="lead-filters">
                    {[["open", "To contact"], ["onboarding", "Onboarding"], ["converted", "Live"], ["declined", "Declined"], ["all", "All"]].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setFilter(id)}
                            className={`rounded-full px-3.5 py-1.5 font-body text-xs border transition ${filter === id ? "bg-white text-black border-white" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"}`}
                        >
                            {label}
                            {id !== "all" && count(id) > 0 && <span className="ml-1.5 opacity-60">{count(id)}</span>}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-white/50 font-body text-sm">Loading…</div>
                ) : shown.length === 0 ? (
                    <Empty>No leads here. Share bash.in/business with clubs you want on the platform.</Empty>
                ) : (
                    <div className="space-y-3" data-testid="lead-list">
                        {shown.map((l) => (
                            <LeadRow key={`${l.id}-${l.updated_at}`} lead={l} onChanged={load} onOpen={setReviewId} onStarted={(r) => { setCreds(r); load(); }} />
                        ))}
                    </div>
                )}
            </Card>

            {creds && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setCreds(null)}>
                    <div onClick={(e) => e.stopPropagation()} data-testid="creds-modal" className="w-full max-w-md rounded-3xl bg-[#0b0f19] border border-white/10 p-6 space-y-4">
                        <h3 className="font-display text-xl font-bold">Onboarding started</h3>
                        <p className="font-body text-sm text-white/60">
                            The club is hidden until you approve it. A club login now exists for the lead&apos;s email.
                        </p>
                        <div className="rounded-xl bg-white/5 border border-white/10 p-4 font-body text-sm space-y-2">
                            <div><span className="text-white/40 text-xs block">Login email</span>{creds.admin_email}</div>
                            {creds.temp_password ? (
                                <div>
                                    <span className="text-white/40 text-xs block">Temporary password (shown once)</span>
                                    <span className="font-mono text-base" data-testid="temp-password">{creds.temp_password}</span>
                                </div>
                            ) : (
                                <div className="text-white/60">This email already had a guest account. It now has club access with its existing password.</div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {creds.temp_password && (
                                <Btn onClick={() => copy(`Email: ${creds.admin_email}\nPassword: ${creds.temp_password}`, "Login copied")}>
                                    <Copy className="w-4 h-4" /> Copy login
                                </Btn>
                            )}
                            <Btn variant="primary" onClick={() => { setReviewId(creds.club_id); setCreds(null); }} data-testid="open-application">
                                <ExternalLink className="w-4 h-4" /> Open application
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {reviewId && <ReviewDrawer clubId={reviewId} onClose={() => setReviewId(null)} onChanged={load} />}
        </>
    );
}

function LeadRow({ lead: l, onChanged, onOpen, onStarted }) {
    const [notes, setNotes] = useState(l.dev_notes || "");
    const [busy, setBusy] = useState(false);
    const st = STATUS[l.status] || STATUS.new;
    const pref = CONTACT_PREFS.find((p) => p.id === l.contact_pref)?.label;

    const run = async (fn, okMsg) => {
        setBusy(true);
        try {
            const r = await fn();
            if (okMsg) toast.success(okMsg);
            return r;
        } catch (e) {
            toast.error(errText(e));
        } finally {
            setBusy(false);
        }
    };
    const patch = (body, msg) => run(async () => { await api.patch(`/dev/leads/${l.id}`, body); onChanged(); }, msg);
    const start = async () => {
        if (!window.confirm(`Create the club and a club login for ${l.email}?`)) return;
        const r = await run(() => api.post(`/dev/leads/${l.id}/convert`));
        if (r) onStarted(r.data);
    };

    return (
        <div className="rounded-2xl border border-white/10 p-4 space-y-3" data-testid={`lead-${l.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="font-body font-semibold">{l.club_name}</div>
                    <div className="font-body text-xs text-white/50">
                        {l.city_name} · {l.contact_name} · wants: {pref} · {fmtDateTime(l.created_at)}
                    </div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
            </div>

            {l.message && <p className="font-body text-sm text-white/70 bg-white/5 rounded-xl p-3">{l.message}</p>}

            <div className="flex flex-wrap gap-2">
                <a className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm bg-white/5 border border-white/10 hover:bg-white/10" href={`tel:${l.phone}`}>
                    <Phone className="w-4 h-4" /> {l.phone}
                </a>
                <a className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm bg-white/5 border border-white/10 hover:bg-white/10" href={wa(l.phone)} target="_blank" rel="noreferrer">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm bg-white/5 border border-white/10 hover:bg-white/10" href={`mailto:${l.email}`}>
                    <Mail className="w-4 h-4" /> {l.email}
                </a>
                {l.instagram && (
                    <a className="inline-flex items-center rounded-full px-4 py-2 font-body text-sm bg-white/5 border border-white/10 hover:bg-white/10" href={`https://instagram.com/${encodeURIComponent(l.instagram)}`} target="_blank" rel="noreferrer">
                        @{l.instagram}
                    </a>
                )}
            </div>

            <Field label="Call notes">
                <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed, what they still need to send…" />
            </Field>

            <div className="flex flex-wrap gap-2">
                <Btn disabled={busy || notes === (l.dev_notes || "")} onClick={() => patch({ dev_notes: notes }, "Notes saved")}>
                    <Save className="w-4 h-4" /> Save notes
                </Btn>
                {l.status === "new" && (
                    <Btn disabled={busy} onClick={() => patch({ status: "contacted" }, "Marked contacted")}>Mark contacted</Btn>
                )}
                {!l.club_id && l.status !== "declined" && (
                    <Btn variant="primary" disabled={busy} onClick={start} data-testid="start-onboarding">
                        <Rocket className="w-4 h-4" /> Start onboarding
                    </Btn>
                )}
                {l.club_id && (
                    <Btn variant="good" onClick={() => onOpen(l.club_id)}>
                        <ExternalLink className="w-4 h-4" /> Open application
                    </Btn>
                )}
                {!l.club_id && l.status !== "declined" && (
                    <Btn variant="danger" disabled={busy} onClick={() => patch({ status: "declined" }, "Lead declined")}>Decline</Btn>
                )}
                {l.status === "declined" && (
                    <Btn disabled={busy} onClick={() => patch({ status: "new" }, "Lead reopened")}>Reopen</Btn>
                )}
            </div>
        </div>
    );
}
