import { Platform } from "react-native";

function readQaParam(name: string): string | null {
  if (Platform.OS !== "web") return null;
  if (typeof window === "undefined") return null;
  try {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const fromSearch = new URLSearchParams(search).get(name);
    if (fromSearch != null) return fromSearch;

    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      const fromHashQuery = new URLSearchParams(hash.slice(qIdx + 1)).get(name);
      if (fromHashQuery != null) return fromHashQuery;
    }

    const bare = hash.replace(/^#/, "");
    if (bare && !bare.includes("/")) {
      return new URLSearchParams(bare).get(name);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GitHub Pages QA: `?cloud=1` (search or hash) prefers SignIn/SignUp/Join
 * over restoring or offering local demo.
 */
export function preferCloudQaFromUrl(): boolean {
  return readQaParam("cloud") === "1";
}

/**
 * GitHub Pages QA: `?mockPhoto=1` skips the native file picker and returns
 * a tiny PNG data-URI so Storage upload + cross-device smoke can run in automation.
 */
export function preferMockPhotoQaFromUrl(): boolean {
  return readQaParam("mockPhoto") === "1";
}
