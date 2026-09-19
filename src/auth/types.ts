/**
 * Auth domain types — pluggable LocalAuthBackend / SupabaseAuthBackend.
 */

export type AuthMode = "anonymous" | "demo" | "authenticated" | "child_device" | "pending_join";

export type JoinRequestStatus = "pending" | "approved" | "refused" | "none";

export interface ParentAccount {
  id: string;
  email: string;
  /** Local prototype only — omitted for Supabase Auth accounts */
  passwordHash?: string;
  salt?: string;
  displayName: string;
  familyId: string;
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  ownerParentId: string;
  /** Active 6-char invite code shared across devices via Supabase */
  inviteCode: string;
  childProfileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FamilyInvite {
  code: string;
  familyId: string;
  createdAt: string;
  /** Soft expiry for future; cloud may ignore */
  expiresAt?: string;
}

export interface FamilyJoinRequest {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  status: JoinRequestStatus;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface JoinRedeemResult {
  status: JoinRequestStatus;
  familyId?: string | null;
  familyName?: string | null;
  requestId?: string | null;
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
  /** Pending parent approval after redeeming an invite */
  pendingRequestId?: string;
  pendingFamilyName?: string;
  joinStatus?: JoinRequestStatus;
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
