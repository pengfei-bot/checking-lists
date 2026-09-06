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
 * Current: LocalAuthBackend (device-local prototype).
 * Later: implement SupabaseAuthBackend or FirebaseAuthBackend with the same
 * methods — AuthProvider only depends on this interface.
 *
 * Suggested cloud mapping:
 * - signUp / signIn / signOut → Supabase Auth / Firebase Auth (+ Sign in with Apple)
 * - createInvite / redeemInvite → RPC + `family_invites` table + RLS
 * - Session → JWT + refresh; Family → `families` / `family_members`
 */
export interface AuthBackend {
  /** Restore persisted session on app launch */
  bootstrap(): Promise<AuthResult | null>;

  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signOut(): Promise<void>;

  /** Skip auth; use existing demo seed profiles */
  enterDemo(): Promise<AuthResult>;

  /** Generate / refresh 6-char family invite code for parent */
  createInvite(familyId: string): Promise<FamilyInvite>;

  /**
   * Child device enters invite code to attach to parent family locally.
   * Prototype: looks up families stored on this device only.
   */
  redeemInvite(code: string): Promise<AuthResult>;

  getFamily(familyId: string): Promise<Family | null>;
  getParent(accountId: string): Promise<ParentAccount | null>;
  getSession(): Promise<Session | null>;
}
