import "./globals.css";
import Providers from "./providers";
import Splash from "@/components/Splash";
import SplashGate from "@/components/SplashGate";
import { THEME_SCRIPT } from "@/lib/theme";

export const metadata = {
    title: "Bash — Live Events & Clubs in India",
    description: "Live concerts, club nights and festivals across India.",
};


const FONT_URLS = [
    "https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600,700&display=swap",
    "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap",
];
const FONT_SCRIPT = `(function(){${JSON.stringify(FONT_URLS)}.forEach(function(u){var l=document.createElement("link");l.rel="stylesheet";l.href=u;document.head.appendChild(l)})})();`;

export default function RootLayout({ children }) {
    return (
        <html lang="en" data-theme="dark" suppressHydrationWarning>
            <head>
                {/* sets the theme before first paint so there is no flash */}
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
                <meta name="theme-color" content="#0F0E0D" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link rel="preconnect" href="https://api.fontshare.com" />
                <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
                <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
                {/* Fonts load without blocking the first paint (text shows in a system font, then swaps). */}
                <script dangerouslySetInnerHTML={{ __html: FONT_SCRIPT }} />
                <noscript>
                    <link href={FONT_URLS[0]} rel="stylesheet" />
                    <link href={FONT_URLS[1]} rel="stylesheet" />
                </noscript>
            </head>
            <body>
                <Splash />
                <Providers>
                    <SplashGate />
                    {children}
                </Providers>
            </body>
        </html>
    );
}
