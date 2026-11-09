import "./globals.css";
import Providers from "./providers";
import { THEME_SCRIPT } from "@/lib/theme";

export const metadata = {
    title: "Bash — Live Events & Clubs in India",
    description: "Live concerts, club nights and festivals across India.",
};


export default function RootLayout({ children }) {
    return (
        <html lang="en" data-theme="dark" suppressHydrationWarning>
            <head>
                {/* sets the theme before first paint so there is no flash */}
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
                <meta name="theme-color" content="#0F0E0D" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link
                    href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600,700&display=swap"
                    rel="stylesheet"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
