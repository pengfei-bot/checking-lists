import en from "./locales/en.json";
import fr from "./locales/fr.json";
import locale_de from "./locales/de.json";
import locale_es from "./locales/es.json";
import locale_it from "./locales/it.json";
import locale_pt from "./locales/pt.json";
import locale_nl from "./locales/nl.json";
import locale_pl from "./locales/pl.json";
import locale_ru from "./locales/ru.json";
import locale_uk from "./locales/uk.json";
import locale_ro from "./locales/ro.json";
import locale_el from "./locales/el.json";
import locale_sv from "./locales/sv.json";
import locale_da from "./locales/da.json";
import locale_fi from "./locales/fi.json";
import locale_no from "./locales/no.json";
import locale_cs from "./locales/cs.json";
import locale_sk from "./locales/sk.json";
import locale_hu from "./locales/hu.json";
import locale_bg from "./locales/bg.json";
import locale_hr from "./locales/hr.json";
import locale_sr from "./locales/sr.json";
import locale_sl from "./locales/sl.json";
import locale_lt from "./locales/lt.json";
import locale_lv from "./locales/lv.json";
import locale_et from "./locales/et.json";
import locale_ga from "./locales/ga.json";
import locale_mt from "./locales/mt.json";
import locale_tr from "./locales/tr.json";
import locale_zh_Hans from "./locales/zh-Hans.json";
import locale_zh_Hant from "./locales/zh-Hant.json";
import locale_ja from "./locales/ja.json";
import locale_ko from "./locales/ko.json";
import locale_hi from "./locales/hi.json";
import locale_th from "./locales/th.json";
import locale_vi from "./locales/vi.json";
import locale_id from "./locales/id.json";
import locale_ms from "./locales/ms.json";
import locale_fil from "./locales/fil.json";
import locale_bn from "./locales/bn.json";
import locale_ta from "./locales/ta.json";
import locale_ur from "./locales/ur.json";
import locale_fa from "./locales/fa.json";
import locale_ar from "./locales/ar.json";
import locale_he from "./locales/he.json";
import locale_kk from "./locales/kk.json";
import locale_uz from "./locales/uz.json";
import locale_az from "./locales/az.json";
import locale_ka from "./locales/ka.json";
import locale_hy from "./locales/hy.json";
import locale_ne from "./locales/ne.json";
import locale_si from "./locales/si.json";
import locale_my from "./locales/my.json";
import locale_km from "./locales/km.json";
import locale_lo from "./locales/lo.json";
import locale_mn from "./locales/mn.json";


/** Drop "" values so i18next falls through to fallbackLng (fr → en). */
function stripEmptyStrings<T>(value: T): T {
  if (typeof value === "string") {
    return (value.trim() === "" ? undefined : value) as T;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripEmptyStrings(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

function pack(translation: typeof fr) {
  return { translation: stripEmptyStrings(translation) as typeof fr };
}

/** Metro-safe explicit resource map for all supported locales. */
export const resources: Record<string, { translation: typeof fr }> = {
  en: pack(en),
  fr: pack(fr),
  "de": pack(locale_de),
  "es": pack(locale_es),
  "it": pack(locale_it),
  "pt": pack(locale_pt),
  "nl": pack(locale_nl),
  "pl": pack(locale_pl),
  "ru": pack(locale_ru),
  "uk": pack(locale_uk),
  "ro": pack(locale_ro),
  "el": pack(locale_el),
  "sv": pack(locale_sv),
  "da": pack(locale_da),
  "fi": pack(locale_fi),
  "no": pack(locale_no),
  "cs": pack(locale_cs),
  "sk": pack(locale_sk),
  "hu": pack(locale_hu),
  "bg": pack(locale_bg),
  "hr": pack(locale_hr),
  "sr": pack(locale_sr),
  "sl": pack(locale_sl),
  "lt": pack(locale_lt),
  "lv": pack(locale_lv),
  "et": pack(locale_et),
  "ga": pack(locale_ga),
  "mt": pack(locale_mt),
  "tr": pack(locale_tr),
  "zh-Hans": pack(locale_zh_Hans),
  "zh-Hant": pack(locale_zh_Hant),
  "ja": pack(locale_ja),
  "ko": pack(locale_ko),
  "hi": pack(locale_hi),
  "th": pack(locale_th),
  "vi": pack(locale_vi),
  "id": pack(locale_id),
  "ms": pack(locale_ms),
  "fil": pack(locale_fil),
  "bn": pack(locale_bn),
  "ta": pack(locale_ta),
  "ur": pack(locale_ur),
  "fa": pack(locale_fa),
  "ar": pack(locale_ar),
  "he": pack(locale_he),
  "kk": pack(locale_kk),
  "uz": pack(locale_uz),
  "az": pack(locale_az),
  "ka": pack(locale_ka),
  "hy": pack(locale_hy),
  "ne": pack(locale_ne),
  "si": pack(locale_si),
  "my": pack(locale_my),
  "km": pack(locale_km),
  "lo": pack(locale_lo),
  "mn": pack(locale_mn),
};

