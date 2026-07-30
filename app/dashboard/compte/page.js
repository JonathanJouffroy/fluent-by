'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { useAuthUser } from '@/lib/firebase/useAuthUser';
import { getActiveObjectif } from '@/lib/firebase/objectif';

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
  const user = useAuthUser();

  const [email, setEmail] = useState('');
  const [objectif, setObjectif] = useState(null);
  const [originalObjectif, setOriginalObjectif] = useState(null);
  const [objectifId, setObjectifId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingObjectif, setSavingObjectif] = useState(false);
  const [objectifMsg, setObjectifMsg] = useState(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setEmail(user.email);

        const objData = await getActiveObjectif(user);
        if (objData) {
          const { id, ...rest } = objData;
          setObjectif(rest);
          setOriginalObjectif(rest);
          setObjectifId(id);
        }
      } catch (err) {
        console.error('ComptePage load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSaveClick = () => {
    const metier = objectif.type === 'travail' ? objectif.metier || '' : '';
    const originalMetier = originalObjectif.type === 'travail' ? originalObjectif.metier || '' : '';
    const needsRegeneration =
      objectif.langue_cible !== originalObjectif.langue_cible ||
      objectif.type !== originalObjectif.type ||
      metier !== originalMetier;

    if (needsRegeneration) {
      setObjectifMsg(null);
      setShowRegenConfirm(true);
      return;
    }

    saveObjectif(false);
  };

  const saveObjectif = async (regenerate) => {
    setShowRegenConfirm(false);
    setSavingObjectif(true);
    setObjectifMsg(null);

    const metier = objectif.type === 'travail' ? objectif.metier || '' : '';

    try {
      await updateDoc(doc(db, 'objectifs', objectifId), {
        langue_cible: objectif.langue_cible,
        type: objectif.type,
        metier: metier || null,
        niveau_depart: objectif.niveau_depart,
        date_echeance: objectif.date_echeance || null,
      });

      if (regenerate) {
        setObjectifMsg('Régénération du vocabulaire et des scénarios…');

        const payload = { langue: objectif.langue_cible, type: objectif.type, niveau: objectif.niveau_depart, metier };

        const [vocabRes, scenariosRes] = await Promise.all([
          fetch('/api/generate-vocab', { method: 'POST', body: JSON.stringify(payload) }),
          fetch('/api/generate-scenarios', { method: 'POST', body: JSON.stringify(payload) }),
        ]);
        const { vocab } = await vocabRes.json();
        const { scenarios } = await scenariosRes.json();

        const [oldMotsSnap, oldScenariosSnap] = await Promise.all([
          getDocs(collection(db, 'objectifs', objectifId, 'mots')),
          getDocs(collection(db, 'objectifs', objectifId, 'scenarios')),
        ]);
        await Promise.all([
          ...oldMotsSnap.docs.map((d) => deleteDoc(d.ref)),
          ...oldScenariosSnap.docs.map((d) => deleteDoc(d.ref)),
        ]);

        if (vocab?.length) {
          await Promise.all(
            vocab.map((w) =>
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
        }

        if (scenarios?.length) {
          await Promise.all(
            scenarios.map((s) =>
              addDoc(collection(db, 'objectifs', objectifId, 'scenarios'), {
                titre: s.titre,
                contexte: s.contexte,
                complete: false,
                messages: [],
                createdAt: serverTimestamp(),
              })
            )
          );
        }

        setOriginalObjectif({ ...objectif, metier });
        setObjectifMsg('Objectif mis à jour — vocabulaire et scénarios régénérés pour ta nouvelle langue/objectif.');
      } else {
        setOriginalObjectif({ ...objectif, metier });
        setObjectifMsg('Objectif mis à jour.');
      }
    } catch (err) {
      console.error('saveObjectif error:', err);
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-inkSoft">Mon objectif</p>
            <Link href="/onboarding" className="text-xs font-semibold text-coralDark">
              + Nouvel objectif
            </Link>
          </div>

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

          {showRegenConfirm && (
            <div className="border border-coralPale bg-coralPale/40 rounded-2xl p-4 mb-3">
              <p className="text-sm text-coralDark font-semibold mb-1.5">Confirmer le changement</p>
              <p className="text-[13px] text-inkSoft leading-relaxed mb-3">
                Changer la langue, le type d'objectif ou le métier va régénérer le vocabulaire et les
                scénarios. Ta progression actuelle (mots appris, scénarios complétés) sera perdue.
                Continuer ?
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowRegenConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-line bg-white text-sm font-semibold text-inkSoft"
                >
                  Annuler
                </button>
                <button
                  onClick={() => saveObjectif(true)}
                  className="flex-1 py-2.5 rounded-xl bg-coral text-white text-sm font-semibold"
                >
                  Confirmer et régénérer
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleSaveClick}
            disabled={savingObjectif || showRegenConfirm}
            className="w-full py-3.5 rounded-2xl bg-sageDark text-white font-semibold disabled:opacity-50"
          >
            {savingObjectif ? 'Sauvegarde…' : 'Enregistrer les modifications'}
          </button>
          <p className="text-xs text-inkSoft mt-2 leading-relaxed">
            Note : changer la langue, le type d'objectif ou le métier régénère automatiquement le
            vocabulaire et les scénarios (les anciens sont remplacés), après confirmation.
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

      <Link
        href="/dashboard/fiche"
        className="w-full block text-center py-3.5 rounded-2xl bg-sagePale text-sageDark font-semibold mb-4"
      >
        Voir ma fiche récap
      </Link>

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
