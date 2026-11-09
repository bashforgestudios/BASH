/** @type {import('tailwindcss').Config} */
// Colors come from CSS variables (src/app/globals.css) so the whole app can switch between
// light and dark, and swap its accent, without touching components.
// Each variable holds "R G B" channels so opacity utilities like bg-fg/10 keep working.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"), // page background
        surface: v("surface"), // popups, drawers, raised panels
        fg: v("fg"), // text and tints: text-fg/60, bg-fg/5, border-fg/10
        brand: { DEFAULT: v("brand"), ink: v("brand-ink"), fg: v("brand-fg") },
        danger: { DEFAULT: v("danger"), ink: v("danger-ink") },
        success: { DEFAULT: v("success"), ink: v("success-ink") },
        warning: { DEFAULT: v("warning"), ink: v("warning-ink") },
      },
    },
  },
  plugins: [],
};
