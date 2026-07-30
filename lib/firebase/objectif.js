import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/**
 * Retourne l'objectif actuellement actif pour l'utilisateur :
 * - s'il a déjà choisi un objectif actif (users/{uid}.activeObjectifId), on le retourne
 * - sinon on retombe sur le plus récent, et on l'enregistre comme actif pour la prochaine fois
 */
export async function getActiveObjectif(user) {
  if (!user) return null;

  try {
    const prefSnap = await getDoc(doc(db, 'users', user.uid));
    const activeId = prefSnap.exists() ? prefSnap.data().activeObjectifId : null;

    if (activeId) {
      const objSnap = await getDoc(doc(db, 'objectifs', activeId));
      if (objSnap.exists() && objSnap.data().uid === user.uid) {
        return { id: objSnap.id, ...objSnap.data() };
      }
    }
  } catch (err) {
    console.error('getActiveObjectif preference read error:', err);
  }

  const snap = await getDocs(
    query(collection(db, 'objectifs'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1))
  );
  if (snap.empty) return null;

  const objDoc = snap.docs[0];
  setActiveObjectif(user, objDoc.id).catch(() => {});
  return { id: objDoc.id, ...objDoc.data() };
}

/** Liste tous les objectifs de l'utilisateur (pour le sélecteur), du plus récent au plus ancien. */
export async function listObjectifs(user) {
  if (!user) return [];
  const snap = await getDocs(
    query(collection(db, 'objectifs'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Change l'objectif actif de l'utilisateur (persisté, survit aux rechargements). */
export async function setActiveObjectif(user, objectifId) {
  if (!user) return;
  await setDoc(doc(db, 'users', user.uid), { activeObjectifId: objectifId }, { merge: true });
}
