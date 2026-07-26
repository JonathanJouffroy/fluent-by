'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

/**
 * Retourne l'utilisateur Firebase courant, en attendant que le SDK ait fini de restaurer
 * la session depuis le stockage local (auth.currentUser peut être null pendant un court
 * instant après le montage, même si l'utilisateur est bien connecté).
 *
 * Valeur retournée :
 * - undefined : état pas encore résolu (ne rien faire, attendre)
 * - null : utilisateur non connecté
 * - User : utilisateur connecté
 */
export function useAuthUser() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  return user;
}
