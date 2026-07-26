'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';

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

export default function ComptePage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [objectif, setObjectif] = useState(null);
  const [objectifId, setObjectifId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingObjectif, setSavingObjectif] = useState(false);
  const [objectifMsg, setObjectifMsg] = useState(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      setEmail(user.email);

      const objSnap = await getDocs(
        query(collection(db, 'objectifs'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1))
      );
      if (!objSnap.empty) {
        setObjectif(objSnap.docs[0].data());
        setObjectifId(objSnap.docs[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const saveObjectif = async () => {
    setSavingObjectif(true);
    setObjectifMsg(null);
    try {
      await updateDoc(doc(db, 'objectifs', objectifId), {
        langue_cible: objectif.langue_cible,
        type: objectif.type,
        metier: objectif.type === 'travail' ? objectif.metier || null : null,
        niveau_depart: objectif.niveau_depart,
        date_echeance: objectif.date_echeance || null,
      });
      setObjectifMsg('Objectif mis à jour.');
    } catch {
      setObjectifMsg('La sauvegarde a échoué.');
    } finally {
      setSavingObjectif(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setPasswordMsg('Mot de passe mis à jour.');
      setNewPassword('');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setPasswordMsg('Pour des raisons de sécurité, reconnecte-toi puis réessaie.');
      } else {
        setPasswordMsg("Le mot de passe n'a pas pu être changé.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    await signOut(auth);
    router.push('/login');
    router.refresh();
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await signOut(auth);
      router.push('/login');
      router.refresh();
    } catch (e) {
      setDeleteError('La suppression a échoué, réessaie.');
      setDeleting(false);
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
    <div className="pt-2 pb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft mb-3">Mon compte</p>
      <div className="bg-white border border-line rounded-2xl p-5 mb-6">
        <p className="text-[13px] text-inkSoft mb-1">Connecté en tant que</p>
        <p className="font-medium">{email}</p>
      </div>

      {objectif && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft mb-3">Mon objectif</p>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
              Langue cible
            </label>
            <select
              value={objectif.langue_cible}
              onChange={(e) => setObjectif({ ...objectif, langue_cible: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm appearance-none"
            >
              {LANGUES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
              Type d'objectif
            </label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setObjectif({ ...objectif, type: t.id })}
                  className={`px-4 py-3 rounded-full border text-sm font-medium ${
                    objectif.type === t.id
                      ? 'bg-sageDark border-sageDark text-white'
                      : 'bg-white border-line text-inkSoft'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {objectif.type === 'travail' && (
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
                Ton métier / secteur
              </label>
              <input
                type="text"
                value={objectif.metier || ''}
                onChange={(e) => setObjectif({ ...objectif, metier: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
              Niveau de départ
            </label>
            <div className="flex gap-2 flex-wrap">
              {NIVEAUX.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setObjectif({ ...objectif, niveau_depart: n.id })}
                  className={`px-4 py-3 rounded-full border text-sm font-medium ${
                    objectif.niveau_depart === n.id
                      ? 'bg-sageDark border-sageDark text-white'
                      : 'bg-white border-line text-inkSoft'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-sageDark mb-2">
              Échéance
            </label>
            <input
              type="date"
              value={objectif.date_echeance || ''}
              onChange={(e) => setObjectif({ ...objectif, date_echeance: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
            />
          </div>

          {objectifMsg && (
            <p className="text-sm text-sageDark bg-sagePale px-4 py-2 rounded-xl mb-3">{objectifMsg}</p>
          )}

          <button
            onClick={saveObjectif}
            disabled={savingObjectif}
            className="w-full py-3.5 rounded-2xl bg-sageDark text-white font-semibold disabled:opacity-50"
          >
            {savingObjectif ? 'Sauvegarde…' : 'Enregistrer les modifications'}
          </button>
          <p className="text-xs text-inkSoft mt-2 leading-relaxed">
            Note : changer la langue ou le type ne régénère pas automatiquement le vocabulaire déjà créé.
          </p>
        </div>
      )}

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft mb-3">Mot de passe</p>
        <form onSubmit={changePassword} className="flex flex-col gap-3">
          <input
            type="password"
            required
            minLength={6}
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm"
          />
          {passwordMsg && (
            <p className="text-sm text-sageDark bg-sagePale px-4 py-2 rounded-xl">{passwordMsg}</p>
          )}
          <button
            type="submit"
            disabled={savingPassword}
            className="w-full py-3.5 rounded-2xl bg-sageDark text-white font-semibold disabled:opacity-50"
          >
            {savingPassword ? 'Mise à jour…' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>

      <button
        onClick={logout}
        className="w-full py-3.5 rounded-2xl border border-line bg-white font-semibold text-inkSoft mb-8"
      >
        Se déconnecter
      </button>

      <div className="border border-coralPale bg-coralPale/40 rounded-2xl p-5">
        <p className="font-display text-lg mb-1.5 text-coralDark">Supprimer mon compte</p>
        <p className="text-[13px] text-inkSoft leading-relaxed mb-4">
          Cette action est irréversible : ton objectif, ton vocabulaire, tes scénarios et tes conversations
          seront définitivement supprimés. Tape <b>SUPPRIMER</b> pour confirmer.
        </p>
        <input
          type="text"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-sm mb-3"
        />
        {deleteError && <p className="text-sm text-coralDark mb-3">{deleteError}</p>}
        <button
          onClick={deleteAccount}
          disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
          className="w-full py-3.5 rounded-2xl bg-coral text-white font-semibold disabled:opacity-40"
        >
          {deleting ? 'Suppression…' : 'Supprimer définitivement mon compte'}
        </button>
      </div>
    </div>
  );
}
