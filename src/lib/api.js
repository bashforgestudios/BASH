import axios from "axios";

// Requests go to /api/* on this Next.js app, which proxies to the backend (see next.config.js)
export const API = "/api";

// Sessions live in httpOnly cookies (set by /api/auth/*), so no token is kept in JavaScript.
export const api = axios.create({ baseURL: API, withCredentials: true });

// True when a session cookie exists (the flag cookie holds no secret).
export const hasSession = () => typeof document !== "undefined" && document.cookie.includes("bash_sid=1");

// When an access token has expired (401), refresh once and replay the request. Parallel 401s share one refresh.
let refreshing = null;
const NO_RETRY = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const { config, response } = error;
        const retryable = response?.status === 401 && config && !config._retried && !NO_RETRY.some((u) => config.url?.startsWith(u));
        if (!retryable || !hasSession()) throw error;
        config._retried = true;
        try {
            refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
            await refreshing;
            return api(config);
        } catch {
            if (typeof window !== "undefined") window.dispatchEvent(new Event("bash:session-expired"));
            throw error;
        }
    },
);

export function formatErr(detail) {
    if (!detail) return "Something went wrong";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
    if (detail?.msg) return detail.msg;
    return String(detail);
}

export const inr = (n) =>
    "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// Resize hosted images (Unsplash / Pexels accept ?w=)
export function resizeImg(url, w) {
    try {
        const u = new URL(url);
        u.searchParams.set("w", String(w));
        return u.toString();
    } catch {
        return url;
    }
}
