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


/** Latin / English names for picker clarity when native script may tofu. */
export const LOCALE_LATIN_NAMES: Record<AppLocale, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  uk: "Ukrainian",
  ro: "Romanian",
  el: "Greek",
  sv: "Swedish",
  da: "Danish",
  fi: "Finnish",
  no: "Norwegian",
  cs: "Czech",
  sk: "Slovak",
  hu: "Hungarian",
  bg: "Bulgarian",
  hr: "Croatian",
  sr: "Serbian",
  sl: "Slovenian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  ga: "Irish",
  mt: "Maltese",
  tr: "Turkish",
  "zh-Hans": "Chinese Simplified",
  "zh-Hant": "Chinese Traditional",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  fil: "Filipino",
  bn: "Bengali",
  ta: "Tamil",
  ur: "Urdu",
  fa: "Persian",
  ar: "Arabic",
  he: "Hebrew",
  kk: "Kazakh",
  uz: "Uzbek",
  az: "Azerbaijani",
  ka: "Georgian",
  hy: "Armenian",
  ne: "Nepali",
  si: "Sinhala",
  my: "Burmese",
  km: "Khmer",
  lo: "Lao",
  mn: "Mongolian",
};

/** Native name + Latin transliteration, e.g. "हिन्दी (Hindi)". */
export function formatLocaleLabel(code: AppLocale): string {
  const native = LOCALE_LABELS[code];
  const latin = LOCALE_LATIN_NAMES[code];
  if (!latin || latin === native) return native;
  // Append Latin name when native label uses non-Latin scripts (Cyrillic, CJK, …).
  let needsLatinHint = false;
  for (const ch of native) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0x24f) continue; // Basic Latin + Latin-1 + Extended-A/B
    if (cp >= 0x1e00 && cp <= 0x1eff) continue; // Latin Extended Additional
    needsLatinHint = true;
    break;
  }
  if (!needsLatinHint) return native;
  return `${native} (${latin})`;
}

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


/**
 * Extra resource keys that map onto a canonical AppLocale.
 * i18next may resolve zh-Hans → zh / zh-hans / zh-CN; keep catalogs under all forms.
 * (Only Chinese uses script/region tags among our supported locales today.)
 */
export const LOCALE_RESOURCE_ALIASES: Record<string, AppLocale> = {
  "zh-hans": "zh-Hans",
  "zh-CN": "zh-Hans",
  "zh-cn": "zh-Hans",
  zh: "zh-Hans",
  "zh-hant": "zh-Hant",
  "zh-TW": "zh-Hant",
  "zh-tw": "zh-Hant",
  "zh-HK": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-MO": "zh-Hant",
  "zh-mo": "zh-Hant",
};

/** Canonical AppLocale for an i18n language / alias tag, or null if unknown. */
export function canonicalizeLocale(tag: string | undefined | null): AppLocale | null {
  if (!tag) return null;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
    return tag as AppLocale;
  }
  const aliased = LOCALE_RESOURCE_ALIASES[tag];
  if (aliased) return aliased;
  // case-insensitive alias / supported match
  const lower = tag.toLowerCase();
  for (const [alias, canonical] of Object.entries(LOCALE_RESOURCE_ALIASES)) {
    if (alias.toLowerCase() === lower) return canonical;
  }
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === lower);
  return exact ?? null;
}

export function dateLocaleTag(locale: string): string {
  if (locale === "zh-Hans") return "zh-CN";
  if (locale === "zh-Hant") return "zh-TW";
  if (locale === "no") return "nb-NO";
  return locale;
}
