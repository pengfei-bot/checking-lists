import {
  AuthResult,
  Family,
  FamilyInvite,
  ParentAccount,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

/**
 * Pluggable auth backend.
 *
 * Current production path: SupabaseAuthBackend (cross-device family sharing).
 * LocalAuthBackend remains for offline / tests.
 *
 * Mapping:
 * - signUp / signIn / signOut → Supabase Auth (+ Sign in with Apple later)
 * - createInvite / redeemInvite → families.invite_code + RPC redeem_family_invite
 * - Session → JWT + refresh; Family → families / family_members
 */
export interface AuthBackend {
  /** Restore persisted session on app launch */
  bootstrap(): Promise<AuthResult | null>;

  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signOut(): Promise<void>;

  /** Parent-only: permanently delete account + family data (App Store 5.1.1v) */
  deleteAccount(): Promise<void>;

  /** Skip auth; use existing demo seed profiles (local only) */
  enterDemo(): Promise<AuthResult>;

  /** Generate / refresh 6-char family invite code for parent */
  createInvite(familyId: string): Promise<FamilyInvite>;

  /**
   * Child device enters invite code to join parent family (Supabase RPC).
   * @param displayName optional; defaults to « Appareil enfant » (UI no longer collects a name)
   */
  redeemInvite(code: string, displayName?: string): Promise<AuthResult>;

  getFamily(familyId: string): Promise<Family | null>;
  getParent(accountId: string): Promise<ParentAccount | null>;
  getSession(): Promise<Session | null>;
}
