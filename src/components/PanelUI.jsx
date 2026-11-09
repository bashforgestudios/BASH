"use client";
// Shared building blocks for the Club, Gate and Developer panels.

export const inputCls =
    "w-full rounded-xl bg-fg/5 border border-fg/10 px-3.5 py-2.5 font-body text-sm text-fg placeholder:text-fg/30 outline-none focus:border-brand transition";

export function Card({ title, subtitle, action, children, className = "" }) {
    return (
        <section className={`rounded-3xl border border-fg/10 bg-fg/5 p-5 md:p-6 ${className}`}>
            {(title || action) && (
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
                        {subtitle && <p className="font-body text-xs text-fg/50 mt-1">{subtitle}</p>}
                    </div>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

export function Field({ label, hint, children, className = "" }) {
    return (
        <label className={`block ${className}`}>
            <span className="block font-body text-[11px] uppercase tracking-widest text-fg/50 mb-1.5">{label}</span>
            {children}
            {hint && <span className="block font-body text-[11px] text-fg/40 mt-1">{hint}</span>}
        </label>
    );
}

const BTN = {
    primary: "bg-brand text-brand-fg hover:scale-[1.02]",
    ghost: "bg-fg/5 hover:bg-fg/10 border border-fg/10 text-fg",
    good: "bg-success/15 hover:bg-success/25 border border-success/30 text-success-ink",
    danger: "bg-danger/15 hover:bg-danger/25 border border-danger/30 text-danger-ink",
};

export function Btn({ variant = "ghost", className = "", type = "button", ...props }) {
    return (
        <button
            type={type}
            {...props}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-body text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
        />
    );
}

const TONE = {
    grey: "bg-fg/5 text-fg/70 border-fg/15",
    green: "bg-success/15 text-success-ink border-success/30",
    amber: "bg-warning/15 text-warning-ink border-warning/30",
    red: "bg-danger/15 text-danger-ink border-danger/30",
    blue: "bg-brand/15 text-brand-ink border-brand/30",
};

export function Badge({ tone = "grey", children, testid }) {
    return (
        <span
            data-testid={testid}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-body whitespace-nowrap ${TONE[tone]}`}
        >
            {children}
        </span>
    );
}

export function Tabs({ tabs, value, onChange }) {
    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange(t.id)}
                    data-testid={`tab-${t.id}`}
                    className={`shrink-0 rounded-full px-4 py-2 font-body text-sm border transition ${
                        value === t.id
                            ? "bg-fg text-canvas border-fg"
                            : "bg-fg/5 text-fg/70 border-fg/10 hover:bg-fg/10"
                    }`}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

export function Empty({ children }) {
    return (
        <div className="rounded-2xl border border-dashed border-fg/15 p-10 text-center font-body text-sm text-fg/50">
            {children}
        </div>
    );
}

export const fmtDateTime = (iso) =>
    iso
        ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
        : "";
