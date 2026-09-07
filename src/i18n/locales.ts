/** BCP-47 tags: major Europe + Asia languages for Checking Lists. */
export const EUROPE_LOCALES = [
  "en", "fr", "de", "es", "it", "pt", "nl", "pl", "ru", "uk", "ro", "el",
  "sv", "da", "fi", "no", "cs", "sk", "hu", "bg", "hr", "sr", "sl", "lt",
  "lv", "et", "ga", "mt", "tr",
] as const;

export const ASIA_LOCALES = [
  "zh-Hans", "zh-Hant", "ja", "ko", "hi", "th", "vi", "id", "ms", "fil",
  "bn", "ta", "ur", "fa", "ar", "he", "kk", "uz", "az", "ka", "hy", "ne",
  "si", "my", "km", "lo", "mn",
] as const;

export const SUPPORTED_LOCALES = [...EUROPE_LOCALES, ...ASIA_LOCALES] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "@checking_lists_locale";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  uk: "Українська",
  ro: "Română",
  el: "Ελληνικά",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  no: "Norsk",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
  bg: "Български",
  hr: "Hrvatski",
  sr: "Српски",
  sl: "Slovenščina",
  lt: "Lietuvių",
  lv: "Latviešu",
  et: "Eesti",
  ga: "Gaeilge",
  mt: "Malti",
  tr: "Türkçe",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  hi: "हिन्दी",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  fil: "Filipino",
  bn: "বাংলা",
  ta: "தமிழ்",
  ur: "اردو",
  fa: "فارسی",
  ar: "العربية",
  he: "עברית",
  kk: "Қазақша",
  uz: "Oʻzbekcha",
  az: "Azərbaycanca",
  ka: "ქართული",
  hy: "Հայերեն",
  ne: "नेपाली",
  si: "සිංහල",
  my: "မြန်မာ",
  km: "ខ្មែរ",
  lo: "ລາວ",
  mn: "Монгол",
};

export function resolveDeviceLocale(tag: string | undefined | null): AppLocale {
  if (!tag) return "fr";
  const normalized = tag.replace(/_/g, "-");
  const lower = normalized.toLowerCase();

  if (lower.startsWith("zh")) {
    if (
      lower.includes("hant") ||
      lower.includes("tw") ||
      lower.includes("hk") ||
      lower.includes("mo")
    ) {
      return "zh-Hant";
    }
    return "zh-Hans";
  }

  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === lower);
  if (exact) return exact;

  const primary = lower.split("-")[0] ?? lower;
  const aliases: Record<string, AppLocale> = {
    nb: "no",
    nn: "no",
    tl: "fil",
    iw: "he",
    ji: "he",
    cn: "zh-Hans",
    jp: "ja",
    kr: "ko",
  };
  if (aliases[primary]) return aliases[primary];

  const byPrimary = SUPPORTED_LOCALES.find(
    (l) => l.toLowerCase() === primary || l.toLowerCase().startsWith(primary + "-")
  );
  return byPrimary ?? "fr";
}

export function dateLocaleTag(locale: string): string {
  if (locale === "zh-Hans") return "zh-CN";
  if (locale === "zh-Hant") return "zh-TW";
  if (locale === "no") return "nb-NO";
  return locale;
}
