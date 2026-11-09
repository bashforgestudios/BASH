"use client";
// Client hook for the Appearance setting. The chosen mode is saved on this device.
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODE, MODES, THEME_KEY, resolveTheme } from "@/lib/theme";

function readMode() {
    try {
        const m = localStorage.getItem(THEME_KEY);
        return MODES.includes(m) ? m : DEFAULT_MODE;
    } catch {
        return DEFAULT_MODE;
    }
}

function apply(mode) {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const theme = resolveTheme(mode, { prefersDark });
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0F0E0D" : "#F6F2EA");
    return theme;
}

let current = { mode: DEFAULT_MODE, theme: "dark" };
const listeners = new Set();
const emit = (patch) => {
    current = { ...current, ...patch };
    listeners.forEach((fn) => fn(current));
};

export function setThemeMode(mode) {
    if (!MODES.includes(mode)) return;
    try {
        localStorage.setItem(THEME_KEY, mode);
    } catch {}
    emit({ mode, theme: apply(mode) });
}

export function useTheme() {
    const [state, setState] = useState(current);

    useEffect(() => {
        const mode = readMode();
        emit({ mode, theme: apply(mode) });
        listeners.add(setState);

        // Follow the device: its appearance setting changing, the clock passing 6:00 / 18:00,
        // or the tab coming back to the front after a long sleep.
        const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
        const refresh = () => emit({ theme: apply(current.mode) });
        mq?.addEventListener?.("change", refresh);
        const tick = setInterval(refresh, 60 * 1000);
        document.addEventListener("visibilitychange", refresh);
        const onStorage = (e) => {
            if (e.key === THEME_KEY) emit({ mode: readMode(), theme: apply(readMode()) }); // another tab changed it
        };
        window.addEventListener("storage", onStorage);
        return () => {
            listeners.delete(setState);
            mq?.removeEventListener?.("change", refresh);
            clearInterval(tick);
            document.removeEventListener("visibilitychange", refresh);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    const setMode = useCallback((m) => setThemeMode(m), []);
    return { mode: state.mode, theme: state.theme, setMode };
}
