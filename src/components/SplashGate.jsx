"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const MIN_MS = 450; // avoids a flash when everything is already cached

// Hides the splash once the app has hydrated and the sign-in check has finished.
export default function SplashGate() {
    const { loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        const el = document.getElementById("bash-splash");
        if (!el) return;
        const wait = Math.max(0, MIN_MS - performance.now());
        const t = setTimeout(() => {
            el.classList.add("hide"); // stays in the DOM, hidden and click-through

        }, wait);
        return () => clearTimeout(t);
    }, [loading]);

    return null;
}
