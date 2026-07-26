import { NextResponse } from 'next/server';
import { callGroq, parseJsonResponse } from '@/lib/groq';

export async function POST(request) {
  try {
    const { langue, niveau, metier, scenarioTitre, scenarioContexte, history, userText, attachCorrection } =
      await request.json();

    const system = `Tu es un partenaire de conversation qui aide un utilisateur francophone à pratiquer le ${langue} pour l'objectif suivant : "${scenarioTitre}" (${scenarioContexte}).${
      metier ? ` L'utilisateur travaille comme ${metier}, adapte le vocabulaire et la situation à ce métier.` : ''
    } Niveau de l'utilisateur : ${niveau}.
Reste dans le personnage du scénario et réponds UNIQUEMENT en ${langue}, à un niveau adapté au niveau indiqué.
Après CHAQUE message de l'utilisateur, analyse son texte en ${langue} avec attention : grammaire, conjugaison, genre, vocabulaire, orthographe. Si tu détectes la moindre erreur, donne une correction en français, claire et précise (montre la formulation correcte), sur un ton encourageant et jamais condescendant. Ne mets une chaîne vide que si la phrase est réellement sans aucune erreur.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, au format exact :
{"reply": "ta réplique en ${langue}", "correction": "correction en français ou chaîne vide"}`;

    const messages = [
      ...(history || []).map((m) => ({
        role: m.role,
        content: m.role === 'assistant' ? m.reply : m.content,
      })),
      { role: 'user', content: userText },
    ];

    const text = await callGroq(system, messages);
    const parsed = parseJsonResponse(text);

    return NextResponse.json({
      reply: parsed.reply,
      correction: attachCorrection ? parsed.correction || '' : '',
    });
  } catch (error) {
    console.error('chat error:', error);
    return NextResponse.json({ error: "La conversation n'a pas pu se charger." }, { status: 500 });
  }
}
