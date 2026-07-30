'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';
import { getActiveObjectif } from '@/lib/firebase/objectif';

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
        const objData = await getActiveObjectif(user);
        if (!objData) return;

        const { id: objId, ...rest } = objData;
        setObjectif(rest);

        const [motsSnap, scenSnap] = await Promise.all([
          getDocs(query(collection(db, 'objectifs', objId, 'mots'), orderBy('date_decouverte', 'asc'))),
          getDocs(collection(db, 'objectifs', objId, 'scenarios')),
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

  const toReview = words.filter((w) => (w.niveau_maitrise || 0) < 1);
  const mastered = words.filter((w) => (w.niveau_maitrise || 0) >= 1);
  const todoScenarios = scenarios.filter((s) => !s.complete);
  const doneScenarios = scenarios.filter((s) => s.complete);

  const WordGrid = ({ list }) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {list.map((w, i) => (
        <div key={i} className="py-1.5 border-b border-line">
          <p className="font-display text-[15px] leading-snug break-words">{w.terme}</p>
          <p className="text-[13px] text-coralDark font-semibold leading-snug break-words">{w.traduction}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="pt-2 pb-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-break { break-inside: avoid; }
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

      <div className="mb-5">
        <p className="font-display text-2xl mb-1">{objectif?.langue_cible}</p>
        <p className="text-sm text-inkSoft">
          {TYPE_LABELS[objectif?.type]}
          {objectif?.metier ? ` · ${objectif.metier}` : ''}
        </p>
      </div>

      {words.length + scenarios.length > 0 && (
        <div className="no-print bg-sagePale rounded-2xl px-4 py-3 mb-6 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-sageDark font-semibold">
          {toReview.length > 0 && <span>À réviser en priorité · {toReview.length}</span>}
          {mastered.length > 0 && <span>Déjà maîtrisés · {mastered.length}</span>}
          {todoScenarios.length > 0 && <span>Situations à faire · {todoScenarios.length}</span>}
          {doneScenarios.length > 0 && <span>Situations faites · {doneScenarios.length}</span>}
        </div>
      )}

      {toReview.length > 0 && (
        <div className="mb-6 print-break">
          <p className="text-xs font-semibold uppercase tracking-wide text-coralDark mb-2">
            À réviser en priorité · {toReview.length}
          </p>
          <WordGrid list={toReview} />
        </div>
      )}

      {mastered.length > 0 && (
        <div className="mb-6 print-break">
          <p className="text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
            Déjà maîtrisés · {mastered.length}
          </p>
          <WordGrid list={mastered} />
        </div>
      )}

      {!words.length && <p className="text-sm text-inkSoft mb-6">Aucun mot pour l'instant.</p>}

      {todoScenarios.length > 0 && (
        <div className="mb-6 print-break">
          <p className="text-xs font-semibold uppercase tracking-wide text-coralDark mb-2">
            Situations à faire · {todoScenarios.length}
          </p>
          {todoScenarios.map((s, i) => (
            <div key={i} className="py-2.5 border-b border-line last:border-0">
              <p className="font-display text-base mb-0.5">{s.titre}</p>
              <p className="text-sm text-inkSoft">{s.contexte}</p>
            </div>
          ))}
        </div>
      )}

      {doneScenarios.length > 0 && (
        <div className="mb-6 print-break">
          <p className="text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
            Situations faites · {doneScenarios.length}
          </p>
          {doneScenarios.map((s, i) => (
            <div key={i} className="py-2.5 border-b border-line last:border-0">
              <p className="font-display text-base mb-0.5">{s.titre}</p>
              <p className="text-sm text-inkSoft">{s.contexte}</p>
            </div>
          ))}
        </div>
      )}

      {!scenarios.length && <p className="text-sm text-inkSoft">Aucun scénario pour l'instant.</p>}

      <p className="no-print text-xs text-inkSoft mt-6 leading-relaxed">
        Astuce : utilise "Exporter / Imprimer" puis choisis "Enregistrer en PDF" pour garder cette
        fiche accessible hors-ligne (avion, sans réseau) sur ton téléphone.
      </p>
    </div>
  );
}
