import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ⚠️ Utilise la clé privée du compte de service : ne jamais importer ce fichier
// depuis un composant client. Réservé aux fichiers server-only (route.js, Server Components).
//
// Important : l'initialisation est volontairement paresseuse (dans getAdminApp(), appelée
// seulement quand adminAuth()/adminDb() sont réellement invoqués). Si on initialisait au
// niveau du module (top-level), Next.js exécuterait ce code pendant l'étape "Collecting page
// data" du build — avant même que les variables d'environnement runtime soient garanties —
// et ferait planter le build avec une erreur "project_id" manquant.
let cachedApp;

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  if (cachedApp) return cachedApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Variables Firebase Admin manquantes (FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY). Vérifie les Environment Variables sur Vercel.'
    );
  }

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return cachedApp;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
