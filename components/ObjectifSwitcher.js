'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveObjectif } from '@/lib/firebase/objectif';
import { useAuthUser } from '@/lib/firebase/useAuthUser';

const TYPE_LABELS = { voyage: 'Voyage', travail: 'Travail', personnel: 'Personnel' };

export default function ObjectifSwitcher({ objectifs, activeId }) {
  const user = useAuthUser();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  if (!objectifs?.length) return null;

  const handleChange = async (e) => {
    const newId = e.target.value;
    if (newId === activeId || !user) return;
    setSwitching(true);
    try {
      await setActiveObjectif(user, newId);
      // Rechargement complet : le plus simple et le plus fiable pour resynchroniser
      // toutes les pages (dashboard, scénarios, progression...) sur le nouvel objectif.
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('ObjectifSwitcher error:', err);
      setSwitching(false);
    }
  };

  if (objectifs.length === 1) {
    return (
      <span className="text-xs font-semibold uppercase tracking-wide text-sageDark bg-sagePale px-3 py-1.5 rounded-full">
        {objectifs[0].langue_cible}
      </span>
    );
  }

  return (
    <div className="relative">
      <select
        value={activeId || ''}
        onChange={handleChange}
        disabled={switching}
        className="text-xs font-semibold uppercase tracking-wide text-sageDark bg-sagePale pl-3 pr-6 py-1.5 rounded-full appearance-none disabled:opacity-60"
      >
        {objectifs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.langue_cible} · {TYPE_LABELS[o.type]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sageDark text-[10px]">
        ▾
      </span>
    </div>
  );
}
