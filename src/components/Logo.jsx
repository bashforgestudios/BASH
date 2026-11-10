"use client";

import { useState } from "react";

// The Bash logo. Every place that shows it (header, splash screen, loading screen, profile, home and
// sign-in pages) goes through LogoMark, so swapping the files in /public changes it everywhere at once.
//   public/logo.svg      master artwork (vector shapes, embedded disco ball)
//   public/logo-256.png  what the app displays (small, crisp up to ~85px on a 3x screen)
// The browser-tab and home-screen icons live in src/app (favicon.ico, icon.png, apple-icon.png).
// If the image ever fails to load, a gradient "B" tile is shown instead of leaving a blank gap.
export function LogoMark({ size = 36, className = "" }) {
    const [failed, setFailed] = useState(false);
    const box = `shrink-0 rounded-[22%] ring-1 ring-fg/10 select-none ${className}`;

    if (failed) {
        return (
            <span
                aria-hidden="true"
                className={`${box} inline-flex items-center justify-center bg-gradient-to-br from-[#ff3d9a] to-[#6a1b9a] font-display font-bold text-white`}
                style={{ width: size, height: size, fontSize: size * 0.55 }}
            >
                B
            </span>
        );
    }
    return (
        <img
            src="/logo-256.png"
            width={size}
            height={size}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => setFailed(true)}
            className={box}
            style={{ width: size, height: size }}
        />
    );
}

export function Wordmark({ className = "" }) {
    return <span className={`font-display tracking-tight ${className}`}>Bash</span>;
}
