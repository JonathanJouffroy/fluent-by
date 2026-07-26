import { NextResponse } from 'next/server';
import { callGroq, parseJsonResponse } from '@/lib/groq';

const LABELS = { voyage: 'Voyage', travail: 'Travail', personnel: 'Personnel' };

export async function POST(request) {
  try {
    const { langue, type, niveau, metier } = await request.json();

    const contexte = metier
      ? `"${LABELS[type]}" — métier/secteur précis : ${metier}`
      : `"${LABELS[type]}"`;

    const system =
      "Tu génères du contenu pour une app d'apprentissage de langue orientée objectifs. Réponds UNIQUEMENT avec un JSON valide, sans texte autour, sans balises markdown.";

    const user = `Génère 8 mots ou expressions en ${langue}, utiles pour l'objectif ${contexte} (niveau ${niveau}). ${
      metier
        ? `Le vocabulaire doit être spécifique au métier de ${metier} (termes techniques du quotidien de ce métier, pas du vocabulaire professionnel générique).`
        : ''
    } Format JSON exact :
[{"terme": "...", "traduction": "...", "contexte": "courte phrase d'exemple ou explication d'usage"}]`;

    const text = await callGroq(system, [{ role: 'user', content: user }]);
    const vocab = parseJsonResponse(text);

    return NextResponse.json({ vocab });
  } catch (error) {
    console.error('generate-vocab error:', error);
    return NextResponse.json({ error: 'Génération du vocabulaire impossible.' }, { status: 500 });
  }
}
