"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, formatErr, hasSession } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // The session is an httpOnly cookie. If none exists there is nothing to ask the server.
        if (!hasSession()) {
            setLoading(false);
            return;
        }
        api.get("/auth/me")
            .then((r) => setUser(r.data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    // A refresh failed somewhere (revoked, expired, signed out on another device).
    useEffect(() => {
        const onExpired = () => setUser(null);
        window.addEventListener("bash:session-expired", onExpired);
        return () => window.removeEventListener("bash:session-expired", onExpired);
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        setUser(data.user);
        return data.user;
    };

    const register = async (name, email, password, extra = {}) => {
        const { data } = await api.post("/auth/register", { name, email, password, ...extra });
        setUser(data.user);
        return data.user;
    };

    // everywhere: also sign out every other device
    const logout = useCallback(async ({ everywhere = false } = {}) => {
        try {
            await api.post("/auth/logout", { everywhere });
        } catch {
            // cookies are cleared by the server when it can be reached; the local state is cleared regardless
        }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, formatErr }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
