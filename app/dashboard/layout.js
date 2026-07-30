import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import BottomNav from '@/components/BottomNav';
import ObjectifSwitcher from '@/components/ObjectifSwitcher';

export default async function DashboardLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const allSnapshot = await adminDb()
    .collection('objectifs')
    .where('uid', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .get();

  if (allSnapshot.empty) redirect('/onboarding');

  const objectifs = allSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  let activeId = objectifs[0].id; // repli par défaut : le plus récent
  try {
    const prefSnap = await adminDb().collection('users').doc(user.uid).get();
    const preferredId = prefSnap.exists ? prefSnap.data().activeObjectifId : null;
    if (preferredId && objectifs.some((o) => o.id === preferredId)) {
      activeId = preferredId;
    }
  } catch (err) {
    console.error('DashboardLayout preference read error:', err);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <span className="font-display text-xl font-semibold text-ink">
          Fluent <span className="italic font-normal text-sageDark">by</span>
        </span>
        <div className="flex items-center gap-2">
          <ObjectifSwitcher objectifs={objectifs} activeId={activeId} />
          <Link
            href="/dashboard/compte"
            aria-label="Mon compte"
            className="w-8 h-8 rounded-full bg-white border border-line flex items-center justify-center text-sm text-inkSoft"
          >
            ⚙
          </Link>
        </div>
      </div>
      <div className="flex-1 px-5 pb-28">{children}</div>
      <BottomNav />
    </div>
  );
}
