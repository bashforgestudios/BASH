"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Centered popup. Closes on Cancel, the X, the Escape key or a click on the dark backdrop.
export default function Modal({ open, title, subtitle, onClose, children, busy = false }) {
    const boxRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape" && !busy) onClose();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        // focus the first field so the person can type straight away
        setTimeout(() => boxRef.current?.querySelector("input,select,textarea")?.focus(), 30);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, busy, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
            role="presentation"
        >
            <div
                ref={boxRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0e0b1a] p-5 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-display text-xl font-semibold">{title}</h2>
                        {subtitle && <p className="font-body text-xs text-white/50 mt-1">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
