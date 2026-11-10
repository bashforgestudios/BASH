"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Facebook, Instagram, MessageCircle, Youtube } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";
import QRCode from "@/components/QRCode";
import { CITIES } from "@/lib/geo";
import { setCity } from "@/lib/useLocation";
import { useNav } from "@/lib/useNav";

// ---- Fill these in with the real addresses. Anything left empty is shown as plain text (not a dead link).
const CONTACT_HREF = ""; // e.g. "mailto:hello@yourdomain.in"
const LEGAL = { terms: "", privacy: "" }; // e.g. "/terms", "/privacy"
const XIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);
const SOCIALS = [
    { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle, href: "" },
    { id: "facebook", label: "Facebook", Icon: Facebook, href: "" },
    { id: "instagram", label: "Instagram", Icon: Instagram, href: "" },
    { id: "x", label: "X", Icon: XIcon, href: "" },
    { id: "youtube", label: "YouTube", Icon: Youtube, href: "" },
];

const linkCls = "font-body text-sm text-fg/60 transition hover:text-fg";

/** A real link when it has an address, plain text when it doesn't. */
function FooterLink({ href, children, className = linkCls }) {
    if (!href) return <span className="font-body text-sm text-fg/60 cursor-default">{children}</span>;
    const external = /^(https?:|mailto:)/.test(href);
    return external ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={className}>
            {children}
        </a>
    ) : (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}

function Column({ title, children, className = "", listClass = "space-y-3" }) {
    return (
        <div className={className}>
            <h3 className="mb-4 font-display text-base font-semibold text-fg">{title}</h3>
            <ul className={listClass}>{children}</ul>
        </div>
    );
}

export default function SiteFooter({ user }) {
    const nav = useNav();
    const [origin, setOrigin] = useState("");
    useEffect(() => setOrigin(window.location.origin), []);

    return (
        <footer className="mt-16 border-t border-fg/10" data-testid="site-footer">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 pb-10 pt-12 md:grid-cols-[1.2fr_1fr_1fr_1fr_1.5fr] md:gap-x-10 md:px-10">
                {/* Brand */}
                <div className="col-span-2 md:col-span-1">
                    <Link href="/" className="inline-flex items-center gap-3" aria-label="Bash home">
                        <LogoMark size={44} />
                        <span>
                            <Wordmark className="block text-3xl leading-none" />
                            <span className="mt-1.5 block whitespace-nowrap font-body text-[10px] font-bold uppercase tracking-[0.25em] text-fg/60">
                                by forgestudios
                            </span>
                        </span>
                    </Link>
                    <div className="mt-6 flex items-center gap-4 text-fg/80">
                        {SOCIALS.map(({ id, label, Icon, href }) =>
                            href ? (
                                <a key={id} href={href} target="_blank" rel="noreferrer" aria-label={label} className="transition hover:text-brand-ink">
                                    <Icon className="h-5 w-5" />
                                </a>
                            ) : (
                                <span key={id} aria-label={label} title={label} className="cursor-default">
                                    <Icon className="h-5 w-5" />
                                </span>
                            ),
                        )}
                    </div>
                </div>

                <Column title="Help">
                    <li><FooterLink href={CONTACT_HREF}>Contact Us</FooterLink></li>
                    <li><FooterLink href="/tickets">Your tickets</FooterLink></li>
                    <li><FooterLink href={user ? "/profile" : "/login"}>{user ? "Your profile" : "Sign in"}</FooterLink></li>
                </Column>

                <Column title="Quick Links">
                    <li><FooterLink href="/business">List your events</FooterLink></li>
                    <li><FooterLink href="/business">List your club</FooterLink></li>
                    <li><FooterLink href="/">Live now</FooterLink></li>
                </Column>

                <Column title="Explore cities" className="col-span-2 md:col-span-1" listClass="grid grid-cols-3 gap-x-4 gap-y-3 md:grid-cols-1">
                    {CITIES.map((c) => (
                        <li key={c.slug}>
                            <button
                                type="button"
                                onClick={() => {
                                    setCity(c.slug);
                                    nav("/");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className={linkCls}
                            >
                                {c.name}
                            </button>
                        </li>
                    ))}
                </Column>

                {/* Download app: coming soon */}
                <div className="hidden md:block">
                    <h3 className="mb-4 font-display text-base font-semibold text-fg">Download App</h3>
                    <div className="group flex items-center gap-5 rounded-2xl border border-fg/10 bg-fg/5 p-5" data-testid="footer-app-card">
                        <div className="relative h-28 w-28 shrink-0 rounded-2xl bg-white p-2">
                            {origin && <QRCode value={origin} label="Bash app QR code (coming soon)" className="h-full w-full rounded-lg opacity-30 blur-[1.5px]" />}
                            <span className="sticker-metal absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                                Coming soon
                            </span>
                        </div>
                        <div>
                            <div className="font-display text-lg font-semibold leading-snug">Scan to Download</div>
                            <div className="mt-1 font-body text-sm text-fg/60">iOS &amp; Android apps are on the way.</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-fg/10">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 md:px-10">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p className="font-body text-sm text-fg/50">© {new Date().getFullYear()} Bash by forgestudios. All rights reserved.</p>
                        <div className="flex items-center gap-7 font-body text-sm">
                            <FooterLink href={LEGAL.terms} className="text-fg/70 transition hover:text-fg">Terms &amp; Conditions</FooterLink>
                            <FooterLink href={LEGAL.privacy} className="text-fg/70 transition hover:text-fg">Privacy Policy</FooterLink>
                        </div>
                    </div>
                    <p className="font-body text-xs text-fg/40">
                        By accessing this page, you confirm that you have read, understood, and agreed to our Terms &amp; Conditions and Privacy Policy.
                    </p>
                </div>
            </div>
        </footer>
    );
}
