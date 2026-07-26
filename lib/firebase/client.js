import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Important : ces pages ("use client") sont tout de même pré-rendues côté serveur par
// Next.js pendant le build (pour générer le HTML initial). Le SDK client Firebase ne doit
// jamais s'initialiser à ce moment-là : il n'a besoin de tourner que dans le vrai navigateur
// (toutes les lectures/écritures ont lieu dans des useEffect, qui ne s'exécutent jamais côté
// serveur). Sans cette garde, un déploiement plante dès que la config n'est pas résolue
// exactement comme attendu au moment du build (ex: "auth/invalid-api-key").
let app;
let authInstance;
let dbInstance;

if (typeof window !== 'undefined') {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export const auth = authInstance;
export const db = dbInstance;
export default app;
