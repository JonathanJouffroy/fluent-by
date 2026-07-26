import { NextResponse } from 'next/server';
import { callGroq, parseJsonResponse } from '@/lib/groq';

export async function POST(request) {
  try {
    const { langue, niveau, description } = await request.json();

    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Description manquante.' }, { status: 400 });
    }

    const system =
      "Tu génères un scénario de conversation pour une app d'apprentissage de langue. Réponds UNIQUEMENT avec un JSON valide, sans texte autour, sans balises markdown.";

    const user = `Un apprenant de ${langue} (niveau ${niveau}) décrit une situation qu'il veut préparer : "${description.trim()}".
Transforme cette description en UN scénario de conversation concret et réaliste, avec un titre court et une phrase de contexte qui campe la situation (qui est l'interlocuteur, où, pourquoi). Reste fidèle à ce que l'utilisateur a décrit, ne généralise pas.
Format JSON exact :
{"titre": "titre court du scénario", "contexte": "une phrase décrivant la situation"}`;

    const text = await callGroq(system, [{ role: 'user', content: user }]);
    const scenario = parseJsonResponse(text);

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('generate-custom-scenario error:', error);
    return NextResponse.json({ error: 'Génération du scénario impossible.' }, { status: 500 });
  }
}
