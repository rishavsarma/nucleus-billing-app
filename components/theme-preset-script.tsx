import Script from "next/script"
import { THEME_PRESET_CSS, THEME_PRESET_FONTS, DEFAULT_THEME_PRESET } from "@/lib/theme-presets"
import { THEME_PRESET_STORAGE_KEY } from "@/store/theme-preset-store"

// Runs in <head> before hydration (strategy="beforeInteractive"), so the
// stored color preset is painted on the very first frame instead of
// flashing the default ("violet") palette and then jumping to the saved one
// once React mounts. Mirrors next-themes' own no-flash script for the .dark
// class, but for the color preset layered on top of it — see
// lib/theme-presets.ts for how that layering works. Uses next/script rather
// than a raw <script> tag so Next.js manages it outside the normal React
// tree (a plain <script> re-rendered by React on the client — e.g. during
// Fast Refresh — logs "script tag while rendering" and won't re-execute).
export function ThemePresetScript() {
  const script = `
    (function () {
      try {
        var css = ${JSON.stringify(THEME_PRESET_CSS)};
        var fonts = ${JSON.stringify(THEME_PRESET_FONTS)};
        var raw = localStorage.getItem(${JSON.stringify(THEME_PRESET_STORAGE_KEY)});
        var preset = raw ? JSON.parse(raw)?.state?.preset : null;
        if (!(preset in css)) preset = ${JSON.stringify(DEFAULT_THEME_PRESET)};

        var text = css[preset];
        if (text) {
          var style = document.createElement("style");
          style.id = "theme-preset-override";
          style.textContent = text;
          document.head.appendChild(style);
        }

        (fonts[preset] || []).forEach(function (family) {
          var href = "https://fonts.googleapis.com/css2?family=" +
            encodeURIComponent(family) + ":wght@400;500;600;700&display=swap";
          var link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = href;
          document.head.appendChild(link);
        });
      } catch (e) {}
    })();
  `

  // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- root layout is the documented App Router equivalent of _document.js for this rule; https://nextjs.org/docs/app/api-reference/components/script#beforeinteractive
  return <Script id="theme-preset-init" strategy="beforeInteractive">{script}</Script>
}
