// Intervalles en jours selon le niveau de maîtrise (index = niveau_maitrise)
export const INTERVALS = [1, 2, 4, 7, 14, 30, 60, 120];

/**
 * Calcule le prochain niveau de maîtrise et la prochaine date de révision.
 * @param {number} currentLevel - niveau_maitrise actuel (0 si jamais révisé)
 * @param {boolean} known - true si l'utilisateur a indiqué "je connais déjà"
 */
export function computeNextReview(currentLevel, known) {
  const level = known
    ? Math.min(currentLevel + 1, INTERVALS.length - 1)
    : Math.max(currentLevel - 1, 0);

  const intervalDays = INTERVALS[level];
  const next = new Date();
  next.setDate(next.getDate() + intervalDays);

  const mastery = level >= 3 ? 'appris' : 'a_revoir';

  return {
    niveau_maitrise: level,
    prochaine_revision: next.toISOString().slice(0, 10),
    mastery,
  };
}

/** Un mot (document Firestore) est dû s'il n'a jamais été révisé, ou si sa date de révision est passée. */
export function isDue(mot) {
  if (!mot?.prochaine_revision) return true;
  return new Date(mot.prochaine_revision) <= new Date();
}
