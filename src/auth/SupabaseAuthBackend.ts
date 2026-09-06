import { DbFamily } from "../data/cloudSync";
import { getSupabase } from "../lib/supabase";
import { AuthBackend } from "./AuthBackend";
import { generateInviteCode, normalizeInviteCode } from "./inviteCode";
import { secureDelete, secureGet, secureSet } from "./secureStorage";
import {
  authErrorMessage, buildParent, CHILD_CREDS_KEY, clearDemo, DEMO_SESSION_KEY,
  mapFamily, randomToken, readMeta, saveMeta, ChildDeviceCreds,
} from "./supabaseAuthHelpers";
import { AuthResult, Family, FamilyInvite, ParentAccount, Session, SignInInput, SignUpInput } from "./types";

export class SupabaseAuthBackend implements AuthBackend {
  async bootstrap(): Promise<AuthResult | null> {
    const demoRaw = await secureGet(DEMO_SESSION_KEY);
    if (demoRaw) {
      try {
        const session = JSON.parse(demoRaw) as Session;
        if (session?.isDemo) return { session, parent: null, family: null };
      } catch { /* ignore */ }
    }
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const meta = await readMeta();
    const familyId = meta?.familyId;
    if (!familyId) {
      const { data: membership } = await supabase.from("family_members").select("family_id, role, display_name").eq("user_id", user.id).limit(1).maybeSingle();
      if (!membership?.family_id) return null;
      const family = await this.getFamily(membership.family_id);
      if (!family) return null;
      const isParent = membership.role === "parent";
      const session: Session = {
        mode: isParent ? "authenticated" : "child_device",
        parentAccountId: isParent ? user.id : undefined,
        familyId: family.id,
        email: user.email ?? undefined,
        displayName: membership.display_name || (user.user_metadata?.display_name as string | undefined) || family.name,
        isDemo: false,
        linkedViaInvite: !isParent,
        startedAt: new Date().toISOString(),
      };
      await saveMeta({ mode: session.mode, displayName: session.displayName, linkedViaInvite: session.linkedViaInvite, familyId: session.familyId, parentAccountId: session.parentAccountId, email: session.email });
      const parent = isParent ? await buildParent(user.id, user.email ?? "", session.displayName || "Parent", family.id) : null;
      return { session, parent, family };
    }
    const family = await this.getFamily(familyId);
    if (!family) return null;
    const session: Session = {
      mode: meta?.mode ?? "authenticated",
      parentAccountId: meta?.parentAccountId,
      familyId,
      email: meta?.email ?? user.email ?? undefined,
      displayName: meta?.displayName,
      isDemo: false,
      linkedViaInvite: meta?.linkedViaInvite,
      startedAt: new Date().toISOString(),
    };
    const parent = session.mode === "authenticated" && session.parentAccountId
      ? await buildParent(session.parentAccountId, session.email ?? "", session.displayName || "Parent", familyId)
      : null;
    return { session, parent, family };
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    await clearDemo();
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Adresse e-mail invalide.");
    if (!input.password || input.password.length < 6) throw new Error("Mot de passe : 6 caractères minimum.");
    const displayName = input.displayName.trim() || "Parent";
    const familyName = input.familyName?.trim() || `Famille ${displayName}`;
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password: input.password, options: { data: { display_name: displayName, role: "parent" } } });
    if (error) throw new Error(authErrorMessage(error, "Inscription impossible."));
    if (!data.session || !data.user) {
      throw new Error("Compte créé mais session absente (confirmation e-mail active). Dans Supabase → Authentication → Providers → Email, désactivez « Confirm email » pour le MVP famille, puis reconnectez-vous.");
    }
    const user = data.user;
    const inviteCode = await generateInviteCode(6);
    const { data: familyRow, error: famErr } = await supabase.from("families").insert({ name: familyName, invite_code: inviteCode, created_by: user.id }).select("*").single();
    if (famErr) throw new Error(famErr.message);
    const familyId = (familyRow as DbFamily).id;
    const { error: memErr } = await supabase.from("family_members").insert({ family_id: familyId, user_id: user.id, role: "parent", display_name: displayName });
    if (memErr) throw new Error(memErr.message);
    const family = mapFamily(familyRow as DbFamily, []);
    const parent = await buildParent(user.id, email, displayName, familyId);
    const session: Session = { mode: "authenticated", parentAccountId: user.id, familyId, email, displayName, isDemo: false, startedAt: new Date().toISOString() };
    await saveMeta({ mode: "authenticated", displayName, familyId, parentAccountId: user.id, email });
    return { session, parent, family };
  }

  async signIn(input: SignInInput): Promise<AuthResult> {
    await clearDemo();
    const email = input.email.trim().toLowerCase();
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error) throw new Error(authErrorMessage(error, "Connexion impossible."));
    const user = data.user;
    if (!user) throw new Error("Connexion impossible.");
    const { data: membership, error: memErr } = await supabase.from("family_members").select("family_id, role, display_name").eq("user_id", user.id).eq("role", "parent").limit(1).maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!membership?.family_id) throw new Error("Aucune famille associée à ce compte parent.");
    const family = await this.getFamily(membership.family_id);
    if (!family) throw new Error("Famille introuvable.");
    const displayName = membership.display_name || (user.user_metadata?.display_name as string | undefined) || "Parent";
    const session: Session = { mode: "authenticated", parentAccountId: user.id, familyId: family.id, email: user.email ?? email, displayName, isDemo: false, startedAt: new Date().toISOString() };
    await saveMeta({ mode: "authenticated", displayName, familyId: family.id, parentAccountId: user.id, email: session.email });
    const parent = await buildParent(user.id, session.email ?? email, displayName, family.id);
    return { session, parent, family };
  }

  async signOut(): Promise<void> {
    await clearDemo();
    await saveMeta(null);
    await secureDelete(CHILD_CREDS_KEY);
    await getSupabase().auth.signOut();
  }

  async enterDemo(): Promise<AuthResult> {
    try { await getSupabase().auth.signOut(); } catch { /* ignore */ }
    await saveMeta(null);
    const session: Session = { mode: "demo", isDemo: true, displayName: "Démo", startedAt: new Date().toISOString() };
    await secureSet(DEMO_SESSION_KEY, JSON.stringify(session));
    return { session, parent: null, family: null };
  }

  async createInvite(familyId: string): Promise<FamilyInvite> {
    const code = await generateInviteCode(6);
    const { error } = await getSupabase().from("families").update({ invite_code: code }).eq("id", familyId);
    if (error) throw new Error(error.message);
    return { code, familyId, createdAt: new Date().toISOString() };
  }

  async redeemInvite(code: string, displayName?: string): Promise<AuthResult> {
    await clearDemo();
    const normalized = normalizeInviteCode(code);
    if (normalized.length < 4) throw new Error("Code d'invitation invalide.");
    const nickname = (displayName?.trim() || "Appareil enfant").slice(0, 40);
    await this.ensureChildAuthSession(nickname);
    const supabase = getSupabase();
    const { data: familyId, error: rpcErr } = await supabase.rpc("redeem_family_invite", { p_code: normalized, p_display_name: nickname });
    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (msg.toLowerCase().includes("not authenticated")) throw new Error("Session enfant manquante. Réessayez avec le réseau actif.");
      throw new Error(msg.includes("invalid") || msg.includes("not found") || msg.includes("inconnu") ? "Code d'invitation inconnu ou expiré." : msg || "Impossible de rejoindre la famille.");
    }
    if (!familyId || typeof familyId !== "string") throw new Error("Code d'invitation inconnu ou expiré.");
    const family = await this.getFamily(familyId);
    if (!family) throw new Error("Famille liée au code introuvable.");
    const session: Session = { mode: "child_device", familyId: family.id, displayName: family.name, isDemo: false, linkedViaInvite: true, startedAt: new Date().toISOString() };
    await saveMeta({ mode: "child_device", displayName: family.name, linkedViaInvite: true, familyId: family.id });
    return { session, parent: null, family };
  }

  private async ensureChildAuthSession(nickname: string): Promise<void> {
    const supabase = getSupabase();
    const existing = await supabase.auth.getSession();
    if (existing.data.session?.user) return;
    const anon = await supabase.auth.signInAnonymously();
    if (!anon.error && anon.data.session) {
      try { await supabase.auth.updateUser({ data: { display_name: nickname, role: "child_device" } }); } catch { /* optional */ }
      return;
    }
    const rawCreds = await secureGet(CHILD_CREDS_KEY);
    if (rawCreds) {
      try {
        const creds = JSON.parse(rawCreds) as ChildDeviceCreds;
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (!error) return;
      } catch { /* create new */ }
    }
    const token = await randomToken(8);
    const email = `child+${token}@checkinglists.app`;
    const password = await randomToken(24);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: nickname, role: "child_device", synthetic: true } } });
    if (error) throw new Error(authErrorMessage(error, "Impossible de créer la session enfant. Activez Anonymous sign-ins dans Supabase Auth."));
    if (!data.session) {
      const signed = await supabase.auth.signInWithPassword({ email, password });
      if (signed.error || !signed.data.session) {
        throw new Error("Session enfant sans confirmation e-mail. Activez « Anonymous sign-ins » ou désactivez « Confirm email » dans Supabase Authentication.");
      }
    }
    await secureSet(CHILD_CREDS_KEY, JSON.stringify({ email, password } satisfies ChildDeviceCreds));
  }

  async getFamily(familyId: string): Promise<Family | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("families").select("*").eq("id", familyId).maybeSingle();
    if (error || !data) return null;
    const kids = await supabase.from("child_profiles").select("id").eq("family_id", familyId);
    const ids = (kids.data ?? []).map((r: { id: string }) => r.id);
    return mapFamily(data as DbFamily, ids);
  }

  async getParent(accountId: string): Promise<ParentAccount | null> {
    const meta = await readMeta();
    if (!meta?.familyId || meta.parentAccountId !== accountId) return null;
    return buildParent(accountId, meta.email ?? "", meta.displayName || "Parent", meta.familyId);
  }

  async getSession(): Promise<Session | null> {
    const demoRaw = await secureGet(DEMO_SESSION_KEY);
    if (demoRaw) {
      try { return JSON.parse(demoRaw) as Session; } catch { /* fall through */ }
    }
    const restored = await this.bootstrap();
    return restored?.session ?? null;
  }
}
