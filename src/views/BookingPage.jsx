"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useNav } from "@/lib/useNav";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Shield,
    Check,
    CreditCard,
    Smartphone,
    Building2,
    Loader2,
    PartyPopper,
    Hourglass,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import TicketCard from "@/components/TicketCard";
import { api, formatErr, inr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Attendee", "ID Verification", "Payment"];

export default function BookingPage() {
    const { id } = useParams();
    const sp = useSearchParams();
    const tierName = sp.get("tier") || "VIP";
    const nav = useNav();
    const { user } = useAuth();

    const [event, setEvent] = useState(null);
    const [step, setStep] = useState(0);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPay, setShowPay] = useState(false);
    const [done, setDone] = useState(null); // the paid booking, shown on the confirmation screen

    const [form, setForm] = useState({
        attendee_name: user?.name || "",
        attendee_phone: "",
        attendee_email: user?.email || "",
        quantity: 1,
        id_type: "Aadhaar",
        id_number: "",
    });

    const [bookingId, setBookingId] = useState(null);
    const [payMethod, setPayMethod] = useState("upi");
    const [idPhoto, setIdPhoto] = useState(null);
    const [photoErr, setPhotoErr] = useState("");
    const bookingType = event?.booking_type || "non_exclusive";
    const needsPhoto = bookingType !== "non_exclusive";
    const BOOKING_NOTE = {
        guestlist: "Guestlist request. It is free and the club reviews it before a ticket is issued.",
        exclusive: "Exclusive booking. The club reviews your booking after payment. If it is declined you are refunded.",
    };

    const onPhoto = (file) => {
        setPhotoErr("");
        if (!file) {
            setIdPhoto(null);
            return;
        }
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            setPhotoErr("Upload a JPG, PNG or WebP photo");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setPhotoErr("Photo must be under 2 MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setIdPhoto(reader.result);
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        api.get(`/events/${id}`).then((r) => setEvent(r.data));
    }, [id]);

    if (!event)
        return (
            <AppShell hideBottomNav>
                <div className="p-10 text-fg/60">Loading…</div>
            </AppShell>
        );
    const tier = event.tiers.find(
        (t) => t.name.toLowerCase() === tierName.toLowerCase(),
    );
    const amount = bookingType === "guestlist" ? 0 : (tier?.price || 0) * form.quantity;

    if (done) return <Confirmation booking={done} nav={nav} />;

    const next = () => {
        setErr("");
        if (step === 0) {
            if (
                !form.attendee_name ||
                !form.attendee_phone ||
                !form.attendee_email
            ) {
                setErr("Please fill all attendee fields");
                return;
            }
            if (!/^\+?\d{10,13}$/.test(form.attendee_phone.replace(/\s/g, ""))) {
                setErr("Enter a valid phone number");
                return;
            }
            setStep(1);
        } else if (step === 1) {
            if (needsPhoto && !idPhoto) {
                setErr("Upload a photo of your ID for this booking");
                return;
            }
            const clean = form.id_number.replace(/\s|-/g, "");
            if (form.id_type === "Aadhaar") {
                if (!/^\d{12}$/.test(clean)) {
                    setErr("Aadhaar must be a 12-digit number");
                    return;
                }
            } else if (clean.length < 6) {
                setErr("Enter a valid ID number");
                return;
            }
            createBooking();
        }
    };

    const createBooking = async () => {
        setLoading(true);
        setErr("");
        try {
            const { data } = await api.post("/bookings", {
                event_id: id,
                tier: tier.name,
                quantity: form.quantity,
                attendee_name: form.attendee_name,
                attendee_phone: form.attendee_phone,
                attendee_email: form.attendee_email,
                id_type: form.id_type,
                id_number: form.id_number,
                id_photo: idPhoto,
            });
            setBookingId(data.id);
            setStep(2);
        } catch (e) {
            setErr(formatErr(e.response?.data?.detail) || e.message);
        } finally {
            setLoading(false);
        }
    };

    const pay = async () => {
        setShowPay(true);
    };

    const confirmPay = async () => {
        setLoading(true);
        try {
            await new Promise((r) => setTimeout(r, 1200));
            const { data } = await api.post("/bookings/pay", {
                booking_id: bookingId,
                payment_method: payMethod,
            });
            setShowPay(false);
            setDone(data);
            if (typeof window !== "undefined") window.scrollTo({ top: 0 });
        } catch (e) {
            setErr(formatErr(e.response?.data?.detail) || e.message);
            setShowPay(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppShell hideBottomNav>
            <div className="max-w-2xl mx-auto px-5 md:px-10 py-8">
                <button
                    onClick={() => (step === 0 ? nav(-1) : setStep(step - 1))}
                    data-testid="booking-back-btn"
                    className="flex items-center gap-2 text-fg/60 hover:text-fg mb-6 font-body text-sm"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {/* Steps */}
                <div className="flex items-center justify-between mb-8">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className="flex items-center gap-2 flex-1 last:flex-none"
                        >
                            <div
                                data-testid={`step-indicator-${i}`}
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-sm font-bold ${
                                    i < step
                                        ? "bg-brand"
                                        : i === step
                                          ? "bg-fg text-canvas"
                                          : "bg-fg/10 text-fg/40"
                                }`}
                            >
                                {i < step ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            <span
                                className={`font-body text-xs md:text-sm ${i === step ? "text-fg" : "text-fg/40"}`}
                            >
                                {s}
                            </span>
                            {i < STEPS.length - 1 && (
                                <div className="flex-1 h-px bg-fg/10 mx-2" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Event summary, styled as a ticket */}
                <MiniTicket event={event} tier={tier} quantity={form.quantity} amount={amount} />

                {BOOKING_NOTE[bookingType] && (
                    <div
                        data-testid="booking-type-note"
                        className="rounded-2xl bg-brand/10 border border-brand/20 p-4 mb-6 font-body text-sm text-fg/80"
                    >
                        {BOOKING_NOTE[bookingType]}
                    </div>
                )}

                {/* Step bodies */}
                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div
                            key="s0"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            className="space-y-4"
                        >
                            <h2 className="font-display text-2xl font-semibold">
                                Who&apos;s going?
                            </h2>
                            <Input
                                label="Full name"
                                testid="attendee-name"
                                value={form.attendee_name}
                                onChange={(v) =>
                                    setForm({ ...form, attendee_name: v })
                                }
                            />
                            <Input
                                label="Phone"
                                testid="attendee-phone"
                                value={form.attendee_phone}
                                onChange={(v) =>
                                    setForm({ ...form, attendee_phone: v })
                                }
                                placeholder="+91 98xxxxxxxx"
                            />
                            <Input
                                label="Email"
                                testid="attendee-email"
                                type="email"
                                value={form.attendee_email}
                                onChange={(v) =>
                                    setForm({ ...form, attendee_email: v })
                                }
                            />
                            <div>
                                <label className="block text-xs text-fg/50 font-body mb-1.5">
                                    Quantity
                                </label>
                                <div className="flex items-center gap-3">
                                    {[1, 2, 3, 4].map((q) => (
                                        <button
                                            key={q}
                                            data-testid={`qty-${q}`}
                                            onClick={() =>
                                                setForm({ ...form, quantity: q })
                                            }
                                            className={`w-12 h-12 rounded-xl font-display font-bold ${
                                                form.quantity === q
                                                    ? "bg-fg text-canvas"
                                                    : "bg-fg/5 text-fg border border-fg/10"
                                            }`}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div
                            key="s1"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            className="space-y-4"
                        >
                            <div className="flex items-start gap-3 rounded-2xl bg-brand/10 border border-brand/20 p-4">
                                <Shield className="w-5 h-5 text-brand-ink shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-display font-semibold">
                                        ID Verification
                                    </div>
                                    <p className="text-xs text-fg/70 font-body mt-1">
                                        Required by venue entry. Your ID stays
                                        encrypted — only the last 4 digits are
                                        stored.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-fg/50 font-body mb-1.5">
                                    ID Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {["Aadhaar", "PAN", "Passport"].map((t) => (
                                        <button
                                            key={t}
                                            data-testid={`idtype-${t.toLowerCase()}`}
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    id_type: t,
                                                    id_number: "",
                                                })
                                            }
                                            className={`py-3 rounded-xl font-body text-sm ${
                                                form.id_type === t
                                                    ? "bg-fg text-canvas"
                                                    : "bg-fg/5 text-fg border border-fg/10"
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Input
                                label={`${form.id_type} Number`}
                                testid="id-number"
                                value={form.id_number}
                                onChange={(v) =>
                                    setForm({ ...form, id_number: v })
                                }
                                placeholder={
                                    form.id_type === "Aadhaar"
                                        ? "12-digit Aadhaar number"
                                        : form.id_type === "PAN"
                                          ? "ABCDE1234F"
                                          : "Passport No."
                                }
                            />
                            {needsPhoto && (
                                <div data-testid="id-photo-block">
                                    <label className="block text-xs text-fg/50 font-body mb-1.5">
                                        Photo of your ID (required for this booking)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        data-testid="id-photo"
                                        onChange={(e) => onPhoto(e.target.files?.[0])}
                                        className="w-full text-sm font-body text-fg/70 file:mr-3 file:rounded-full file:border-0 file:bg-fg/10 file:px-4 file:py-2 file:text-fg"
                                    />
                                    {photoErr && <p className="text-xs text-danger-ink font-body mt-2">{photoErr}</p>}
                                    <p className="text-[11px] text-fg/40 font-body mt-2">
                                        The club deletes this photo as soon as it approves or rejects your booking.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="s2"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            className="space-y-4"
                        >
                            <h2 className="font-display text-2xl font-semibold">
                                Payment
                            </h2>
                            <p className="font-body text-sm text-fg/60">
                                Choose how you&apos;d like to pay. Powered by
                                Razorpay (demo).
                            </p>

                            <div className="space-y-2 mt-4">
                                <PayOption
                                    icon={<Smartphone className="w-5 h-5" />}
                                    label="UPI"
                                    sub="GPay, PhonePe, Paytm"
                                    active={payMethod === "upi"}
                                    onClick={() => setPayMethod("upi")}
                                    testid="pay-upi"
                                />
                                <PayOption
                                    icon={<CreditCard className="w-5 h-5" />}
                                    label="Card"
                                    sub="Visa, Mastercard, Rupay"
                                    active={payMethod === "card"}
                                    onClick={() => setPayMethod("card")}
                                    testid="pay-card"
                                />
                                <PayOption
                                    icon={<Building2 className="w-5 h-5" />}
                                    label="Net Banking"
                                    sub="All major banks"
                                    active={payMethod === "netbanking"}
                                    onClick={() => setPayMethod("netbanking")}
                                    testid="pay-netbanking"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {err && (
                    <div
                        data-testid="booking-error"
                        className="mt-4 text-sm text-danger-ink font-body"
                    >
                        {err}
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    {step < 2 && (
                        <button
                            onClick={next}
                            disabled={loading}
                            data-testid="booking-next-btn"
                            className="flex-1 rounded-full py-4 bg-brand font-display font-semibold hover:scale-[1.01] transition disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                                "Continue"
                            )}
                        </button>
                    )}
                    {step === 2 && (
                        <button
                            onClick={pay}
                            disabled={loading}
                            data-testid="pay-now-btn"
                            className="flex-1 rounded-full py-4 bg-brand font-display font-semibold hover:scale-[1.01] transition"
                        >
                            Pay {inr(amount)}
                        </button>
                    )}
                </div>
            </div>

            {/* Razorpay-like mock modal */}
            <AnimatePresence>
                {showPay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
                        data-testid="razorpay-modal"
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className="w-full max-w-md bg-surface rounded-3xl p-6 border border-fg/10 relative"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-[#0a2540] flex items-center justify-center font-display font-bold text-fg">
                                        R
                                    </div>
                                    <div>
                                        <div className="font-display font-semibold">
                                            Razorpay
                                        </div>
                                        <div className="text-[10px] text-fg/40 font-body">
                                            SECURED CHECKOUT · DEMO
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPay(false)}
                                    className="text-fg/50 text-sm font-body"
                                    data-testid="rzp-close"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="rounded-2xl bg-fg/5 p-4 mb-4">
                                <div className="text-xs text-fg/50 font-body">
                                    Amount payable
                                </div>
                                <div className="font-display text-4xl font-bold">
                                    {inr(amount)}
                                </div>
                                <div className="text-xs text-fg/50 font-body mt-1">
                                    {event.artist} · {tier?.name} × {form.quantity}
                                </div>
                            </div>

                            {payMethod === "upi" && (
                                <div className="space-y-2 mb-4">
                                    <label className="text-xs text-fg/60 font-body">
                                        UPI ID
                                    </label>
                                    <input
                                        defaultValue="demo@okaxis"
                                        data-testid="rzp-upi"
                                        className="w-full rounded-xl bg-fg/5 border border-fg/10 px-3 py-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                                    />
                                </div>
                            )}
                            {payMethod === "card" && (
                                <div className="space-y-2 mb-4">
                                    <input
                                        defaultValue="4111 1111 1111 1111"
                                        data-testid="rzp-card"
                                        className="w-full rounded-xl bg-fg/5 border border-fg/10 px-3 py-3 font-body text-sm"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            defaultValue="12/28"
                                            className="rounded-xl bg-fg/5 border border-fg/10 px-3 py-3 font-body text-sm"
                                        />
                                        <input
                                            defaultValue="123"
                                            className="rounded-xl bg-fg/5 border border-fg/10 px-3 py-3 font-body text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                            {payMethod === "netbanking" && (
                                <div className="mb-4">
                                    <select
                                        data-testid="rzp-bank"
                                        className="w-full rounded-xl bg-fg/5 border border-fg/10 px-3 py-3 font-body text-sm"
                                    >
                                        <option>HDFC Bank</option>
                                        <option>ICICI Bank</option>
                                        <option>SBI</option>
                                        <option>Axis Bank</option>
                                    </select>
                                </div>
                            )}

                            <button
                                onClick={confirmPay}
                                disabled={loading}
                                data-testid="rzp-confirm"
                                className="w-full rounded-full py-4 bg-brand font-display font-semibold disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    `Pay ${inr(amount)}`
                                )}
                            </button>

                            <p className="text-[10px] text-fg/40 text-center mt-3 font-body">
                                This is a demo. No real money is charged.
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AppShell>
    );
}

function Input({ label, value, onChange, testid, type = "text", placeholder }) {
    return (
        <div>
            <label className="block text-xs text-fg/50 font-body mb-1.5">
                {label}
            </label>
            <input
                data-testid={testid}
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl bg-fg/5 border border-fg/10 px-4 py-3 font-body text-sm placeholder:text-fg/30 focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
        </div>
    );
}

function PayOption({ icon, label, sub, active, onClick, testid }) {
    return (
        <button
            data-testid={testid}
            onClick={onClick}
            className={`w-full rounded-2xl p-4 flex items-center gap-4 border transition ${
                active
                    ? "border-brand bg-brand"
                    : "border-fg/10 bg-fg/5 hover:bg-fg/10"
            }`}
        >
            <div className="w-10 h-10 rounded-xl bg-fg/5 flex items-center justify-center">
                {icon}
            </div>
            <div className="flex-1 text-left">
                <div className="font-display font-semibold">{label}</div>
                <div className="text-xs text-fg/50 font-body">{sub}</div>
            </div>
            <div
                className={`w-5 h-5 rounded-full border-2 ${active ? "border-brand bg-brand" : "border-fg/30"}`}
            />
        </button>
    );
}

function MiniTicket({ event, tier, quantity, amount }) {
    return (
        <div
            data-testid="booking-mini-ticket"
            className="mini-ticket mb-6 flex overflow-hidden rounded-2xl bg-brand shadow-lg shadow-brand/30"
        >
            <img src={event.image} alt={event.title} className="w-24 shrink-0 object-cover" />
            <div className="min-w-0 flex-1 p-4 text-brand-fg">
                <div className="truncate font-display text-base font-bold leading-tight">{event.artist || event.title}</div>
                <div className="mt-1 truncate text-xs font-body text-brand-fg/80">{event.venue}</div>
                <div className="mt-0.5 text-xs font-body text-brand-fg/80">
                    {event.date}
                    {event.time ? ` · ${event.time}` : ""}
                </div>
            </div>
            <div className="flex w-28 shrink-0 flex-col items-end justify-center border-l-2 border-dashed border-brand-fg/40 px-4 text-right text-brand-fg">
                <div className="text-[10px] uppercase tracking-widest text-brand-fg/70 font-body">{tier?.name}</div>
                <div className="text-[11px] font-body text-brand-fg/80">× {quantity}</div>
                <div className="mt-1 font-display text-xl font-bold">{inr(amount)}</div>
            </div>
        </div>
    );
}

const CONFIRM_COPY = {
    approved: {
        icon: PartyPopper,
        title: "You're in!",
        text: "Payment received. Your ticket is ready, show the QR at the gate.",
    },
    pending: {
        icon: Hourglass,
        title: "Booking received",
        text: "The club will review it shortly. Your QR appears on the ticket as soon as it is approved.",
    },
};

function Confirmation({ booking, nav }) {
    const copy = CONFIRM_COPY[booking.status] || CONFIRM_COPY.pending;
    const Icon = copy.icon;
    return (
        <AppShell hideBottomNav>
            <div data-testid="booking-confirmation" className="mx-auto max-w-md px-5 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[36px] bg-brand p-5 pb-7 shadow-2xl shadow-brand/40"
                >
                    <div className="mb-4 flex items-center gap-3 px-1 text-brand-fg">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-fg/15">
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-bold leading-tight">{copy.title}</h1>
                            <p className="mt-0.5 text-xs text-brand-fg/80 font-body">{copy.text}</p>
                        </div>
                    </div>

                    <TicketCard ticket={booking} />

                    <div className="mt-5 flex justify-center gap-1.5" aria-hidden="true">
                        <span className="h-1.5 w-6 rounded-full bg-brand-fg" />
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-fg/40" />
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-fg/40" />
                    </div>
                </motion.div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                        onClick={() => nav(`/tickets?new=${booking.id}`)}
                        data-testid="view-my-tickets"
                        className="rounded-full bg-brand py-4 font-display font-semibold"
                    >
                        View my tickets
                    </button>
                    <button
                        onClick={() => nav("/")}
                        className="rounded-full border border-fg/15 bg-fg/5 py-4 font-display font-semibold hover:bg-fg/10"
                    >
                        Browse events
                    </button>
                </div>
            </div>
        </AppShell>
    );
}
