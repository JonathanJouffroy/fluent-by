'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [checking, setChecking] = useState(true);
  const [validCode, setValidCode] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setChecking(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(() => setValidCode(true))
      .catch(() => setValidCode(false))
      .finally(() => setChecking(false));
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 1200);
    } catch (e) {
      setError('La mise à jour a échoué, réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 pt-14 flex flex-col min-h-screen min-h-dvh">
      <div className="mb-10">
        <span className="font-display text-2xl font-semibold text-ink">
          Fluent <span className="italic font-normal text-sageDark">by</span>
        </span>
      </div>

      <h1 className="font-display text-3xl mb-2">Nouveau mot de passe</h1>
      <p className="text-inkSoft text-sm mb-8">Choisis un nouveau mot de passe pour ton compte.</p>

      {checking ? (
        <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
      ) : !validCode ? (
        <p className="text-sm text-coralDark bg-coralPale px-4 py-3 rounded-xl">
          Ce lien est invalide ou a expiré. Redemande un lien de réinitialisation.
        </p>
      ) : done ? (
        <p className="text-sm text-sageDark bg-sagePale px-4 py-3 rounded-xl">
          Mot de passe mis à jour, redirection…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            required
            minLength={6}
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
          />
          {error && <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-coral text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Mise à jour…' : 'Valider'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 pt-14 flex flex-col min-h-screen min-h-dvh">
          <div className="w-8 h-8 rounded-full border-4 border-sagePale border-t-sageDark animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
