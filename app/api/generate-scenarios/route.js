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

    const user = `Génère 4 scénarios de conversation courts en lien avec l'objectif ${contexte} pour un apprenant de ${langue} niveau ${niveau}. ${
      metier
        ? `Les scénarios doivent représenter des situations réelles et concrètes du métier de ${metier} (ex : échange avec un patient/collègue/client typique de ce métier), pas des situations professionnelles génériques.`
        : ''
    } Format JSON exact :
[{"titre": "titre court du scénario", "contexte": "une phrase décrivant la situation"}]`;

    const text = await callGroq(system, [{ role: 'user', content: user }]);
    const scenarios = parseJsonResponse(text);

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error('generate-scenarios error:', error);
    return NextResponse.json({ error: 'Génération des scénarios impossible.' }, { status: 500 });
  }
}
