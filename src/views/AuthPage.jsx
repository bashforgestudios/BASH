"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useNav } from "@/lib/useNav";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";
import { homeFor, safeNext } from "@/lib/roleHome";
import { CITIES } from "@/lib/geo";
import BusinessLeadForm from "@/components/BusinessLeadForm";
import { LogoMark, Wordmark } from "@/components/Logo";

const input =
    "w-full rounded-xl bg-fg/5 border border-fg/10 px-4 py-3.5 font-body text-sm placeholder:text-fg/30 focus:outline-none focus:ring-2 focus:ring-brand/40";
const submitCls =
    "w-full rounded-full py-4 bg-brand font-display font-semibold hover:scale-[1.01] transition disabled:opacity-50";
const linkCls = "text-brand-ink hover:text-brand-ink";

const COPY = {
    login: ["Welcome back.", "Sign in to continue."],
    register: ["Join Bash.", "How will you use Bash?"],
    user: ["Create your account.", "A few quick steps and you're in."],
    club: ["Put your business on Bash.", "Tell us who you are. We handle the rest."],
};

function LoginForm() {
    const { login } = useAuth();
    const nav = useNav();
    const sp = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            const u = await login(email, password);
            // a ?next= from a protected page wins; otherwise go to the role's own panel
            nav(safeNext(sp.get("next"), homeFor(u?.role)));
        } catch (e) {
            setErr(formatErr(e.response?.data?.detail) || e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <form onSubmit={submit} className="space-y-3">
                <input data-testid="auth-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
                <input data-testid="auth-password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className={input} />
                {err && <div data-testid="auth-error" className="text-sm text-danger-ink font-body">{err}</div>}
                <button type="submit" disabled={loading} data-testid="auth-submit" className={submitCls}>
                    {loading ? "Please wait…" : "Sign in"}
                </button>
            </form>

            <div className="text-center mt-6 text-sm font-body text-fg/60">
                New to Bash? <Link href="/register" className={linkCls} data-testid="goto-register">Create account</Link>
            </div>

            <div className="mt-8 rounded-xl bg-fg/5 border border-fg/10 p-4 text-xs font-body text-fg/50 text-center">
                Demo: <span className="text-fg/80">test@bash.in / test1234</span> &nbsp;·&nbsp; <span className="text-fg/80">club@bash.in / club1234</span>
            </div>
        </>
    );
}

const ageFrom = (dob) => {
    const d = new Date(dob);
    if (isNaN(d)) return 0;
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a;
};

function RoleChooser() {
    const sp = useSearchParams();
    const next = sp.get("next");
    const opts = [
        ["user", "I'm a user", "Book tickets and get into events."],
        ["club", "I'm a business owner", "Clubs, venues and organisers. List events and manage your door."],
    ];
    return (
        <div className="space-y-3" data-testid="role-chooser">
            {opts.map(([id, title, text]) => (
                <Link
                    key={id}
                    href={`/register?as=${id}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                    data-testid={`role-${id}`}
                    className="block rounded-2xl bg-fg/5 border border-fg/10 p-5 hover:border-brand/50 hover:bg-fg/10 transition"
                >
                    <div className="font-display text-lg font-semibold">{title}</div>
                    <div className="font-body text-sm text-fg/60 mt-1">{text}</div>
                </Link>
            ))}
            <div className="text-center mt-6 text-sm font-body text-fg/60">
                Already have an account? <Link href="/login" className={linkCls} data-testid="goto-login">Sign in</Link>
            </div>
        </div>
    );
}

function UserSignupForm() {
    const { register } = useAuth();
    const nav = useNav();
    const sp = useSearchParams();
    const [step, setStep] = useState(1);
    const [v, setV] = useState({ name: "", email: "", password: "", phone: "", city: "", dob: "", instagram: "", agree: false });
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

    const check = () => {
        if (step === 1) {
            if (!v.name.trim()) return "Enter your full name";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return "Enter a valid email address";
            if (v.password.length < 8) return "Password must be at least 8 characters";
        }
        if (step === 2) {
            if (!/^(\+91)?[6-9]\d{9}$/.test(v.phone.replace(/[\s-]/g, ""))) return "Enter a valid 10-digit mobile number";
            if (!v.city) return "Choose your city";
            if (!v.dob || ageFrom(v.dob) < 18) return "You must be 18 or older to sign up";
        }
        if (step === 3 && !v.agree) return "Please accept the terms to continue";
        return "";
    };

    const submit = async (e) => {
        e.preventDefault();
        const m = check();
        if (m) return setErr(m);
        setErr("");
        if (step < 3) return setStep(step + 1);
        setLoading(true);
        try {
            const u = await register(v.name, v.email, v.password, { phone: v.phone, city: v.city, dob: v.dob, instagram: v.instagram });
            nav(safeNext(sp.get("next"), homeFor(u?.role)));
        } catch (e) {
            setErr(formatErr(e.response?.data?.detail) || e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-3" data-testid="user-signup">
            <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3].map((n) => (
                    <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? "bg-brand" : "bg-fg/10"}`} />
                ))}
                <span className="font-body text-xs text-fg/50 ml-1">Step {step} of 3</span>
            </div>

            {step === 1 && (
                <>
                    <input data-testid="auth-name" placeholder="Full name" value={v.name} onChange={set("name")} className={input} />
                    <input data-testid="auth-email" type="email" placeholder="Email" value={v.email} onChange={set("email")} className={input} />
                    <input data-testid="auth-password" type="password" placeholder="Password (8+ characters)" value={v.password} onChange={set("password")} className={input} />
                </>
            )}

            {step === 2 && (
                <>
                    <input data-testid="auth-phone" type="tel" inputMode="numeric" placeholder="Mobile number" value={v.phone} onChange={set("phone")} className={input} />
                    <select data-testid="auth-city" value={v.city} onChange={set("city")} className={input}>
                        <option value="" className="text-canvas">Select your city</option>
                        {CITIES.map((c) => (
                            <option key={c.slug} value={c.slug} className="text-canvas">{c.name}</option>
                        ))}
                    </select>
                    <label className="block font-body text-xs text-fg/50">Date of birth (18+ only)</label>
                    <input data-testid="auth-dob" type="date" value={v.dob} onChange={set("dob")} max={new Date().toISOString().slice(0, 10)} className={input} />
                </>
            )}

            {step === 3 && (
                <>
                    <input data-testid="auth-instagram" placeholder="Instagram handle (optional)" value={v.instagram} onChange={set("instagram")} className={input} />
                    <label className="flex items-start gap-3 font-body text-sm text-fg/70">
                        <input data-testid="auth-agree" type="checkbox" checked={v.agree} onChange={set("agree")} className="mt-1" />
                        <span>I confirm I am 18 or older and agree to the Bash terms and privacy policy.</span>
                    </label>
                </>
            )}

            {err && <div data-testid="auth-error" className="text-sm text-danger-ink font-body">{err}</div>}

            <div className="flex gap-3">
                {step > 1 && (
                    <button type="button" onClick={() => { setErr(""); setStep(step - 1); }} className="rounded-full px-6 py-4 border border-fg/15 font-display font-semibold hover:bg-fg/5 transition">
                        Back
                    </button>
                )}
                <button type="submit" disabled={loading} data-testid="auth-submit" className={submitCls}>
                    {loading ? "Please wait…" : step < 3 ? "Continue" : "Create account"}
                </button>
            </div>
        </form>
    );
}

export default function AuthPage({ mode = "login" }) {
    const sp = useSearchParams();
    const as = sp.get("as");
    const audience = as === "club" || as === "user" ? as : null; // only used on the register page
    const [title, sub] =
        mode === "login" ? COPY.login : audience === "club" ? COPY.club : audience === "user" ? COPY.user : COPY.register;

    return (
        <div className="min-h-screen flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
                <Link href="/" className="flex items-center gap-3 justify-center mb-8" data-testid="auth-brand-link">
                    <LogoMark size={48} />
                    <Wordmark className="text-3xl" />
                </Link>

                <h1 className="font-display text-4xl font-bold tracking-tight text-center">{title}</h1>
                <p className="font-body text-fg/60 text-center mt-2 mb-8">{sub}</p>

                {mode === "login" && <LoginForm />}
                {mode === "register" && !audience && <RoleChooser />}
                {mode === "register" && audience === "user" && <UserSignupForm key="signup-user" />}
                {mode === "register" && audience === "club" && <BusinessLeadForm key="signup-club" />}

                {mode === "register" && audience && (
                    <div className="text-center mt-6 text-sm font-body text-fg/60 space-y-2">
                        <div>
                            Already have an account? <Link href="/login" className={linkCls} data-testid="goto-login">Sign in</Link>
                        </div>
                        <div>
                            <Link href="/register" className={linkCls} data-testid="change-role">Change account type</Link>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
