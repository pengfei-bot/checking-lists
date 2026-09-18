import { Platform } from "react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase";
import { withCloudTimeout } from "./cloudTimeout";

/**
 * Fast online probe (Supabase Auth health). Prefer this before a long cloud load
 * so offline cold-start can fall back to cache in ~2–3s instead of 20s.
 *
 * On web: respect navigator.onLine and bypass HTTP cache so airplane / DevTools
 * Offline is not mistaken for a healthy connection.
 */
export async function probeOnline(ms = 2_500): Promise<boolean> {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`;
    await withCloudTimeout(
      fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }).then((res) => {
        if (!res.ok && res.status >= 500) throw new Error(`health ${res.status}`);
        return res;
      }),
      ms,
      "probe"
    );
    return true;
  } catch {
    return false;
  }
}
