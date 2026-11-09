// The Bash logo. Placeholder "B" tile: replace the contents of LogoMark when the real logo is ready
// and it changes in the app header, the loading screen and the splash screen at once.
export function LogoMark({ size = 36, className = "" }) {
    return (
        <div
            className={`rounded-xl bg-brand flex items-center justify-center font-display font-bold ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.5 }}
            aria-hidden="true"
        >
            B
        </div>
    );
}

export function Wordmark({ className = "" }) {
    return <span className={`font-display tracking-tight ${className}`}>Bash</span>;
}
