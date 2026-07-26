import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

/**
 * À utiliser uniquement dans des Server Components ou Route Handlers (runtime Node.js).
 *
 * Note perf : le deuxième argument de verifySessionCookie (checkRevoked) ajoute un appel
 * réseau supplémentaire pour vérifier si la session a été explicitement révoquée. On le
 * laisse à false ici : le cookie expire de toute façon au bout de 14 jours (voir
 * /api/auth/session), et ce contrôle en temps réel n'est pas nécessaire pour cette app —
 * il double inutilement la latence de chaque premier chargement du dashboard après connexion.
 */
export async function getSessionUser() {
  const cookieStore = cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(session, false);
    return decoded;
  } catch {
    return null;
  }
}
