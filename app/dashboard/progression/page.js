'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function ProgressionPage() {
  const [objectif, setObjectif] = useState(null);
  const [words, setWords] = useState([]);
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
      const objDoc = objSnap.docs[0];
      setObjectif(objDoc.data());

      const [motsSnap, scenSnap] = await Promise.all([
        getDocs(collection(db, 'objectifs', objDoc.id, 'mots')),
        getDocs(collection(db, 'objectifs', objDoc.id, 'scenarios')),
      ]);
      setWords(motsSnap.docs.map((d) => d.data()));
      setScenarios(scenSnap.docs.map((d) => d.data()));
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

  const learned = words.filter((w) => w.mastery === 'appris').length;
  const done = scenarios.filter((s) => s.complete).length;
  const remaining = objectif?.date_echeance ? daysLeft(objectif.date_echeance) : null;

  return (
    <div className="pt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft mb-3">Ta progression</p>

      <div className="bg-white border border-line rounded-2xl p-5 mb-3.5">
        <p className="text-[13px] text-inkSoft mb-1.5">Mots maîtrisés</p>
        <p className="font-display text-3xl mb-2.5">
          {learned}
          <span className="text-base text-inkSoft"> / {words.length}</span>
        </p>
        <div className="h-2 bg-sagePale rounded-full overflow-hidden">
          <div
            className="h-full bg-sageDark rounded-full transition-all"
            style={{ width: `${words.length ? (learned / words.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl p-5 mb-3.5">
        <p className="text-[13px] text-inkSoft mb-1.5">Scénarios complétés</p>
        <p className="font-display text-3xl mb-2.5">
          {done}
          <span className="text-base text-inkSoft"> / {scenarios.length}</span>
        </p>
        <div className="h-2 bg-sagePale rounded-full overflow-hidden">
          <div
            className="h-full bg-sageDark rounded-full transition-all"
            style={{ width: `${scenarios.length ? (done / scenarios.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {objectif?.date_echeance && (
        <div className="bg-white border border-line rounded-2xl p-5">
          <p className="text-[13px] text-inkSoft mb-1.5">Jours avant l'échéance</p>
          <p className="font-display text-3xl">{remaining}</p>
        </div>
      )}
    </div>
  );
}
