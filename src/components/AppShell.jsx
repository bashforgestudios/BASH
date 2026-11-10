"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";
import NavLink from "@/components/NavLink";
import LocationChip from "@/components/LocationChip";
import SiteFooter from "@/components/SiteFooter";
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
    const pathname = usePathname();
    const links = LINKS[user ? user.role || "user" : "guest"] || LINKS.user;

    // Bottom-nav tabs: the role's links plus Log out / Sign in.
    const items = [
        ...links.map((l) => ({ ...l, testid: `mob-nav-${l.id}` })),
        user && user.role && user.role !== "user"
            ? {
                  id: "logout",
                  label: "Log out",
                  icon: LogOut,
                  testid: "mob-nav-logout",
                  onClick: () => {
                      logout();
                      nav("/");
                  },
              }
            : user
              ? null
              : { id: "account", label: "Sign in", icon: User, href: "/login", testid: "mob-nav-account" },
    ].filter(Boolean);
    const activeIndex = items.findIndex(
        (it) => it.href && (it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(it.href + "/")),
    );

    return (
        <div className="min-h-screen w-full flex flex-col">
            {/* Top bar — only on >= md */}
            <header className="hidden md:flex items-center justify-between px-10 py-4 border-b border-fg/5 sticky top-0 z-40 backdrop-blur-xl bg-canvas/70">
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2" data-testid="brand-link">
                        <LogoMark size={36} className="text-brand-fg" />
                        <Wordmark className="text-xl" />
                    </Link>
                    {/* City dropdown sits right next to the logo */}
                    <LocationChip />
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

            {!hideBottomNav && <SiteFooter user={user} />}

            {/* Mobile bottom nav: a frosted-glass pill slides under the active tab */}
            {!hideBottomNav && (
                <nav
                    aria-label="Primary"
                    className="md:hidden sticky bottom-0 z-40 px-5 pt-2 pointer-events-none"
                    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                >
                    <div className="glass-nav pointer-events-auto relative mx-auto flex max-w-xs items-stretch rounded-full p-1.5">
                        {activeIndex >= 0 && (
                            <span
                                aria-hidden
                                className="glass-slider absolute bottom-1.5 left-1.5 top-1.5 rounded-full"
                                style={{
                                    width: `calc((100% - 0.75rem) / ${items.length})`,
                                    transform: `translateX(${activeIndex * 100}%)`,
                                }}
                            />
                        )}
                        {items.map((it, i) => {
                            const Icon = it.icon;
                            const cls = `relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[10px] font-body tracking-wide transition-colors duration-300 ${
                                i === activeIndex ? "text-fg font-semibold" : "text-fg/50"
                            }`;
                            const inner = (
                                <>
                                    <Icon className={`h-5 w-5 transition-transform duration-300 ${i === activeIndex ? "scale-110" : ""}`} />
                                    {it.label}
                                </>
                            );
                            return it.href ? (
                                <NavLink key={it.id} href={it.href} end={it.href === "/"} data-testid={it.testid} className={cls}>
                                    {inner}
                                </NavLink>
                            ) : (
                                <button key={it.id} onClick={it.onClick} data-testid={it.testid} className={cls}>
                                    {inner}
                                </button>
                            );
                        })}
                    </div>
                </nav>
            )}
        </div>
    );
}
