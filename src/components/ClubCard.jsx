"use client";
import { MapPin } from "lucide-react";

export default function ClubCard({ club, selected, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(selected ? null : club.id)}
            data-testid={`club-${club.id}`}
            className={`shrink-0 w-64 text-left rounded-2xl border p-4 transition ${
                selected
                    ? "border-brand bg-brand/10"
                    : "border-fg/10 bg-fg/5 hover:bg-fg/10"
            }`}
        >
            <div className="font-display font-semibold truncate">{club.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-fg/50 font-body mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{club.address}</span>
            </div>
            <div className="text-xs font-body mt-3 text-fg/60">
                {selected ? "Showing this club's events · tap to clear" : "Tap to see its events"}
            </div>
        </button>
    );
}
