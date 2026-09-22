import i18n from "../i18n/i18n";

/** Race a cloud promise against a hard timeout so UI never spins forever. */
export async function withCloudTimeout<T>(
  promise: Promise<T>,
  ms = 15_000,
  label?: string
): Promise<T> {
  const opLabel = label ?? i18n.t("cloud.defaultLabel");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              i18n.t("cloud.timeout", {
                label: opLabel,
                seconds: Math.round(ms / 1000),
              })
            )
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Map raw Supabase / PostgREST errors to short localized messages. */
export function frenchCloudError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const msg = raw.toLowerCase();
  if (msg.includes("trop longue") || msg.includes("timeout") || msg.includes("took too long")) return raw;
  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("violates row-level") ||
    msg.includes("permission denied") ||
    msg.includes("42501")
  ) {
    return i18n.t("cloud.rls");
  }
  if (msg.includes("jwt") || msg.includes("not authenticated") || msg.includes("401")) {
    return i18n.t("cloud.sessionExpired");
  }
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch")) {
    return i18n.t("cloud.network");
  }
  if (msg.includes("family") && (msg.includes("null") || msg.includes("required"))) {
    return i18n.t("cloud.familyMissing");
  }
  return raw || fallback;
}
