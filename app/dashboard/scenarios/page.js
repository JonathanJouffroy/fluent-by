'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export default function ScenariosPage() {
  const [objectifId, setObjectifId] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;

      const objSnap = await getDocs(
        query(collection(db, 'objectifs'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1))
      );
      if (objSnap.empty) {
        setLoading(false);
        return;
      }
      const objId = objSnap.docs[0].id;
      setObjectifId(objId);

      const scenSnap = await getDocs(
        query(collection(db, 'objectifs', objId, 'scenarios'), orderBy('createdAt', 'asc'))
      );
      setScenarios(scenSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft mb-3">
        Scénarios de conversation
      </p>
      {scenarios.map((s) => (
        <Link
          key={s.id}
          href={`/dashboard/scenarios/${s.id}?objectif=${objectifId}`}
          className="bg-white border border-line rounded-2xl p-4 mb-3 flex items-center justify-between gap-3"
        >
          <div>
            <p className="font-display text-lg mb-0.5">{s.titre}</p>
            <p className="text-[13px] text-inkSoft leading-snug">{s.contexte}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide whitespace-nowrap ${
                s.complete ? 'bg-sagePale text-sageDark' : 'bg-coralPale text-coralDark'
              }`}
            >
              {s.complete ? 'Fait' : 'À faire'}
            </span>
            <span className="text-inkSoft text-lg">›</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
