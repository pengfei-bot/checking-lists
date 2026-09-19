import { Platform } from "react-native";

/**
 * Web Unicode coverage: RN Web Text defaults to `font: 14px System`, which does
 * not inherit body font-family. Comma-separated stacks on RN `fontFamily` props
 * are unreliable on web (often treated as one name or overridden by the
 * `font` shorthand) — Noto Sans has Cyrillic but not Devanagari → Hindi tofu.
 *
 * Apply the full stack only via real CSS so the browser can use Google Fonts
 * unicode-range fallback (Noto Sans Devanagari, Arabic, etc.).
 * Do not set multi-family strings on RN Text/TextInput fontFamily.
 */
export const WEB_FONT_STACK =
  '"Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans Thai", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Noto+Sans:wght@400;600;700;800",
    "family=Noto+Sans+Devanagari:wght@400;600;700",
    "family=Noto+Sans+Arabic:wght@400;700",
    "family=Noto+Sans+Hebrew:wght@400;700",
    "family=Noto+Sans+Thai:wght@400;700",
    "family=Noto+Sans+SC:wght@400;700",
    "family=Noto+Sans+JP:wght@400;700",
    "family=Noto+Sans+KR:wght@400;700",
  ].join("&") +
  "&display=swap";

let fontsPromise: Promise<void> | null = null;

function injectWebFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  if (!document.getElementById("checking-lists-font-css")) {
    const style = document.createElement("style");
    style.id = "checking-lists-font-css";
    // !important beats RN Web Text `font: 14px System` atomic classes.
    style.textContent = `
      html, body, #root {
        font-family: ${WEB_FONT_STACK};
      }
      #root *,
      #root [class*="css-"] {
        font-family: ${WEB_FONT_STACK} !important;
      }
    `;
    document.head.appendChild(style);
  }

  const existing = document.getElementById(
    "checking-lists-noto"
  ) as HTMLLinkElement | null;
  if (existing) {
    if (existing.dataset.loaded === "1") return Promise.resolve();
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      window.setTimeout(() => resolve(), 1500);
    });
  }

  const preconnect1 = document.createElement("link");
  preconnect1.rel = "preconnect";
  preconnect1.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement("link");
  preconnect2.rel = "preconnect";
  preconnect2.href = "https://fonts.gstatic.com";
  preconnect2.crossOrigin = "anonymous";
  document.head.appendChild(preconnect2);

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.id = "checking-lists-noto";
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_HREF;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      link.dataset.loaded = "1";
      resolve();
    };
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    document.head.appendChild(link);
    // Cap wait so a blocked CDN never hangs the UI.
    window.setTimeout(done, 3000);
  });
}

/**
 * Inject Google Fonts + CSS Unicode stack on web. Resolves after stylesheet
 * load (or timeout). Safe to call multiple times — shares one promise.
 * Does NOT set RN Text/TextInput fontFamily (avoids Hindi tofu).
 */
export function applyAppFonts(): Promise<void> {
  if (Platform.OS !== "web") return Promise.resolve();
  if (!fontsPromise) fontsPromise = injectWebFonts();
  return fontsPromise;
}

/** Sync document lang for a11y / engine hints (call when i18n locale changes). */
export function syncDocumentLang(language: string | undefined | null): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (!language) return;
  document.documentElement.lang = language;
}
