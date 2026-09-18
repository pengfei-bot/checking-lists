import { Platform } from "react-native";

/**
 * GitHub Pages QA: `?cloud=1` (search or hash) prefers SignIn/SignUp/Join
 * over restoring or offering local demo.
 */
export function preferCloudQaFromUrl(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  try {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const fromSearch = new URLSearchParams(search).get("cloud");
    if (fromSearch === "1") return true;

    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      const fromHashQuery = new URLSearchParams(hash.slice(qIdx + 1)).get("cloud");
      if (fromHashQuery === "1") return true;
    }

    // e.g. #cloud=1
    const bare = hash.replace(/^#/, "");
    if (bare && !bare.includes("/") && new URLSearchParams(bare).get("cloud") === "1") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
