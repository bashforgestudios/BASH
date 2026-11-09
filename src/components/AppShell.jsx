"use client";

import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/Logo";
import NavLink from "@/components/NavLink";
import LocationChip from "@/components/LocationChip";
import { useNav } from "@/lib/useNav";
import { useAuth } from "@/context/AuthContext";
import { Home, Ticket, LogOut, LayoutDashboard, ScanLine, Terminal, User } from "lucide-react";

// Each role gets its own panel. Guests only see the public homepage.
const LINKS = {
    guest: [{ href: "/", label: "Live Now", icon: Home, id: "home" }],
    user: [
        { href: "/", label: "Live Now", icon: Home, id: "home" },
        { href: "/tickets", label: "My Tickets", icon: Ticket, id: "tickets" },
        { href: "/profile", label: "Profile", icon: User, id: "profile" },
    ],
    club_admin: [{ href: "/club", label: "Club Panel", icon: LayoutDashboard, id: "club" }],
    gate: [{ href: "/gate", label: "Gate Scanner", icon: ScanLine, id: "gate" }],
    developer: [
        { href: "/dev", label: "Developer", icon: Terminal, id: "dev" },
        { href: "/", label: "Live Now", icon: Home, id: "home" },
    ],
};

const ROLE_NAME = {
    user: "",
    club_admin: "Club admin",
    gate: "Gate",
    developer: "Developer",
};

const activeCls = (isActive) =>
    isActive ? "text-fg" : "hover:text-fg transition";

export default function AppShell({ children, hideBottomNav = false }) {
    const { user, logout } = useAuth();
    const nav = useNav();
    const links = LINKS[user ? user.role || "user" : "guest"] || LINKS.user;

    return (
        <div className="min-h-screen w-full flex flex-col">
            {/* Top bar — only on >= md */}
            <header className="hidden md:flex items-center justify-between px-10 py-4 border-b border-fg/5 sticky top-0 z-40 backdrop-blur-xl bg-canvas/70">
                <div className="flex flex-col">
                    <Link href="/" className="flex items-center gap-2" data-testid="brand-link">
                        <LogoMark size={36} className="text-brand-fg" />
                        <Wordmark className="text-xl" />
                    </Link>
                    {/* Location sits directly under the logo */}
                    <LocationChip className="ml-11 -mt-0.5" />
                </div>

                <nav className="flex items-center gap-8 font-body text-sm text-fg/70">
                    {links.map((l) => (
                        <NavLink
                            key={l.id}
                            href={l.href}
                            end={l.href === "/"}
                            className={({ isActive }) => activeCls(isActive)}
                            data-testid={`nav-${l.id}`}
                        >
                            {l.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    {user ? (
                        <>
                            <span className="text-sm text-fg/70 font-body" data-testid="user-name">
                                Hi, {user.name?.split(" ")[0]}
                                {ROLE_NAME[user.role] && (
                                    <span className="ml-2 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-fg/10 text-fg/70">
                                        {ROLE_NAME[user.role]}
                                    </span>
                                )}
                            </span>
                            <button
                                onClick={() => {
                                    logout();
                                    nav("/");
                                }}
                                data-testid="logout-btn"
                                aria-label="Log out"
                                className="w-10 h-10 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center transition"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <Link
                            href="/login"
                            data-testid="header-login-btn"
                            className="px-5 py-2 rounded-full bg-brand text-sm font-semibold hover:scale-[1.02] transition"
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </header>

            <main className="flex-1">{children}</main>

            {/* Mobile bottom nav */}
            {!hideBottomNav && (
                <nav className="md:hidden sticky bottom-0 z-40 bg-canvas/90 backdrop-blur-xl border-t border-fg/10 px-4 py-3 flex items-center justify-around">
                    {links.map((l) => {
                        const Icon = l.icon;
                        return (
                            <NavLink
                                key={l.id}
                                href={l.href}
                                end={l.href === "/"}
                                data-testid={`mob-nav-${l.id}`}
                                className={({ isActive }) =>
                                    `flex flex-col items-center gap-1 text-xs ${isActive ? "text-fg" : "text-fg/50"}`
                                }
                            >
                                <Icon className="w-5 h-5" />
                                {l.label}
                            </NavLink>
                        );
                    })}
                    {user ? (
                        <button
                            onClick={() => {
                                logout();
                                nav("/");
                            }}
                            data-testid="mob-nav-logout"
                            className="flex flex-col items-center gap-1 text-xs text-fg/50"
                        >
                            <LogOut className="w-5 h-5" />
                            Log out
                        </button>
                    ) : (
                        <NavLink
                            href="/login"
                            data-testid="mob-nav-account"
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 text-xs ${isActive ? "text-fg" : "text-fg/50"}`
                            }
                        >
                            <User className="w-5 h-5" />
                            Sign in
                        </NavLink>
                    )}
                </nav>
            )}
        </div>
    );
}
