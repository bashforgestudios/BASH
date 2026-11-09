// Theme logic shared by the pre-paint script in layout.jsx and the settings UI.
// Modes: "light" | "dark" | "system" (follow the device's own appearance setting, which phones
// and computers can switch on a schedule or at sunset) | "time" (light 6:00 to 18:00 by the device clock).
// No "use client" here: layout.jsx (a server component) needs THEME_SCRIPT.

export const THEME_KEY = "bash_theme";
export const MODES = ["light", "dark", "system", "time"];
export const DEFAULT_MODE = "system";
export const DAY_START = 6; // hour the "time" mode turns light
export const NIGHT_START = 18; // hour it turns dark

export function resolveTheme(mode, { prefersDark, hour } = {}) {
    if (mode === "light" || mode === "dark") return mode;
    if (mode === "time") {
        const h = hour ?? new Date().getHours();
        return h >= DAY_START && h < NIGHT_START ? "light" : "dark";
    }
    return (prefersDark ?? false) ? "dark" : "light";
}

// Runs in <head> before the first paint so the page never flashes the wrong theme.
// Keep it dependency-free and in sync with resolveTheme() above.
export const THEME_SCRIPT = `(function(){try{
var m=localStorage.getItem("${THEME_KEY}");
if(["light","dark","system","time"].indexOf(m)<0)m="${DEFAULT_MODE}";
var d=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
var h=new Date().getHours();
var t=m==="light"||m==="dark"?m:m==="time"?(h>=${DAY_START}&&h<${NIGHT_START}?"light":"dark"):(d?"dark":"light");
var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;
var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",t==="dark"?"#0F0E0D":"#F6F2EA");
}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();`;
