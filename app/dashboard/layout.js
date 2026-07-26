import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import BottomNav from '@/components/BottomNav';

export default async function DashboardLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const snapshot = await adminDb
    .collection('objectifs')
    .where('uid', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) redirect('/onboarding');

  const objectif = snapshot.docs[0].data();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <span className="font-display text-xl font-semibold text-ink">
          Fluent <span className="italic font-normal text-sageDark">by</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-sageDark bg-sagePale px-3 py-1.5 rounded-full">
            {objectif.langue_cible}
          </span>
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
