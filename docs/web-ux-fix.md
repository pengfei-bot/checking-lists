# Web UX fix notes

- Photo: HTML file input + notifyUser (RN Web Alert is no-op)
- Demo reset: confirmUser + notifyUser after reset

## QA: prefer cloud (`?cloud=1`)

For Bob / GitHub Pages cloud QA without sticky demo:

`https://pengfei-bot.github.io/checking-lists/?cloud=1`

Also accepted in the hash (`#...?cloud=1` or `#cloud=1`).

On load (web bootstrap):

- Clears any stored demo session
- Does **not** auto-restore demo
- Welcome hides « Continuer en démo » / Continue as demo
- Lands ready for SignIn / SignUp / Join family

Without the flag, demo restore and the tertiary demo CTA remain available.

## Demo escape (UX Pxp)

While `isDemo`, a persistent top banner offers **Créer un compte / Se connecter** (FR+EN). CTA signs out of demo and returns to Welcome so the cloud path never disappears after entering demo. Welcome keeps « Continuer en démo » as a tertiary/ghost control.

## Offline mutation banner (demo vs cloud)

`CloudOfflineBanner` (app chrome in `RootNavigator`) + pending mutation queue are **cloud-only**:

- Visibility requires `cloudSync` (`familyId` present, not demo).
- Demo edits persist locally via `saveAppState` and **never** enqueue mutations — no pending banner is expected (and correct).
- Cloud sessions: offline mark/unmark/edit enqueue the mutation queue, set `pendingMutations`, and show the banner with pending count (+ retry) **above all screens** (including TaskForm / TaskDetail), not only ProfilePicker / dashboards.
- Web: `navigator.onLine` + `online`/`offline` events update the banner; `probeOnline` uses `cache: "no-store"`.

### Retest (Bob)

1. Open `https://pengfei-bot.github.io/checking-lists/?cloud=1` — Sign in (not demo).
2. Enter parent profile. Enable airplane mode / DevTools Offline.
3. Expect amber offline banner immediately (or after first edit).
4. Edit or mark a task → banner shows pending count (`N modification(s) en attente de sync`).
5. Go back online → banner switches to syncing / clears after flush; edit persists on server.

## Welcome « Entrer le code famille » (web)

Join CTA is a real `PrimaryButton` (`Pressable` + `accessibilityRole="button"` + web `cursor:pointer` / `pointerEvents="none"` on label) navigating to `RedeemInvite`. If it still no-ops in incognito, capture console errors — not a Text-only control.
