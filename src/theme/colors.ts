export const colors = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  primary: "#4F6EF7",
  primarySoft: "#E8EDFF",
  success: "#22A06B",
  successSoft: "#E6F7EF",
  warning: "#F5A524",
  danger: "#E5484D",
  text: "#1C1F2A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  kidBg: "#FFF7ED",
  parentBg: "#F0F7FF",
};

/** M5 palette — 8 circular pastilles (orange → grey). */
export const childColors = [
  "#FF8A65", // orange
  "#4FC3F7", // cyan
  "#81C784", // green
  "#BA68C8", // purple
  "#F48FB1", // pink
  "#FFD54F", // yellow
  "#5C6BC0", // royal blue
  "#90A4AE", // grey
];

/**
 * Soft rgba tint from a hex color. Keeps navy text readable —
 * prefer low alpha (0.12–0.28) for headers / card fills.
 */
export function softTint(hex: string, alpha = 0.2): string {
  const raw = (hex || "").trim().replace(/^#/, "");
  if (raw.length !== 6 && raw.length !== 3) {
    return `rgba(255, 214, 182, ${alpha})`; // peach fallback
  }
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(255, 214, 182, ${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}
