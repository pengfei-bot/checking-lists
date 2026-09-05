# Checking Lists

Application famille (MVP) : enfants = taches du jour + photo preuve ; parents = multi-enfants + suivi.

UI francaise · Expo React Native (iOS, Android, **Web**) · local-first (AsyncStorage).

## English (short)

Family checklist MVP with auto demo seed (parent + 2 kids). Prefer browser demo first.

## Demarrer

```bash
cd checking-lists
npm install
npx expo start --web
```

URL typique: **http://localhost:8081**

Aussi: `npm run web`.

## Comment tester

### 1) Demo navigateur (recommande)

```bash
npx expo start --web
```

- OK: profils, checklist, CRUD taches, marquage fait, seed auto (Parent + Leo + Mia)
- OK: photo via **file picker** (sinon photo mock)
- Limite: notifications locales desactivees (banniere dans l app)
- Limite: pas de calendrier/camera natifs

### 2) Expo Go

`npx expo start` puis scanner le QR. Accepter permissions notifications / camera / calendrier.

### 3) Reset

Ecran d accueil → Reinitialiser les donnees de demo. Voir `TEST.md`.

## Fonctionnalites

Selecteur profil, home enfant, dashboard parent, form tache (titre/enfant/heure/recurrence/rappel), detail + photo, expo-notifications, expo-calendar one-way.

## Hors scope

Cloud sync, comptes famille reels, push production.

## Prochaines etapes

Auth + sync, push serveur, SQLite, gamification.
