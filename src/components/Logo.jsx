// The Bash logo. Every place that shows it (header, splash screen, loading screen, profile)
// goes through LogoMark, so swapping the files in /public changes it everywhere at once.
//   public/logo.svg      master artwork (vector shapes, embedded disco ball)
//   public/logo-256.png  what the app displays (small, crisp up to ~85px on a 3x screen)
// The browser-tab and home-screen icons live in src/app (favicon.ico, icon.png, apple-icon.png).
export function LogoMark({ size = 36, className = "" }) {
    return (
        <img
            src="/logo-256.png"
            width={size}
            height={size}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`shrink-0 rounded-[22%] ring-1 ring-fg/10 select-none ${className}`}
            style={{ width: size, height: size }}
        />
    );
}

export function Wordmark({ className = "" }) {
    return <span className={`font-display tracking-tight ${className}`}>Bash</span>;
}
