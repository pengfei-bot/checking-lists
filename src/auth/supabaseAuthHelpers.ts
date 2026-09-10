import * as Crypto from "expo-crypto";
import { DbFamily } from "../data/cloudSync";
import { secureDelete, secureGet, secureSet } from "./secureStorage";
import { Family, ParentAccount, Session } from "./types";

export const DEMO_SESSION_KEY = "@checking_lists/auth_demo_session/v1";
export const CHILD_CREDS_KEY = "@checking_lists/child_device_creds/v1";
export const SESSION_META_KEY = "@checking_lists/auth_session_meta/v1";

export interface SessionMeta {
  mode: Session["mode"];
  displayName?: string;
  linkedViaInvite?: boolean;
  familyId?: string;
  parentAccountId?: string;
  email?: string;
}

export interface ChildDeviceCreds {
  email: string;
  password: string;
}

export function mapFamily(row: DbFamily, childIds: string[] = []): Family {
  return {
    id: row.id,
    name: row.name,
    ownerParentId: row.created_by,
    inviteCode: row.invite_code,
    childProfileIds: childIds,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export function authErrorMessage(err: { message?: string } | null | undefined, fallback: string): string {
  const msg = (err?.message || "").toLowerCase();
  if (!err?.message) return fallback;
  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "E-mail non confirmé. Dans Supabase → Authentication → Providers → Email, désactivez « Confirm email » pour le MVP, ou confirmez le lien reçu.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "E-mail ou mot de passe incorrect.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "Un compte existe déjà avec cet e-mail.";
  }
  if (msg.includes("anonymous_provider_disabled") || msg.includes("anonymous sign-ins are disabled")) {
    return "Connexions anonymes désactivées. Activez « Anonymous sign-ins » dans Supabase Auth, ou l'app utilisera un compte enfant technique (e-mail généré).";
  }
  return err.message || fallback;
}

export async function randomToken(bytes = 16): Promise<string> {
  const buf = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveMeta(meta: SessionMeta | null): Promise<void> {
  if (!meta) {
    await secureDelete(SESSION_META_KEY);
    return;
  }
  await secureSet(SESSION_META_KEY, JSON.stringify(meta));
}

export async function readMeta(): Promise<SessionMeta | null> {
  try {
    const raw = await secureGet(SESSION_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

export async function buildParent(id: string, email: string, displayName: string, familyId: string): Promise<ParentAccount> {
  return { id, email, displayName, familyId, createdAt: new Date().toISOString() };
}

export async function clearDemo(): Promise<void> {
  await secureDelete(DEMO_SESSION_KEY);
}
