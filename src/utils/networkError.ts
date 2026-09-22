/**
 * Detect transport / offline failures after frenchCloudError (or raw Error.message).
 * Used to fall through to the offline mutation queue.
 */
export function isCloudNetworkError(message: string): boolean {
  const msg = (message || "").toLowerCase();
  return (
    /réseau|reseau|network|timeout|fetch|offline|failed to fetch|network request failed|networkerror|err_internet|err_name_not_resolved|load failed|the internet connection appears to be offline|connexion internet/i.test(
      msg
    )
  );
}
