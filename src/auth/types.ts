/**
 * Auth domain types — local prototype foundation.
 * Swap LocalAuthBackend for Supabase/Firebase without changing UI contracts.
 */

export type AuthMode = "anonymous" | "demo" | "authenticated" | "child_device";

export interface ParentAccount {
  id: string;
  email: string;
  /** SHA-256(salt + password) — prototype only; server-side hashing later */
  passwordHash: string;
  salt: string;
  displayName: string;
  familyId: string;
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  ownerParentId: string;
  /** Active 6-char invite code (prototype sharing model) */
  inviteCode: string;
  childProfileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FamilyInvite {
  code: string;
  familyId: string;
  createdAt: string;
  /** Soft expiry for future cloud; local backend ignores */
  expiresAt?: string;
}

export interface Session {
  mode: AuthMode;
  parentAccountId?: string;
  familyId?: string;
  email?: string;
  displayName?: string;
  /** True when entered via « Continuer en démo » */
  isDemo: boolean;
  /** Child device linked via invite (no parent password on device) */
  linkedViaInvite?: boolean;
  startedAt: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  familyName?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthResult {
  session: Session;
  family: Family | null;
  parent: ParentAccount | null;
}
