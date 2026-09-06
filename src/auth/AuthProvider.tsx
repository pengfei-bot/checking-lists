import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthBackend } from "./AuthBackend";
import { SupabaseAuthBackend } from "./SupabaseAuthBackend";
import { isUsingSecureStore } from "./secureStorage";
import {
  Family,
  FamilyInvite,
  ParentAccount,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  family: Family | null;
  parent: ParentAccount | null;
  isDemo: boolean;
  isAuthenticated: boolean;
  /** Invite-redeemed child device — child UI only, no parent admin */
  isChildDevice: boolean;
  /** True when session is cloud-backed (parent or child device), not demo */
  isCloud: boolean;
  usingSecureStore: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsDemo: () => Promise<void>;
  createInvite: () => Promise<FamilyInvite>;
  redeemInvite: (code: string, displayName?: string) => Promise<void>;
  refreshFamily: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Cloud backend — swap for LocalAuthBackend in unit tests if needed. */
const backend: AuthBackend = new SupabaseAuthBackend();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [parent, setParent] = useState<ParentAccount | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const restored = await backend.bootstrap();
        if (restored) {
          setSession(restored.session);
          setFamily(restored.family);
          setParent(restored.parent);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const apply = useCallback(
    (result: { session: Session; family: Family | null; parent: ParentAccount | null }) => {
      setSession(result.session);
      setFamily(result.family);
      setParent(result.parent);
    },
    []
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      apply(await backend.signUp(input));
    },
    [apply]
  );

  const signIn = useCallback(
    async (input: SignInInput) => {
      apply(await backend.signIn(input));
    },
    [apply]
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    setSession(null);
    setFamily(null);
    setParent(null);
  }, []);

  const continueAsDemo = useCallback(async () => {
    apply(await backend.enterDemo());
  }, [apply]);

  const createInvite = useCallback(async () => {
    if (!session?.familyId) {
      throw new Error("Aucune famille active. Connectez-vous en tant que parent.");
    }
    const invite = await backend.createInvite(session.familyId);
    const nextFamily = await backend.getFamily(session.familyId);
    setFamily(nextFamily);
    return invite;
  }, [session?.familyId]);

  const redeemInvite = useCallback(
    async (code: string, displayName?: string) => {
      apply(await backend.redeemInvite(code, displayName));
    },
    [apply]
  );

  const refreshFamily = useCallback(async () => {
    if (!session?.familyId) return;
    setFamily(await backend.getFamily(session.familyId));
  }, [session?.familyId]);

  const isCloud = !!session && !session.isDemo && !!session.familyId;
  const isChildDevice =
    session?.mode === "child_device" || (!!session?.linkedViaInvite && !session.isDemo);

  const value: AuthContextValue = useMemo(
    () => ({
      ready,
      session,
      family,
      parent,
      isDemo: !!session?.isDemo,
      isAuthenticated: session?.mode === "authenticated",
      isChildDevice,
      isCloud,
      usingSecureStore: isUsingSecureStore(),
      signUp,
      signIn,
      signOut,
      continueAsDemo,
      createInvite,
      redeemInvite,
      refreshFamily,
    }),
    [
      ready,
      session,
      family,
      parent,
      isChildDevice,
      isCloud,
      signUp,
      signIn,
      signOut,
      continueAsDemo,
      createInvite,
      redeemInvite,
      refreshFamily,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
