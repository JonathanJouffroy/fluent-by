'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

function ChatScenarioContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [objectif, setObjectif] = useState(null);
  const [objectifId, setObjectifId] = useState(searchParams.get('objectif'));
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;

      let objId = objectifId;
      if (!objId) {
        const objSnap = await getDocs(
          query(collection(db, 'objectifs'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1))
        );
        if (!objSnap.empty) objId = objSnap.docs[0].id;
        setObjectifId(objId);
      }
      if (!objId) return;

      const objDoc = await getDoc(doc(db, 'objectifs', objId));
      setObjectif(objDoc.data());

      const scenDoc = await getDoc(doc(db, 'objectifs', objId, 'scenarios', id));
      const scenData = { id: scenDoc.id, ...scenDoc.data() };
      setScenario(scenData);
      setMessages(scenData.messages || []);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, thinking]);

  const persist = async (newMessages) => {
    await updateDoc(doc(db, 'objectifs', objectifId, 'scenarios', id), { messages: newMessages });
  };

  const requestReply = async (history, userText, attachCorrection) => {
    setThinking(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          langue: objectif.langue_cible,
          niveau: objectif.niveau_depart,
          metier: objectif.metier,
          scenarioTitre: scenario.titre,
          scenarioContexte: scenario.contexte,
          history,
          userText,
          attachCorrection,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => {
        let updated = prev;
        if (attachCorrection) {
          updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'user') {
              updated[i] = { ...updated[i], correction: data.correction || '' };
              break;
            }
          }
        }
        const next = [...updated, { role: 'assistant', reply: data.reply }];
        persist(next);
        return next;
      });
    } catch (e) {
      setError("La conversation n'a pas pu se charger. Réessaie.");
    } finally {
      setThinking(false);
    }
  };

  useEffect(() => {
    if (!loading && !started.current && messages.length === 0 && objectif && scenario) {
      started.current = true;
      requestReply([], 'Commence la conversation dans ce scénario, présente-toi ou lance la situation naturellement.', false);
    }
  }, [loading, objectif, scenario]);

  const send = () => {
    if (!input.trim() || thinking) return;
    const userText = input.trim();
    const newHistory = [...messages, { role: 'user', content: userText }];
    setMessages(newHistory);
    persist(newHistory);
    setInput('');
    requestReply(messages, userText, true);
  };

  const finishScenario = async () => {
    await updateDoc(doc(db, 'objectifs', objectifId, 'scenarios', id), { complete: true });
    router.push('/dashboard/scenarios');
  };

  if (loading || !objectif || !scenario) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 max-w-[480px] mx-auto flex flex-col bg-bg">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line bg-white">
        <button onClick={() => router.push('/dashboard/scenarios')} className="text-xl px-1">
          ←
        </button>
        <div>
          <h2 className="font-display text-[17px] font-medium">{scenario.titre}</h2>
          <p className="text-xs text-inkSoft">
            {objectif.langue_cible} · {scenario.contexte}
          </p>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col max-w-[80%] ${m.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
            <div
              className={`px-4 py-3 rounded-2xl text-[15px] leading-snug ${
                m.role === 'user'
                  ? 'bg-sageDark text-white rounded-br-md'
                  : 'bg-white border border-line rounded-bl-md'
              }`}
            >
              {m.role === 'assistant' ? m.reply : m.content}
            </div>
            {m.role === 'user' && m.correction && (
              <div className="mt-1.5 text-[12.5px] text-coralDark bg-coralPale px-3 py-2 rounded-xl leading-snug">
                <b>Correction · </b>
                {m.correction}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="self-start bg-white border border-line rounded-2xl rounded-bl-md px-4 py-3.5 flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-inkSoft animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-inkSoft animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-inkSoft animate-bounce [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {error && <div className="mx-4 mb-2 text-sm text-coralDark bg-coralPale px-3.5 py-2 rounded-xl">{error}</div>}

      {!scenario.complete && (
        <button
          onClick={finishScenario}
          className="mx-4 mb-3.5 py-2.5 rounded-xl bg-sagePale text-sageDark text-[13px] font-semibold text-center"
        >
          Terminer ce scénario
        </button>
      )}

      <div className="flex gap-2.5 px-4 py-3.5 border-t border-line bg-white pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
        <input
          placeholder={`Réponds en ${objectif.langue_cible}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          className="flex-1 border border-line rounded-full px-4.5 py-3 text-[15px]"
        />
        <button
          onClick={send}
          disabled={thinking || !input.trim()}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shrink-0 disabled:bg-[#D8D0BE]"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

export default function ChatScenarioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
        </div>
      }
    >
      <ChatScenarioContent />
    </Suspense>
  );
}
