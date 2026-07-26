import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/firebase/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const objectifsSnap = await adminDb().collection('objectifs').where('uid', '==', user.uid).get();

    // Supprime récursivement chaque objectif et ses sous-collections (mots, scenarios).
    await Promise.all(objectifsSnap.docs.map((d) => adminDb().recursiveDelete(d.ref)));

    await adminAuth().deleteUser(user.uid);

    const response = NextResponse.json({ success: true });
    response.cookies.set('session', '', { maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    console.error('delete account error:', error);
    return NextResponse.json({ error: 'Suppression du compte impossible.' }, { status: 500 });
  }
}
