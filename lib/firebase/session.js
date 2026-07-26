import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

/** À utiliser uniquement dans des Server Components ou Route Handlers (runtime Node.js). */
export async function getSessionUser() {
  const cookieStore = cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded;
  } catch {
    return null;
  }
}
