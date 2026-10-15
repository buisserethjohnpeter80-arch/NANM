# NANM v1

Re-création de Lavi Ansanm en **Ionic Core + HTML / CSS / JS vanilla** (aucun framework JS, aucune étape de build pour l'aperçu).
Nouveau nom : **NANM**. Mêmes fonctionnalités que Lavi Ansanm, même backend.

## Lancer (aperçu navigateur)

Option 1 — ouvrir directement :

```bash
open index.html
```

Option 2 — petit serveur local (recommandé, évite certains blocages `file://`) :

```bash
npx serve .
# puis ouvrir l'URL affichée (ex. http://localhost:3000)
```

Aucune clé, aucun token, aucun mot de passe dans le code. Seule constante publique : l'URL de base de l'API.

## Backend (réutilisé, non modifié)

- Base URL : `https://lavi-ansanm-api.buisserethjohnpeter80.workers.dev`
- Auth : JWT (30 j) stocké dans `localStorage` (`nanm_token`), header `Authorization: Bearer <token>`.
- Endpoints utilisés : `POST /api/signup`, `POST /api/login`, `GET/PUT /api/me`, `POST /api/me/photo`, `GET /api/feed`, `POST /api/posts`, `POST /api/posts/:id/like`, `GET/POST/DELETE /api/events`, `GET /api/users?q=`, `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages`, `GET /photos/:id`, `GET /api/health`.
- Les messages d'erreur du backend (en français) sont affichés tels quels.
- Les URLs de photos relatives (`/photos/...`) sont résolues en absolu avec la base URL.

## Fonctionnalités (v1)

1. **Auth** : Welcome → Signup (nom, e-mail, mot de passe, photo optionnelle) → Login → Profil setup / bio. Déconnexion.
2. **Accueil / Feed** : compositeur (texte + photo optionnelle), posts (auteur, il y a…, texte, photo), like toggle ❤️/🤍 avec compteur. Compteurs commentaires/partages affichés à 0 (le backend ne les fournit pas).
3. **Événements** : À venir / Passés, créer (titre, date, heure, lieu, description), supprimer ses propres événements.
4. **Messages** : liste des conversations (dernier message, badge non lus), nouveau chat via recherche de membres, fil de discussion (envoyer/recevoir, polling 5 s, non lus effacés à la lecture).
5. **Profil** : avatar (photo ou initiales), nom, handle, bio, stats, mes publications, grille de mes photos publiées, changer la photo, modifier la bio.

## Structure

```
index.html            # Shell Ionic : ion-app, ion-tabs (4 onglets), vues auth + fil de discussion
styles.css            # Thème NANM (cream / vert profond / or / terracotta), ≤ 520 px centré
app.js                # Toute la logique (auth, feed, events, messages, profil, polling 5 s)
capacitor.config.json # Config minimale pour un build natif plus tard
.gitignore
```

## Build natif (plus tard, non fait ici)

Aucun APK n'est construit dans v1. Pour un build natif plus tard :

```bash
npm install @capacitor/core @capacitor/cli
npx cap init NANM com.nanm.app --web-dir=.
npx cap add android
npx cap add ios
npx cap sync
# puis ouvrir dans Android Studio / Xcode
```

## Ce qui reste à tester en live

Avec le navigateur + backend live : inscription, connexion, publication (texte + photo), like toggle, création/suppression d'événement, recherche de membre, envoi/réception de message (polling 5 s), changement de photo de profil, modification de bio, déconnexion. Vérifier aussi sur petit écran mobile.
