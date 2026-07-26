'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';

const TYPE_LABELS = { voyage: 'Voyage', travail: 'Travail', personnel: 'Personnel' };

export default function FichePage() {
  const user = useAuthUser();
  const router = useRouter();
  const [objectif, setObjectif] = useState(null);
  const [words, setWords] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const objSnap = await getDocs(
          query(collection(db, 'objectifs'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1))
        );
        if (objSnap.empty) return;

        const objDoc = objSnap.docs[0];
        setObjectif(objDoc.data());

        const [motsSnap, scenSnap] = await Promise.all([
          getDocs(query(collection(db, 'objectifs', objDoc.id, 'mots'), orderBy('date_decouverte', 'asc'))),
          getDocs(collection(db, 'objectifs', objDoc.id, 'scenarios')),
        ]);
        setWords(motsSnap.docs.map((d) => d.data()));
        setScenarios(scenSnap.docs.map((d) => d.data()));
      } catch (err) {
        console.error('FichePage load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-2 pb-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-xl px-1">
          ←
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft flex-1">
          Fiche récap · à consulter hors-ligne
        </p>
        <button
          onClick={() => window.print()}
          className="text-xs font-semibold text-white bg-coral px-3 py-1.5 rounded-full"
        >
          Exporter / Imprimer
        </button>
      </div>

      <div className="mb-6">
        <p className="font-display text-2xl mb-1">{objectif?.langue_cible}</p>
        <p className="text-sm text-inkSoft">
          {TYPE_LABELS[objectif?.type]}
          {objectif?.metier ? ` · ${objectif.metier}` : ''}
        </p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-sageDark mb-3">Vocabulaire clé</p>
      <div className="mb-6">
        {words.map((w, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between py-2.5 border-b border-line last:border-0"
          >
            <div>
              <span className="font-display text-base">{w.terme}</span>
              <span className="text-sm text-coralDark font-semibold ml-2">{w.traduction}</span>
            </div>
          </div>
        ))}
        {!words.length && <p className="text-sm text-inkSoft">Aucun mot pour l'instant.</p>}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-sageDark mb-3">
        Situations préparées
      </p>
      <div>
        {scenarios.map((s, i) => (
          <div key={i} className="py-2.5 border-b border-line last:border-0">
            <p className="font-display text-base mb-0.5">{s.titre}</p>
            <p className="text-sm text-inkSoft">{s.contexte}</p>
          </div>
        ))}
        {!scenarios.length && <p className="text-sm text-inkSoft">Aucun scénario pour l'instant.</p>}
      </div>

      <p className="no-print text-xs text-inkSoft mt-6 leading-relaxed">
        Astuce : utilise "Exporter / Imprimer" puis choisis "Enregistrer en PDF" pour garder cette
        fiche accessible hors-ligne (avion, sans réseau) sur ton téléphone.
      </p>
    </div>
  );
}
