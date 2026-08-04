'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      setSent(true);
    } catch (e) {
      setError("L'envoi a échoué, vérifie l'adresse email.");
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

      <h1 className="font-display text-3xl mb-2">Mot de passe oublié</h1>
      <p className="text-inkSoft text-sm mb-8">On t'envoie un lien pour en choisir un nouveau.</p>

      {sent ? (
        <p className="text-sm text-sageDark bg-sagePale px-4 py-3 rounded-xl">
          Un email vient de t'être envoyé avec un lien de réinitialisation.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
            />
          </div>

          {error && <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-coral text-white font-semibold mt-2 disabled:opacity-50"
          >
            {loading ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}

      <p className="text-sm text-inkSoft mt-6 text-center">
        <Link href="/login" className="text-sageDark font-semibold">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
