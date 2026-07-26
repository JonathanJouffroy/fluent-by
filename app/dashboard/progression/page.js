'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant cette date, au format YYYY-MM-DD. */
function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return isoDate(monday);
}

function formatWeekLabel(mondayStr) {
  const d = new Date(mondayStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** Construit les N dernières semaines (clé lundi) avec un compteur d'activité initialisé à 0. */
function buildLastWeeks(count) {
  const weeks = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const key = weekKey(isoDate(d));
    if (!weeks.find((w) => w.key === key)) weeks.push({ key, count: 0 });
  }
  return weeks;
}

export default function ProgressionPage() {
  const user = useAuthUser();
  const [objectif, setObjectif] = useState(null);
  const [words, setWords] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [activity, setActivity] = useState([]);
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

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 56); // 8 semaines glissantes

        const [motsSnap, scenSnap, activitySnap] = await Promise.all([
          getDocs(collection(db, 'objectifs', objDoc.id, 'mots')),
          getDocs(collection(db, 'objectifs', objDoc.id, 'scenarios')),
          getDocs(
            query(collection(db, 'objectifs', objDoc.id, 'activity'), where('date', '>=', isoDate(cutoff)))
          ),
        ]);
        setWords(motsSnap.docs.map((d) => d.data()));
        setScenarios(scenSnap.docs.map((d) => d.data()));
        setActivity(activitySnap.docs.map((d) => d.data()));
      } catch (err) {
        console.error('ProgressionPage load error:', err);
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

  const learned = words.filter((w) => (w.niveau_maitrise || 0) >= 1).length;
  const done = scenarios.filter((s) => s.complete).length;
  const remaining = objectif?.date_echeance ? daysLeft(objectif.date_echeance) : null;

  const weeks = buildLastWeeks(6);
  activity
    .filter((a) => a.type === 'mot_revise')
    .forEach((a) => {
      const key = weekKey(a.date);
      const w = weeks.find((w) => w.key === key);
      if (w) w.count += 1;
    });
  const maxCount = Math.max(1, ...weeks.map((w) => w.count));

  const today = new Date();
  const last7Dates = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    last7Dates.add(isoDate(d));
  }
  const activeDates = new Set(activity.filter((a) => last7Dates.has(a.date)).map((a) => a.date));
  const activeDaysCount = activeDates.size;

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

      <div className="bg-white border border-line rounded-2xl p-5 mb-3.5">
        <p className="text-[13px] text-inkSoft mb-3">Régularité (7 derniers jours)</p>
        <div className="flex items-end gap-2 mb-2">
          {[...last7Dates].sort().map((dateStr) => (
            <div
              key={dateStr}
              className={`flex-1 h-8 rounded-lg ${activeDates.has(dateStr) ? 'bg-sageDark' : 'bg-sagePale'}`}
              title={dateStr}
            />
          ))}
        </div>
        <p className="text-sm text-inkSoft">
          <span className="font-semibold text-ink">{activeDaysCount}</span> jour
          {activeDaysCount > 1 ? 's' : ''} actif{activeDaysCount > 1 ? 's' : ''} sur les 7 derniers
        </p>
      </div>

      <div className="bg-white border border-line rounded-2xl p-5 mb-3.5">
        <p className="text-[13px] text-inkSoft mb-3">Mots révisés par semaine</p>
        <div className="flex items-end gap-2 h-24">
          {weeks.map((w) => (
            <div key={w.key} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
              <div
                className="w-full bg-coral rounded-t-md transition-all"
                style={{ height: `${Math.max(4, (w.count / maxCount) * 100)}%` }}
                title={`${w.count} mots`}
              />
              <span className="text-[10px] text-inkSoft">{formatWeekLabel(w.key)}</span>
            </div>
          ))}
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
