import { LogoMark } from "@/components/Logo";

// Shown by Next.js while a page is loading during navigation.
export default function Loading() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="splash-logo">
                <LogoMark size={56} className="text-brand-fg" />
            </div>
        </div>
    );
}
