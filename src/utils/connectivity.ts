import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase";
import { withCloudTimeout } from "./cloudTimeout";

/**
 * Fast online probe (Supabase Auth health). Prefer this before a long cloud load
 * so offline cold-start can fall back to cache in ~2–3s instead of 20s.
 */
export async function probeOnline(ms = 2_500): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`;
    await withCloudTimeout(
      fetch(url, {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
