// Branded loading screen, rendered in the server HTML so it is on screen the instant the page arrives,
// before any JavaScript has loaded. SplashGate (client) fades it out once the app is ready.
// If JavaScript never loads, a CSS animation hides it after 8 seconds so the page is never stuck behind it.
import { LogoMark, Wordmark } from "@/components/Logo";

export default function Splash() {
    return (
        <div id="bash-splash" role="status" aria-label="Loading Bash">
            <div className="splash-logo">
                <LogoMark size={72} className="text-brand-fg" />
                <Wordmark className="text-3xl mt-3" />
            </div>
        </div>
    );
}
