'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

function friendlyError(code) {
  if (code === 'auth/email-already-in-use') return 'Un compte existe déjà avec cet email.';
  if (code === 'auth/weak-password') return 'Mot de passe trop court (6 caractères minimum).';
  if (code === 'auth/invalid-email') return 'Email invalide.';
  return "L'inscription a échoué, réessaie.";
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error('session failed');

      router.push('/onboarding');
      router.refresh();
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 pt-14 flex flex-col min-h-screen">
      <div className="mb-10">
        <span className="font-display text-2xl font-semibold text-ink">
          Fluent <span className="italic font-normal text-sageDark">by</span>
        </span>
      </div>

      <h1 className="font-display text-3xl mb-2">Créer un compte</h1>
      <p className="text-inkSoft text-sm mb-8">Un objectif. Pas un programme.</p>

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
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
            Mot de passe
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
          />
        </div>

        {error && <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-coral text-white font-semibold mt-2 disabled:opacity-50"
        >
          {loading ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>

      <p className="text-sm text-inkSoft mt-6 text-center">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-sageDark font-semibold">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
