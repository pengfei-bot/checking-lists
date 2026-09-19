# Native builds (EAS) — Famlist

FR / EN — Expo EAS Build for **Famlist** native iPhone and Android apps.

Repo GitHub: `pengfei-bot/checking-lists`. Pages slug unchanged: `EXPO_BASE_URL=/checking-lists`.

**Display name:** Famlist
**Native IDs:** `com.pengfeibot.famlist`

**Auth:** Supabase email/anonymous. Sign in with Apple may be required later if social logins are added.

---

## Steps
See package.json scripts build:android:preview and friends.
Connect Expo account first then run build:configure.
Set Apple and Play signing in EAS UI.
Store IDs: com.pengfeibot.famlist
Profiles: development, preview (APK+internal), production (AAB+store).
Web: export:web keeps EXPO_BASE_URL=/checking-lists.
Interactive Expo steps cannot run headless; configs ready.
