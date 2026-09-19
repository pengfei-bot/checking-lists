import {
  AuthResult,
  Family,
  FamilyInvite,
  FamilyJoinRequest,
  JoinRedeemResult,
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
 * - Join approval → family_join_requests + approve/refuse RPCs
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
   * Child device enters invite code. Cloud path creates a *pending* join request
   * until a parent approves (no full family data until then).
   * @param displayName optional; defaults to « Appareil enfant »
   */
  redeemInvite(code: string, displayName?: string): Promise<AuthResult>;

  /** Child: poll join request status; may promote session to child_device when approved */
  refreshJoinRequest(): Promise<AuthResult | null>;

  /** Parent: list pending join requests for the active family */
  listJoinRequests(familyId: string): Promise<FamilyJoinRequest[]>;

  /** Parent: approve a pending join request (links child_device membership) */
  approveJoinRequest(requestId: string): Promise<JoinRedeemResult>;

  /** Parent: refuse a pending join request */
  refuseJoinRequest(requestId: string): Promise<JoinRedeemResult>;

  getFamily(familyId: string): Promise<Family | null>;
  getParent(accountId: string): Promise<ParentAccount | null>;
  getSession(): Promise<Session | null>;
}
