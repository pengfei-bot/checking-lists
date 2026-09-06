# Checking Lists

MVP famille Expo (React Native + TypeScript) — local-first AsyncStorage + fondation auth / partage famille.

## English

Prefer: `npx expo start --web`

Auth is a **local prototype** (no paid backend). Demo mode skips accounts. Real cloud sync (Supabase/Firebase) comes later. App Store will require **Sign in with Apple** and parental-consent notes when accounts ship.

## Comment tester

1. Installer deps puis `npx expo start --web`
2. URL typique: http://localhost:8081
3. Accueil auth → **Continuer en démo** (ou créer un compte parent)
4. Choisir Parent (Demo) puis bouton Calendrier / Partage famille
5. Web OK: profils, checklist, CRUD, photo, seed, calendrier parent, auth locale, code invitation
6. Web limite: notifications, sync calendrier OS, camera, SecureStore (fallback AsyncStorage)
7. Expo Go: `npx expo start` + QR
8. Reset: écran profils. Voir `TEST.md`.

## Auth & partage famille (prototype)

### Démo vs compte

| Mode | Entrée | Données |
|------|--------|---------|
| **Démo** | « Continuer en démo » | Seed Parent + Léo / Mia / Noa / Sam, pas de compte |
| **Compte parent** | Créer un compte / Se connecter | E-mail + mot de passe hashé (SHA-256 + salt), famille locale |
| **Appareil enfant** | « Rejoindre une famille (code) » | Lie la session au `familyId` via code 6 caractères |

Stockage: `expo-secure-store` sur iOS/Android ; **AsyncStorage sur web = DEV ONLY**. Voir `src/auth/secureStorage.ts`.

Architecture: `src/auth/` — types `ParentAccount` / `Family` / `Session`, interface `AuthBackend`, impl `LocalAuthBackend`, `AuthProvider`. Commentaires pour remplacer par Supabase/Firebase.

### Flux invitation (local)

1. Parent crée un compte → code famille 6 caractères généré
2. Parent ouvre **Partage famille** (accueil profils ou dashboard) pour afficher / régénérer le code
3. Sur un « appareil enfant », entrer le code → session `child_device`
4. **Limite prototype:** le code n’existe que dans le stockage local de *cet* appareil (même navigateur en web). Sans cloud, pas de sync multi-appareils réel.

### App Store / conformité (notes courtes)

- **Sign in with Apple** obligatoire si d’autres logins sociaux / tiers sont proposés sur iOS — à brancher avant soumission
- Comptes enfants: consentement parental (COPPA / RGPD) — texte légal complet hors scope ; prévoir écran parent + âge
- Ne pas collecter d’e-mail enfant ; le modèle cible est « compte parent + profils enfants »

### Mot de passe oublié

Placeholder UI seulement — reset e-mail nécessite un backend auth.

## Demo Features Limits

- Seed: Parent, Léo, Mia, Noa, Sam + historique completions (~21 jours)
- Parent: **Ajouter un enfant** (AsyncStorage) → picker / filtres / calendrier
- Features: profils, enfant, parent, form, photo, notifs, calendrier parent mensuel, auth locale, invite code
- Out: cloud sync multi-appareils, Sign in with Apple, Firebase/Supabase réels, push distant
- Next: AuthBackend cloud, sync checklists, SQLite optionnel

## Structure auth

```
src/auth/
  types.ts           ParentAccount, Family, Session…
  AuthBackend.ts     interface (signUp, signIn, signOut, createInvite, redeemInvite)
  LocalAuthBackend.ts
  AuthProvider.tsx
  secureStorage.ts   SecureStore / AsyncStorage
  password.ts        hash SHA-256 (prototype)
  inviteCode.ts
```
