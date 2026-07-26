'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function LoginPage() {
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
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error('session failed');

      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError('Identifiants incorrects, réessaie.');
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

      <h1 className="font-display text-3xl mb-2">Content de te revoir</h1>
      <p className="text-inkSoft text-sm mb-8">Connecte-toi pour retrouver ton parcours.</p>

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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
          />
          <Link href="/forgot-password" className="text-xs text-sageDark font-semibold mt-2 inline-block">
            Mot de passe oublié ?
          </Link>
        </div>

        {error && <p className="text-sm text-coralDark bg-coralPale px-4 py-2 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-coral text-white font-semibold mt-2 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="text-sm text-inkSoft mt-6 text-center">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-sageDark font-semibold">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
