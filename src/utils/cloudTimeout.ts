/** Race a cloud promise against a hard timeout so UI never spins forever. */
export async function withCloudTimeout<T>(
  promise: Promise<T>,
  ms = 15_000,
  label = "Opération cloud"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} trop longue (${Math.round(ms / 1000)}s). Vérifiez le réseau et réessayez.`
            )
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Map raw Supabase / PostgREST errors to short French messages. */
export function frenchCloudError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const msg = raw.toLowerCase();
  if (msg.includes("trop longue") || msg.includes("timeout")) return raw;
  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("violates row-level") ||
    msg.includes("permission denied") ||
    msg.includes("42501")
  ) {
    return "Accès refusé (RLS). Vérifiez que votre compte parent est bien membre de la famille, puis reconnectez-vous.";
  }
  if (msg.includes("jwt") || msg.includes("not authenticated") || msg.includes("401")) {
    return "Session expirée. Déconnectez-vous puis reconnectez-vous.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch")) {
    return "Réseau indisponible. Vérifiez la connexion Internet.";
  }
  if (msg.includes("family") && (msg.includes("null") || msg.includes("required"))) {
    return "Famille cloud introuvable (family_id manquant). Reconnectez-vous.";
  }
  return raw || fallback;
}
