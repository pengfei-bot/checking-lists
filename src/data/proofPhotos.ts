import * as Crypto from "expo-crypto";
import { getSupabase, SUPABASE_URL } from "../lib/supabase";
import { frenchCloudError, withCloudTimeout } from "../utils/cloudTimeout";

export const PROOF_PHOTOS_BUCKET = "proof-photos";

/** Stored in task_completions.photo_url — durable path, not a local file URI. */
export const STORAGE_PATH_PREFIX = "storage:proof-photos/";

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function newId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return Crypto.randomUUID();
}

function throwCloud(err: unknown, fallback: string): never {
  throw new Error(frenchCloudError(err, fallback));
}

/** True for local / in-memory URIs that must be uploaded before sync. */
export function isLocalPhotoUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const u = uri.trim();
  if (!u) return false;
  if (u.startsWith(STORAGE_PATH_PREFIX)) return false;
  if (u.startsWith("http://") || u.startsWith("https://")) return false;
  return (
    u.startsWith("file:") ||
    u.startsWith("content:") ||
    u.startsWith("data:") ||
    u.startsWith("blob:") ||
    u.startsWith("ph://") ||
    u.startsWith("assets-library:") ||
    u.startsWith("/")
  );
}

/** Extract bucket-relative path from a stored photo_url value. */
export function storagePathFromPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  const u = photoUrl.trim();
  if (!u) return null;
  if (u.startsWith(STORAGE_PATH_PREFIX)) {
    return u.slice(STORAGE_PATH_PREFIX.length) || null;
  }
  // Legacy / absolute public URL under this project storage
  const marker = `/storage/v1/object/public/${PROOF_PHOTOS_BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${PROOF_PHOTOS_BUCKET}/`;
  for (const m of [marker, signedMarker]) {
    const idx = u.indexOf(m);
    if (idx >= 0) {
      const rest = u.slice(idx + m.length).split("?")[0];
      return rest ? decodeURIComponent(rest) : null;
    }
  }
  // Bare path familyId/...
  if (
    !u.startsWith("http") &&
    !isLocalPhotoUri(u) &&
    u.includes("/") &&
    !u.includes("://")
  ) {
    return u;
  }
  return null;
}

export function toStoredPhotoRef(path: string): string {
  return `${STORAGE_PATH_PREFIX}${path.replace(/^\/+/, "")}`;
}

function guessContentType(uri: string, mimeHint?: string | null): string {
  if (mimeHint && mimeHint.startsWith("image/")) return mimeHint;
  const lower = uri.toLowerCase();
  if (lower.startsWith("data:image/")) {
    const m = /^data:(image\/[a-z0-9.+-]+)/i.exec(uri);
    if (m?.[1]) return m[1].toLowerCase();
  }
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".heic")) return "image/heic";
  if (lower.includes(".heif")) return "image/heif";
  return "image/jpeg";
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("heic")) return "heic";
  if (ct.includes("heif")) return "heif";
  return "jpg";
}

async function uriToUploadBody(
  uri: string
): Promise<{ body: ArrayBuffer | Blob; contentType: string }> {
  const contentType = guessContentType(uri);

  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    if (comma < 0) throw new Error("Photo data URL invalide.");
    const meta = uri.slice(0, comma);
    const b64 = uri.slice(comma + 1);
    const ctMatch = /data:([^;]+)/i.exec(meta);
    const ct = ctMatch?.[1] || contentType;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { body: bytes.buffer, contentType: ct };
  }

  const res = await fetch(uri);
  if (!res.ok) throw new Error("Lecture de la photo locale impossible.");
  const headerCt = res.headers.get("content-type");
  const ct = guessContentType(uri, headerCt);
  const buf = await res.arrayBuffer();
  return { body: buf, contentType: ct };
}

export function buildProofPhotoPath(input: {
  familyId: string;
  childId: string;
  taskId: string;
  date: string;
  contentType?: string;
}): string {
  const ext = extForContentType(input.contentType || "image/jpeg");
  return `${input.familyId}/${input.childId}/${input.taskId}/${input.date}_${newId()}.${ext}`;
}

/**
 * Upload a local/data/blob URI to Supabase Storage.
 * Returns the durable storage ref to persist in task_completions.photo_url.
 */
export async function uploadProofPhoto(input: {
  familyId: string;
  childId: string;
  taskId: string;
  date: string;
  localUri: string;
}): Promise<string> {
  if (!isLocalPhotoUri(input.localUri)) {
    // Already a durable ref or remote URL — keep as storage ref if possible
    const existing = storagePathFromPhotoUrl(input.localUri);
    if (existing) return toStoredPhotoRef(existing);
    if (input.localUri.startsWith(STORAGE_PATH_PREFIX)) return input.localUri;
    // http(s) we don't own — refuse to store as-is without upload
  }

  const supabase = getSupabase();
  const run = async (): Promise<string> => {
    const { body, contentType } = await uriToUploadBody(input.localUri);
    const path = buildProofPhotoPath({ ...input, contentType });
    const { error } = await supabase.storage.from(PROOF_PHOTOS_BUCKET).upload(path, body, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });
    if (error) throwCloud(error, "Envoi de la photo impossible.");
    return toStoredPhotoRef(path);
  };

  try {
    return await withCloudTimeout(run(), 45_000, "Envoi de la photo");
  } catch (e) {
    throwCloud(e, "Envoi de la photo impossible.");
  }
}

/** Delete a storage object referenced by photo_url (best-effort). */
export async function deleteProofPhoto(photoUrl: string | null | undefined): Promise<void> {
  const path = storagePathFromPhotoUrl(photoUrl);
  if (!path) return;
  const supabase = getSupabase();
  try {
    await withCloudTimeout(
      supabase.storage.from(PROOF_PHOTOS_BUCKET).remove([path]).then(({ error }) => {
        if (error) throw error;
      }),
      15_000,
      "Suppression de la photo"
    );
  } catch {
    /* best-effort — DB clear still proceeds */
  }
}

/** Turn a stored photo_url into a displayable URI (signed URL when needed). */
export async function resolvePhotoDisplayUrl(
  photoUrl: string | null | undefined
): Promise<string | undefined> {
  if (!photoUrl) return undefined;
  if (isLocalPhotoUri(photoUrl)) return photoUrl;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;

  const path = storagePathFromPhotoUrl(photoUrl);
  if (!path) return photoUrl;

  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.storage
      .from(PROOF_PHOTOS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  } catch {
    // Fallback public URL shape (won't work for private bucket without auth)
    return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${PROOF_PHOTOS_BUCKET}/${path}`;
  }
}

/** Resolve many photo_url values for UI (keeps local URIs). */
export async function resolvePhotoDisplayUrls(
  photoUrls: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(photoUrls.filter((u): u is string => !!u && !!u.trim()))];
  await Promise.all(
    unique.map(async (raw) => {
      const resolved = await resolvePhotoDisplayUrl(raw);
      if (resolved) out.set(raw, resolved);
    })
  );
  return out;
}
