"use client";

import { useState } from "react";
import { Check, Phone, MessageCircle, Mail, FileCheck2, Rocket } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { CITIES } from "@/lib/geo";
import { CONTACT_PREFS, validateLead } from "@/lib/leads";

const input =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 font-body text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/40";

const PREF_ICON = { call: Phone, whatsapp: MessageCircle, email: Mail };

const STEPS = [
    { icon: Phone, title: "We call you", text: "Within 1 to 2 working days, the way you prefer." },
    { icon: FileCheck2, title: "We collect the paperwork", text: "Licences, GST and bank details. On the call, no uploads from you." },
    { icon: Rocket, title: "You go live", text: "We create your club login and your first event can go on sale." },
];

// Deliberately short. Everything else (licences, GST, bank, capacity) is collected by the Bash team
// on the call and entered from the Developer panel.
export default function BusinessLeadForm() {
    const [v, setV] = useState({ club_name: "", city_slug: "", contact_name: "", phone: "", email: "", instagram: "", contact_pref: "call", message: "", company_site: "" });
    const [errs, setErrs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        const { errors } = validateLead(v);
        if (errors.length) return setErrs(errors);
        setErrs([]);
        setLoading(true);
        try {
            await api.post("/business/leads", v);
            setDone(true);
        } catch (err) {
            setErrs([formatErr(err.response?.data?.detail) || err.message]);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div data-testid="lead-success" className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto">
                    <Check className="w-7 h-7 text-emerald-300" />
                </div>
                <h2 className="font-display text-2xl font-bold mt-5">Request received</h2>
                <p className="font-body text-white/60 text-sm mt-2">
                    Thanks {v.contact_name.split(" ")[0]}. The Bash team will reach out about <b className="text-white">{v.club_name}</b>.
                </p>
                <ol className="mt-6 space-y-3 text-left">
                    {STEPS.map((s, i) => (
                        <li key={i} className="flex gap-3 rounded-xl bg-white/5 border border-white/10 p-3.5">
                            <s.icon className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
                            <div>
                                <div className="font-body text-sm font-semibold">{s.title}</div>
                                <div className="font-body text-xs text-white/50 mt-0.5">{s.text}</div>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-3" data-testid="lead-form" noValidate>
            <input data-testid="lead-club" placeholder="Club or venue name" value={v.club_name} onChange={set("club_name")} required className={input} />
            <select data-testid="lead-city" value={v.city_slug} onChange={set("city_slug")} required className={`${input} ${v.city_slug ? "" : "text-white/30"}`}>
                <option value="" className="bg-[#0b0f19]">City</option>
                {CITIES.map((c) => (
                    <option key={c.slug} value={c.slug} className="bg-[#0b0f19] text-white">{c.name}</option>
                ))}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input data-testid="lead-name" placeholder="Your name" value={v.contact_name} onChange={set("contact_name")} required className={input} />
                <input data-testid="lead-phone" type="tel" inputMode="tel" placeholder="Mobile number" value={v.phone} onChange={set("phone")} required className={input} />
            </div>
            <input data-testid="lead-email" type="email" placeholder="Email (this becomes your login)" value={v.email} onChange={set("email")} required className={input} />
            <input data-testid="lead-instagram" placeholder="Instagram handle (optional)" value={v.instagram} onChange={set("instagram")} className={input} />

            <div>
                <div className="font-body text-[11px] uppercase tracking-widest text-white/40 mb-2">Best way to reach you</div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                    {CONTACT_PREFS.map((p) => {
                        const Icon = PREF_ICON[p.id];
                        const on = v.contact_pref === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setV((x) => ({ ...x, contact_pref: p.id }))}
                                className={`rounded-xl border py-2.5 font-body text-sm flex items-center justify-center gap-2 transition ${on ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                            >
                                <Icon className="w-4 h-4" /> {p.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <textarea rows={2} placeholder="Anything we should know? (optional)" value={v.message} onChange={set("message")} maxLength={500} className={input} />

            {/* Honeypot: hidden from people, bots fill it in. */}
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" name="company_site" value={v.company_site} onChange={set("company_site")} className="hidden" />

            {errs.length > 0 && (
                <div data-testid="lead-error" className="text-sm text-red-400 font-body space-y-0.5">
                    {errs.map((m, i) => (
                        <div key={i}>{m}</div>
                    ))}
                </div>
            )}

            <button type="submit" disabled={loading} data-testid="lead-submit" className="w-full rounded-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 font-display font-semibold hover:scale-[1.01] transition disabled:opacity-50">
                {loading ? "Sending…" : "Request access"}
            </button>
            <p className="font-body text-xs text-white/40 text-center">
                No documents needed today. We collect licences and bank details with you on the call.
            </p>
        </form>
    );
}
