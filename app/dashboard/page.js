'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';
import { computeNextReview, isDue } from '@/lib/spacedRepetition';

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const TYPE_LABELS = { voyage: 'Voyage', travail: 'Travail', personnel: 'Personnel' };

export default function HomePage() {
  const user = useAuthUser();
  const [objectif, setObjectif] = useState(null);
  const [objectifId, setObjectifId] = useState(null);
  const [allWords, setAllWords] = useState([]);
  const [dueWords, setDueWords] = useState([]);
  const [totalWords, setTotalWords] = useState(0);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markError, setMarkError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [theme, setTheme] = useState('');
  const [generatingMore, setGeneratingMore] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(null);

  const load = async () => {
    if (!user) return;

    try {
      const objQuery = query(
        collection(db, 'objectifs'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const objSnap = await getDocs(objQuery);
      if (objSnap.empty) return;

      const objDoc = objSnap.docs[0];
      setObjectif(objDoc.data());
      setObjectifId(objDoc.id);

      const motsSnap = await getDocs(
        query(collection(db, 'objectifs', objDoc.id, 'mots'), orderBy('date_decouverte', 'asc'))
      );
      const all = motsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllWords(all);
      setTotalWords(all.length);

      const due = all
        .filter((w) => isDue(w))
        .sort((a, b) => {
          if (!a.prochaine_revision) return -1;
          if (!b.prochaine_revision) return 1;
          return new Date(a.prochaine_revision) - new Date(b.prochaine_revision);
        });
      setDueWords(due);
      setIdx(0);
    } catch (err) {
      console.error('HomePage load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      setLoading(false);
      return;
    }
    load();
  }, [user]);

  const mark = async (known) => {
    const word = dueWords[idx];
    setMarkError(null);
    try {
      const { niveau_maitrise, prochaine_revision, mastery } = computeNextReview(
        word.niveau_maitrise || 0,
        known
      );

      await updateDoc(doc(db, 'objectifs', objectifId, 'mots', word.id), {
        niveau_maitrise,
        prochaine_revision,
        mastery,
      });

      addDoc(collection(db, 'objectifs', objectifId, 'activity'), {
        type: 'mot_revise',
        known,
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
      }).catch((err) => console.error('activity log error:', err));

      if (idx < dueWords.length - 1) {
        setIdx(idx + 1);
      } else {
        setDueWords((prev) => prev.filter((_, i) => i !== idx));
        setIdx(0);
      }
    } catch (err) {
      console.error('mark() error:', err);
      setMarkError("La mise à jour a échoué. Vérifie ta connexion et réessaie.");
    }
  };

  const generateMoreWords = async () => {
    if (generatingMore) return;
    setGeneratingMore(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch('/api/generate-vocab', {
        method: 'POST',
        body: JSON.stringify({
          langue: objectif.langue_cible,
          type: objectif.type,
          niveau: objectif.niveau_depart,
          metier: objectif.metier || '',
          theme: theme.trim(),
          excludeTerms: allWords.map((w) => w.terme),
        }),
      });
      const data = await res.json();
      if (data.error || !data.vocab?.length) throw new Error(data.error || 'empty');

      const created = await Promise.all(
        data.vocab.map((w) =>
          addDoc(collection(db, 'objectifs', objectifId, 'mots'), {
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

      const newWords = data.vocab.map((w, i) => ({
        id: created[i].id,
        terme: w.terme,
        traduction: w.traduction,
        contexte_usage: w.contexte,
        mastery: 'nouveau',
        niveau_maitrise: 0,
        prochaine_revision: null,
      }));

      setAllWords((prev) => [...prev, ...newWords]);
      setTotalWords((prev) => prev + newWords.length);
      setDueWords((prev) => [...prev, ...newWords]);
      setAddSuccess(`${newWords.length} nouveaux mots ajoutés !`);
      setTheme('');
      setShowAddForm(false);
    } catch (err) {
      console.error('generateMoreWords error:', err);
      setAddError('La génération a échoué, réessaie.');
    } finally {
      setGeneratingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
      </div>
    );
  }

  const remaining = objectif?.date_echeance ? daysLeft(objectif.date_echeance) : null;

  return (
    <div className="pt-2">
      {objectif?.date_echeance && (
        <div className="bg-ink text-bg rounded-2xl px-5 py-4 flex items-center justify-between mb-6">
          <div>
            <div className="font-display text-2xl">{remaining}</div>
            <div className="text-[11px] uppercase tracking-wide text-[#C9CFC5]">jours restants</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#C9CFC5]">Objectif</div>
            <div className="text-sm font-semibold">{TYPE_LABELS[objectif.type]}</div>
          </div>
        </div>
      )}

      {!dueWords.length ? (
        <div className="bg-white border border-line rounded-2xl px-6 py-10 text-center mb-6">
          <p className="font-display text-xl mb-2">Tu es à jour !</p>
          <p className="text-sm text-inkSoft leading-relaxed">
            {totalWords
              ? "Tous tes mots ont été révisés récemment. Reviens demain pour la prochaine série, ou ajoute une nouvelle liste ci-dessous."
              : "Aucun mot pour l'instant."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft mb-3">
            Mots à revoir · {idx + 1}/{dueWords.length}
          </p>

          <div className="relative h-[250px] mb-4">
            <div className="absolute inset-0 bg-white rounded-xl2 p-6 flex flex-col justify-between border border-line shadow-[0_10px_30px_-12px_rgba(44,54,48,0.18)]">
              <div>
                {(dueWords[idx].niveau_maitrise || 0) >= 1 && (
                  <span className="text-[11px] bg-sagePale text-sageDark px-2.5 py-1 rounded-full font-semibold">
                    Appris
                  </span>
                )}
                <div className="font-display text-3xl font-medium mt-1">{dueWords[idx].terme}</div>
                <div className="text-sm text-coralDark font-semibold mt-1.5">{dueWords[idx].traduction}</div>
              </div>
              <div className="text-sm text-inkSoft italic leading-relaxed">{dueWords[idx].contexte_usage}</div>
              <div className="flex gap-1.5">
                {dueWords.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-coral' : 'bg-line'}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 mb-2">
            <button
              onClick={() => mark(false)}
              className="flex-1 py-3 rounded-2xl border border-line bg-white text-sm font-semibold text-inkSoft"
            >
              À revoir
            </button>
            <button
              onClick={() => mark(true)}
              className="flex-1 py-3 rounded-2xl bg-sagePale text-sm font-semibold text-sageDark"
            >
              Je connais déjà
            </button>
          </div>

          {markError && (
            <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl mb-2">{markError}</p>
          )}

          <div className="h-px bg-line my-6" />
        </>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft">
          Vocabulaire · {totalWords} mot{totalWords > 1 ? 's' : ''} au total
        </p>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="text-xs font-semibold text-coralDark bg-coralPale px-3 py-1.5 rounded-full whitespace-nowrap"
        >
          {showAddForm ? 'Annuler' : '+ Nouvelle liste'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-line rounded-2xl p-4 mb-2">
          <p className="text-[13px] text-inkSoft leading-relaxed mb-3">
            8 nouveaux mots liés à ton objectif. Tu peux préciser un thème (optionnel) pour cibler la
            liste, par exemple "transports", "vocabulaire médical", "small talk au bureau"…
          </p>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Thème (optionnel)"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm mb-3"
          />
          {addError && (
            <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl mb-3">{addError}</p>
          )}
          <button
            onClick={generateMoreWords}
            disabled={generatingMore}
            className="w-full py-3 rounded-2xl bg-coral text-white text-sm font-semibold disabled:opacity-50"
          >
            {generatingMore ? 'Génération…' : 'Générer 8 nouveaux mots'}
          </button>
        </div>
      )}

      {addSuccess && !showAddForm && (
        <p className="text-sm text-sageDark bg-sagePale px-4 py-2 rounded-xl">{addSuccess}</p>
      )}
    </div>
  );
}
