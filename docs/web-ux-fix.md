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

`OfflineBanner` + pending mutation queue are **cloud-only**:

- Visibility requires `cloudSync` (`familyId` present, not demo).
- Demo edits persist locally via `saveAppState` and **never** enqueue mutations — no pending banner is expected (and correct).
- Cloud sessions: offline mark/unmark/edit enqueue the mutation queue, set `pendingMutations`, and show the banner with pending count (+ retry) on ProfilePicker, ParentDashboard, and ChildHome.

If Bob sees no banner while signed into a real family offline, that would be a bug; in demo it is intentional.
