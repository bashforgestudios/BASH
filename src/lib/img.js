// Right-sized images. The seed data points at 1600 px wide photos (hundreds of KB each) even for small
// cards. For Unsplash URLs this asks for the width actually needed, and auto=format lets the CDN send
// WebP/AVIF. Other URLs (uploaded flyers served by /api/assets) are returned unchanged.
export function sized(url, width, quality = 75) {
    if (!url) return url;
    try {
        const u = new URL(url);
        if (u.hostname !== "images.unsplash.com") return url;
        u.searchParams.set("w", String(width));
        u.searchParams.set("q", String(quality));
        u.searchParams.set("auto", "format");
        u.searchParams.delete("fm");
        return u.toString();
    } catch {
        return url;
    }
}

/** srcset string for responsive images, or undefined when the URL can't be resized. */
export function srcSet(url, widths = [480, 800, 1200]) {
    if (!url || sized(url, 1) === url) return undefined;
    return widths.map((w) => `${sized(url, w)} ${w}w`).join(", ");
}
