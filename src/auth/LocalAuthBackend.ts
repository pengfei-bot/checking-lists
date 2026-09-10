import { uid } from "../utils/dates";
import { AuthBackend } from "./AuthBackend";
import { generateInviteCode, normalizeInviteCode } from "./inviteCode";
import { createSalt, hashPassword, verifyPassword } from "./password";
import { secureDelete, secureGet, secureSet } from "./secureStorage";
import {
  AuthResult,
  Family,
  FamilyInvite,
  ParentAccount,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

const STORE_KEY = "@checking_lists/auth_local/v1";

interface LocalAuthStore {
  parents: ParentAccount[];
  families: Family[];
  invites: FamilyInvite[];
  session: Session | null;
}

function emptyStore(): LocalAuthStore {
  return { parents: [], families: [], invites: [], session: null };
}

async function readStore(): Promise<LocalAuthStore> {
  try {
    const raw = await secureGet(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as LocalAuthStore;
    return {
      parents: parsed.parents ?? [],
      families: parsed.families ?? [],
      invites: parsed.invites ?? [],
      session: parsed.session ?? null,
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: LocalAuthStore): Promise<void> {
  await secureSet(STORE_KEY, JSON.stringify(store));
}

function toResult(
  session: Session,
  store: LocalAuthStore
): AuthResult {
  const parent = session.parentAccountId
    ? store.parents.find((p) => p.id === session.parentAccountId) ?? null
    : null;
  const family = session.familyId
    ? store.families.find((f) => f.id === session.familyId) ?? null
    : null;
  return { session, parent, family };
}

/**
 * Device-local auth + family invite prototype.
 * NOT multi-device cloud sync — see README auth section.
 */
export class LocalAuthBackend implements AuthBackend {
  async bootstrap(): Promise<AuthResult | null> {
    const store = await readStore();
    if (!store.session) return null;
    return toResult(store.session, store);
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Adresse e-mail invalide.");
    }
    if (!input.password || input.password.length < 6) {
      throw new Error("Mot de passe : 6 caractères minimum.");
    }
    const displayName = input.displayName.trim() || "Parent";
    const store = await readStore();
    if (store.parents.some((p) => p.email === email)) {
      throw new Error("Un compte existe déjà avec cet e-mail.");
    }

    const salt = await createSalt();
    const passwordHash = await hashPassword(input.password, salt);
    const now = new Date().toISOString();
    const familyId = uid("fam");
    const parentId = uid("parent");
    const inviteCode = await generateInviteCode(6);

    const parent: ParentAccount = {
      id: parentId,
      email,
      passwordHash,
      salt,
      displayName,
      familyId,
      createdAt: now,
    };

    const family: Family = {
      id: familyId,
      name: input.familyName?.trim() || `Famille ${displayName}`,
      ownerParentId: parentId,
      inviteCode,
      childProfileIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const invite: FamilyInvite = {
      code: inviteCode,
      familyId,
      createdAt: now,
    };

    const session: Session = {
      mode: "authenticated",
      parentAccountId: parentId,
      familyId,
      email,
      displayName,
      isDemo: false,
      startedAt: now,
    };

    store.parents.push(parent);
    store.families.push(family);
    store.invites = store.invites.filter((i) => i.familyId !== familyId);
    store.invites.push(invite);
    store.session = session;
    await writeStore(store);
    return { session, parent, family };
  }

  async signIn(input: SignInInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const store = await readStore();
    const parent = store.parents.find((p) => p.email === email);
    if (!parent) {
      throw new Error("E-mail ou mot de passe incorrect.");
    }
    if (!parent.salt || !parent.passwordHash) {
      throw new Error("E-mail ou mot de passe incorrect.");
    }
    const ok = await verifyPassword(input.password, parent.salt, parent.passwordHash);
    if (!ok) {
      throw new Error("E-mail ou mot de passe incorrect.");
    }
    const now = new Date().toISOString();
    const session: Session = {
      mode: "authenticated",
      parentAccountId: parent.id,
      familyId: parent.familyId,
      email: parent.email,
      displayName: parent.displayName,
      isDemo: false,
      startedAt: now,
    };
    store.session = session;
    await writeStore(store);
    return toResult(session, store);
  }

  async signOut(): Promise<void> {
    const store = await readStore();
    store.session = null;
    await writeStore(store);
  }

  async deleteAccount(): Promise<void> {
    await writeStore(emptyStore());
  }

  async enterDemo(): Promise<AuthResult> {
    const store = await readStore();
    const session: Session = {
      mode: "demo",
      isDemo: true,
      displayName: "Démo",
      startedAt: new Date().toISOString(),
    };
    store.session = session;
    await writeStore(store);
    return { session, parent: null, family: null };
  }

  async createInvite(familyId: string): Promise<FamilyInvite> {
    const store = await readStore();
    const family = store.families.find((f) => f.id === familyId);
    if (!family) throw new Error("Famille introuvable.");

    const code = await generateInviteCode(6);
    const now = new Date().toISOString();
    family.inviteCode = code;
    family.updatedAt = now;

    const invite: FamilyInvite = { code, familyId, createdAt: now };
    store.invites = store.invites.filter((i) => i.familyId !== familyId);
    store.invites.push(invite);
    await writeStore(store);
    return invite;
  }

  async redeemInvite(code: string, _displayName?: string): Promise<AuthResult> {
    const normalized = normalizeInviteCode(code);
    if (normalized.length < 4) {
      throw new Error("Code d'invitation invalide.");
    }
    const store = await readStore();
    const invite = store.invites.find((i) => i.code === normalized);
    const familyByCode = store.families.find((f) => f.inviteCode === normalized);
    const familyId = invite?.familyId ?? familyByCode?.id;

    if (!familyId) {
      throw new Error(
        "Code inconnu. Utilisez le backend Supabase pour rejoindre une famille depuis un autre appareil."
      );
    }

    const family = store.families.find((f) => f.id === familyId);
    if (!family) {
      throw new Error("Famille liée au code introuvable.");
    }

    const now = new Date().toISOString();
    const session: Session = {
      mode: "child_device",
      familyId: family.id,
      displayName: family.name,
      isDemo: false,
      linkedViaInvite: true,
      startedAt: now,
    };
    store.session = session;
    await writeStore(store);
    return { session, parent: null, family };
  }

  async getFamily(familyId: string): Promise<Family | null> {
    const store = await readStore();
    return store.families.find((f) => f.id === familyId) ?? null;
  }

  async getParent(accountId: string): Promise<ParentAccount | null> {
    const store = await readStore();
    return store.parents.find((p) => p.id === accountId) ?? null;
  }

  async getSession(): Promise<Session | null> {
    const store = await readStore();
    return store.session;
  }
}

/** Wipe local auth store (tests / reset). Does not touch checklist seed. */
export async function clearLocalAuthStore(): Promise<void> {
  await secureDelete(STORE_KEY);
}
