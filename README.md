# Fluent by

App d'apprentissage de langue orientée objectifs — Next.js 14 (App Router) + **Firebase** (Auth + Firestore) + Groq.

## 1. Installer les dépendances

```bash
npm install
```

## 2. Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) et crée un projet (gratuit, plan Spark).
2. **Authentication > Sign-in method** : active le provider **Email/Password**.
3. **Firestore Database > Créer une base de données** : démarre en mode production (les règles sont fournies dans `firestore.rules`).
4. **Project Settings > General > Vos applications** : ajoute une application Web, récupère la config (`apiKey`, `authDomain`, etc.).
5. **Project Settings > Comptes de service > Générer une nouvelle clé privée** : télécharge le fichier JSON (nécessaire pour l'Admin SDK côté serveur).

## 3. Configurer Groq

Crée une clé sur [console.groq.com/keys](https://console.groq.com/keys).

## 4. Variables d'environnement

Copie `.env.local.example` vers `.env.local` :

```bash
cp .env.local.example .env.local
```

Remplis :
- Les 6 variables `NEXT_PUBLIC_FIREBASE_*` avec la config web récupérée à l'étape 2.4
- Les 3 variables `FIREBASE_ADMIN_*` avec le contenu du fichier JSON téléchargé à l'étape 2.5
  (`project_id` → `FIREBASE_ADMIN_PROJECT_ID`, `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`, en gardant les `\n` littéraux dans la chaîne)
- `GROQ_API_KEY`

⚠️ Les variables `FIREBASE_ADMIN_*` sont des secrets serveur : ne jamais les préfixer par `NEXT_PUBLIC_`.

## 5. Déployer les règles de sécurité Firestore

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # sélectionne ton projet Firebase
firebase deploy --only firestore:rules
```

Sans cette étape, Firestore refusera toutes les lectures/écritures (comportement par défaut du mode production).

## 6. Lancer en local

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) — tu seras redirigé vers `/login`.

## 7. Déployer sur Vercel

1. Pousse le projet sur un repo GitHub.
2. Importe le repo sur [vercel.com/new](https://vercel.com/new).
3. Renseigne toutes les variables d'environnement dans Settings > Environment Variables
   (attention à bien coller `FIREBASE_ADMIN_PRIVATE_KEY` avec ses `\n`).
4. Déploie.
5. **Authentication > Settings > Authorized domains** dans la console Firebase : ajoute ton domaine
   Vercel (`ton-app.vercel.app`), sinon la connexion échouera en prod.

## Comment fonctionne l'authentification

Le SDK client Firebase gère la connexion/inscription dans le navigateur. Une fois connecté, le
front envoie son `idToken` à `/api/auth/session`, qui le vérifie avec l'Admin SDK et crée un
**cookie de session httpOnly** (valable 14 jours). Le `middleware.js` vérifie juste la présence
de ce cookie pour les redirections rapides ; la vérification cryptographique complète a lieu dans
les Server Components (`getSessionUser()`), car l'Admin SDK ne tourne pas en Edge Runtime.

## Structure du projet

```
app/
  login/, signup/           Connexion / inscription (Firebase Auth)
  forgot-password/           Envoi du lien de réinitialisation
  reset-password/            Confirmation du nouveau mot de passe (oobCode)
  onboarding/                 Définition de l'objectif + génération IA + écriture Firestore
  dashboard/
    page.js                   Mots du jour (répétition espacée)
    scenarios/, scenarios/[id]/ Liste + conversation IA avec correction
    progression/               Stats
    compte/                    Éditer l'objectif, mot de passe, déconnexion, suppression
  api/
    auth/session/               Crée/supprime le cookie de session
    account/delete/              Supprime le compte + toutes les données Firestore
    generate-vocab/, generate-scenarios/, chat/  Appels Groq (inchangés)
lib/
  firebase/client.js            SDK client (Auth + Firestore, navigateur)
  firebase/admin.js             SDK Admin (serveur uniquement)
  firebase/session.js            Lecture du cookie de session (Server Components)
  spacedRepetition.js             Logique SM-2 simplifiée
firestore.rules                 Règles de sécurité (chacun accède à ses propres données)
middleware.js                    Garde d'auth optimiste (Edge Runtime)
```

## Modèle de données Firestore

```
objectifs/{objectifId}
  uid, langue_cible, type, metier, date_echeance, niveau_depart, createdAt

  mots/{motId}
    terme, traduction, contexte_usage, mastery, niveau_maitrise, prochaine_revision, date_decouverte

  scenarios/{scenarioId}
    titre, contexte, complete, messages: [{role, content|reply, correction?}], createdAt
```

Contrairement au schéma SQL de la version Supabase, la répétition espacée est stockée directement
sur le document `mot` (pas de table séparée), et les messages de conversation sont stockés dans le
document `scenario` — plus adapté à un modèle NoSQL orienté documents.

## Couverture du MVP

- ✅ Authentification (inscription, connexion, mot de passe oublié, changement de mot de passe)
- ✅ Définition d'objectif + génération IA (vocabulaire, scénarios)
- ✅ Répétition espacée (SM-2 simplifié)
- ✅ Conversation scénarisée avec correction en direct
- ✅ Suivi de progression
- ✅ Gestion de compte complète (édition, déconnexion, suppression en cascade)
