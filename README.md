# Checking Lists

MVP famille Expo (React Native + TypeScript) — **Supabase** pour le partage multi-appareils (parent to child), demo locale AsyncStorage.

**Projet Supabase :** Checking lists (lgiqyybjnjfjxixzennr)
URL : https://lgiqyybjnjfjxixzennr.supabase.co

## English

Prefer: npx expo start --web

- Demo mode — local seed only (no account, no cloud).
- Parent account — email/password via Supabase Auth; creates a families row + share code.
- Child device — join with code via redeem_family_invite RPC; syncs profiles/tasks/completions.

App Store will still need Sign in with Apple and parental-consent notes before submission.

## Comment tester

1. Installer les deps puis demarrer Expo web
2. URL typique: http://localhost:8081
3. Accueil: compte parent (cloud) ou Continuer en demo (local)
4. Parent: ecran Partage famille, afficher le code
5. Autre appareil: Rejoindre une famille, saisir le code (reseau requis)
6. Reset demo: ecran profils. Voir TEST.md.

## Auth and family sharing (Supabase)

### Demo vs account

| Mode | Entry | Data |
|------|-------|------|
| Demo | Continuer en demo | Local seed, AsyncStorage only |
| Parent account | Create / Sign in | Supabase Auth + cloud family + share code |
| Child device | Join family (code) | Anonymous auth (or synthetic email) + redeem_family_invite RPC |

Architecture: src/auth/ — AuthBackend, SupabaseAuthBackend (default), LocalAuthBackend, AuthProvider. Sync: src/data/cloudSync.ts.

### Cross-device join flow (parent phone to child iPhone)

1. Parent signs up → families row + invite_code (6 chars) + family_members (parent role)
2. Parent opens Partage famille to show / refresh the code (stored in Supabase)
3. On the child iPhone: Welcome → Rejoindre → enter code (+ optional nickname)
4. Child device auth: signInAnonymously, or fallback child+{random}@checkinglists.app if Anonymous is off
5. RPC redeem_family_invite(p_code, p_display_name) → family_id
6. Load cloud: child_profiles, tasks, task_completions (RLS)

### Supabase Auth settings the user must enable

Dashboard project Checking lists → Authentication:

1. Anonymous sign-ins — Enable (recommended for child devices)
2. Email → Confirm email — Disable for MVP (otherwise no session right after signUp)
3. Keep Email/password enabled for parents

Without (1): app uses synthetic child+…@checkinglists.app (random password in SecureStore).
Without (2): parent must confirm email before the family row can be created.

### App Store notes

- Sign in with Apple before submission if other third-party logins ship
- Parental consent (COPPA / GDPR) for child accounts
- Do not collect child email

### Forgot password

Placeholder UI. Wire Supabase Auth email reset later.

## Limits

- Local seed only in demo mode
- Cloud syncs child profiles / tasks / completions across family devices
- Missing DB column once_date (once recurrence syncs without date)
- Next: Apple Sign In, realtime, Storage photos

## Structure

src/auth/ types, AuthBackend, SupabaseAuthBackend, LocalAuthBackend, AuthProvider
src/lib/supabase.ts
src/data/cloudSync.ts
src/data/storage.ts

Env: see .env.example. Defaults in src/lib/supabase.ts.
