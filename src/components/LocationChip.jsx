"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, ChevronDown, Check, LocateFixed } from "lucide-react";
import { CITIES, DEFAULT_CITY } from "@/lib/geo";
import { useLocation, requestLocation, setCity } from "@/lib/useLocation";

// City picker shown next to the Bash logo: a pill that opens a glass menu with every city,
// the active one ticked, and a "use my location" shortcut. Replaces the native <select>.
export default function LocationChip({ className = "" }) {
    const { city, status } = useLocation();
    const slug = city || DEFAULT_CITY;
    const name = CITIES.find((c) => c.slug === slug)?.name || "Pune";
    const [open, setOpen] = useState(false);
    const root = useRef(null);

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (root.current && !root.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const pick = (s) => {
        setCity(s);
        setOpen(false);
    };

    return (
        <div ref={root} className={`relative inline-block text-left ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                data-testid="location-chip"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Choose city"
                className="group flex items-center gap-1.5 rounded-full border border-fg/10 bg-fg/5 py-1 pl-2.5 pr-2 text-xs font-body text-fg/80 transition hover:bg-fg/10 hover:text-fg"
            >
                {status === "asking" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-brand-ink" />
                ) : (
                    <MapPin className="h-3 w-3 text-brand-ink" />
                )}
                <span data-testid="location-city" className="font-semibold">{name}</span>
                <ChevronDown className={`h-3 w-3 text-fg/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-label="Cities"
                    data-testid="city-menu"
                    className="city-menu absolute left-0 top-full z-50 mt-2 w-56 origin-top-left overflow-hidden rounded-2xl border border-fg/10 bg-surface/90 p-1.5 shadow-2xl backdrop-blur-xl"
                >
                    <button
                        type="button"
                        onClick={() => {
                            requestLocation();
                            setOpen(false);
                        }}
                        data-testid="city-use-location"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-body text-brand-ink transition hover:bg-fg/5"
                    >
                        <LocateFixed className="h-3.5 w-3.5" />
                        Use my current location
                    </button>
                    {status === "denied" && (
                        <div className="px-3 pb-1 text-[10px] text-fg/40 font-body">Location is off in your browser</div>
                    )}
                    <div className="my-1 h-px bg-fg/10" />
                    <div className="max-h-64 overflow-y-auto no-scrollbar">
                        {CITIES.map((c) => {
                            const active = c.slug === slug;
                            return (
                                <button
                                    key={c.slug}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    data-testid={`city-${c.slug}`}
                                    onClick={() => pick(c.slug)}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-body text-sm transition ${
                                        active ? "bg-fg/10 text-fg font-semibold" : "text-fg/70 hover:bg-fg/5 hover:text-fg"
                                    }`}
                                >
                                    {c.name}
                                    {active && <Check className="h-4 w-4 text-brand-ink" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
