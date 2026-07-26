'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';

export default function ScenariosPage() {
  const user = useAuthUser();
  const [objectif, setObjectif] = useState(null);
  const [objectifId, setObjectifId] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [customError, setCustomError] = useState(null);

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

        const objId = objSnap.docs[0].id;
        setObjectif(objSnap.docs[0].data());
        setObjectifId(objId);

        const scenSnap = await getDocs(
          query(collection(db, 'objectifs', objId, 'scenarios'), orderBy('createdAt', 'asc'))
        );
        setScenarios(scenSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('ScenariosPage load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const createCustomScenario = async () => {
    if (!description.trim() || generating) return;
    setGenerating(true);
    setCustomError(null);
    try {
      const res = await fetch('/api/generate-custom-scenario', {
        method: 'POST',
        body: JSON.stringify({
          langue: objectif.langue_cible,
          niveau: objectif.niveau_depart,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const docRef = await addDoc(collection(db, 'objectifs', objectifId, 'scenarios'), {
        titre: data.scenario.titre,
        contexte: data.scenario.contexte,
        complete: false,
        messages: [],
        createdAt: serverTimestamp(),
      });

      setScenarios((prev) => [
        ...prev,
        { id: docRef.id, titre: data.scenario.titre, contexte: data.scenario.contexte, complete: false, messages: [] },
      ]);
      setDescription('');
      setShowCustomForm(false);
    } catch (err) {
      console.error('createCustomScenario error:', err);
      setCustomError('La génération a échoué, réessaie.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft">
          Scénarios de conversation
        </p>
        <button
          onClick={() => setShowCustomForm((v) => !v)}
          className="text-xs font-semibold text-coralDark bg-coralPale px-3 py-1.5 rounded-full"
        >
          {showCustomForm ? 'Annuler' : '+ Ma situation'}
        </button>
      </div>

      {showCustomForm && (
        <div className="bg-white border border-line rounded-2xl p-4 mb-4">
          <p className="text-[13px] text-inkSoft leading-relaxed mb-3">
            Décris une situation précise que tu veux préparer, en français : "je vais chez le médecin en
            Espagne", "je dois négocier mon salaire", "je rencontre les parents de mon copain"…
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Décris ta situation…"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm mb-3 resize-none"
          />
          {customError && (
            <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl mb-3">{customError}</p>
          )}
          <button
            onClick={createCustomScenario}
            disabled={generating || !description.trim()}
            className="w-full py-3 rounded-2xl bg-coral text-white text-sm font-semibold disabled:opacity-50"
          >
            {generating ? 'Génération…' : 'Générer ce scénario'}
          </button>
        </div>
      )}

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
