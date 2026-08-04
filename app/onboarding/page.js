'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';
import { setActiveObjectif } from '@/lib/firebase/objectif';

const LANGUES = ['Espagnol', 'Anglais', 'Italien', 'Allemand', 'Portugais', 'Japonais'];
const TYPES = [
  { id: 'voyage', label: 'Voyage' },
  { id: 'travail', label: 'Travail' },
  { id: 'personnel', label: 'Personnel' },
];
const NIVEAUX = [
  { id: 'debutant', label: 'Débutant' },
  { id: 'intermediaire', label: 'Intermédiaire' },
  { id: 'avance', label: 'Avancé' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthUser();

  const [langue, setLangue] = useState('Espagnol');
  const [type, setType] = useState('voyage');
  const [date, setDate] = useState('');
  const [niveau, setNiveau] = useState('debutant');
  const [metier, setMetier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) throw new Error('not authenticated');

      const payload = { langue, type, niveau, metier: type === 'travail' ? metier.trim() : '' };

      const [vocabRes, scenariosRes] = await Promise.all([
        fetch('/api/generate-vocab', { method: 'POST', body: JSON.stringify(payload) }),
        fetch('/api/generate-scenarios', { method: 'POST', body: JSON.stringify(payload) }),
      ]);
      const { vocab } = await vocabRes.json();
      const { scenarios } = await scenariosRes.json();

      const objectifRef = await addDoc(collection(db, 'objectifs'), {
        uid: user.uid,
        langue_cible: langue,
        type,
        metier: payload.metier || null,
        date_echeance: date || null,
        niveau_depart: niveau,
        createdAt: serverTimestamp(),
      });

      if (vocab?.length) {
        await Promise.all(
          vocab.map((w) =>
            addDoc(collection(db, 'objectifs', objectifRef.id, 'mots'), {
              terme: w.terme,
              traduction: w.traduction,
              contexte_usage: w.contexte,
              mastery: 'nouveau',
              niveau_maitrise: 0,
              prochaine_revision: null,
              date_decouverte: serverTimestamp(),
            })
          )
        );
      }

      if (scenarios?.length) {
        await Promise.all(
          scenarios.map((s) =>
            addDoc(collection(db, 'objectifs', objectifRef.id, 'scenarios'), {
              titre: s.titre,
              contexte: s.contexte,
              complete: false,
              messages: [],
              createdAt: serverTimestamp(),
            })
          )
        );
      }

      // Ne doit jamais bloquer la création de l'objectif si ça échoue (ex: règles Firestore
      // pas encore déployées pour la collection users/) — l'objectif est déjà créé à ce stade.
      try {
        await setActiveObjectif(user, objectifRef.id);
      } catch (prefError) {
        console.error('setActiveObjectif error (non bloquant):', prefError);
      }

      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('La génération a échoué, réessaie dans un instant.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center gap-4 px-5">
        <div className="w-9 h-9 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
        <p className="font-display text-lg text-sageDark">On prépare ton parcours…</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 pb-10 flex flex-col min-h-screen min-h-dvh">
      <span className="font-display text-xl font-semibold text-ink mb-6">
        Fluent <span className="italic font-normal text-sageDark">by</span>
      </span>

      <h1 className="font-display text-3xl mb-2 leading-tight">
        Un objectif.
        <br />
        Pas un programme.
      </h1>
      <p className="text-inkSoft text-sm mb-8 leading-relaxed">
        Dis-nous ce que tu prépares, on s'occupe du vocabulaire et des mises en situation.
      </p>

      {error && <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl mb-4">{error}</p>}

      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
          Langue cible
        </label>
        <select
          value={langue}
          onChange={(e) => setLangue(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm appearance-none"
        >
          {LANGUES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
          Type d'objectif
        </label>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`px-4 py-3 rounded-full border text-sm font-medium ${
                type === t.id ? 'bg-sageDark border-sageDark text-white' : 'bg-white border-line text-inkSoft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'travail' && (
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
            Ton métier / secteur
          </label>
          <input
            type="text"
            placeholder="Ex : infirmière, développeur, commercial…"
            value={metier}
            onChange={(e) => setMetier(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
          />
        </div>
      )}

      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
          Niveau de départ
        </label>
        <div className="flex gap-2 flex-wrap">
          {NIVEAUX.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setNiveau(n.id)}
              className={`px-4 py-3 rounded-full border text-sm font-medium ${
                niveau === n.id ? 'bg-sageDark border-sageDark text-white' : 'bg-white border-line text-inkSoft'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
          Échéance (optionnel)
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
        />
      </div>

      <button onClick={handleSubmit} className="w-full py-4 rounded-2xl bg-coral text-white font-semibold">
        Générer mon parcours
      </button>
    </div>
  );
}
