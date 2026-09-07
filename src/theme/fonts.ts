import { Platform, Text, TextInput } from "react-native";

/**
 * Web needs an explicit Unicode-capable stack — system UI fonts on many
 * browsers lack Devanagari/Cyrillic/CJK coverage and render tofu (□).
 * Native OS fonts usually cover these scripts already.
 */
export const APP_FONT_FAMILY =
  Platform.OS === "web"
    ? '"Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans Thai", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    : undefined;

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

let fontsApplied = false;

/** Inject Google Fonts + default Text/TextInput fontFamily on web. Safe to call once. */
export function applyAppFonts(): void {
  if (fontsApplied) return;
  fontsApplied = true;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    if (!document.getElementById("checking-lists-noto")) {
      const preconnect1 = document.createElement("link");
      preconnect1.rel = "preconnect";
      preconnect1.href = "https://fonts.googleapis.com";
      document.head.appendChild(preconnect1);

      const preconnect2 = document.createElement("link");
      preconnect2.rel = "preconnect";
      preconnect2.href = "https://fonts.gstatic.com";
      preconnect2.crossOrigin = "anonymous";
      document.head.appendChild(preconnect2);

      const link = document.createElement("link");
      link.id = "checking-lists-noto";
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }

    if (!document.getElementById("checking-lists-font-css")) {
      const style = document.createElement("style");
      style.id = "checking-lists-font-css";
      style.textContent = `
        html, body, #root {
          font-family: ${APP_FONT_FAMILY};
        }
      `;
      document.head.appendChild(style);
    }
  }

  if (!APP_FONT_FAMILY) return;

  const patch = (Comp: typeof Text) => {
    // React Native still honors defaultProps.style for Text / TextInput.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = Comp as any;
    C.defaultProps = C.defaultProps ?? {};
    const prev = C.defaultProps.style;
    C.defaultProps.style = prev
      ? [{ fontFamily: APP_FONT_FAMILY }, prev]
      : { fontFamily: APP_FONT_FAMILY };
  };

  patch(Text);
  patch(TextInput);
}
