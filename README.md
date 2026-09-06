# Checking Lists

MVP famille Expo Web (local-first AsyncStorage).

## English

Prefer: npx expo start --web

## Comment tester
1. installer deps puis expo start --web
2. URL typique: http://localhost:8081
3. Choisir Parent (Demo) puis bouton Calendrier
4. Web OK: profils, checklist, CRUD, photo, seed, calendrier parent
5. Web limite: notifications, sync calendrier OS, camera
6. Expo Go: npx expo start + QR
7. Reset: ecran daccueil. Voir TEST.md.

## Demo Features Limits

- Seed: Parent, Leo, Mia + historique completions (~21 jours)
- Features: profils, enfant, parent, form, photo, notifs, calendrier parent mensuel
- Out: cloud sync, comptes reels, push, auth
- Next: auth, sync, SQLite
