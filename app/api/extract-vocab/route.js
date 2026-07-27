import { NextResponse } from 'next/server';
import { callGroq, parseJsonResponse } from '@/lib/groq';

export async function POST(request) {
  try {
    const { langue, niveau, messages } = await request.json();

    const transcript = (messages || [])
      .map((m) => (m.role === 'assistant' ? m.reply : m.content))
      .filter(Boolean)
      .join('\n');

    if (!transcript.trim()) {
      return NextResponse.json({ words: [] });
    }

    const system =
      "Tu extrais du vocabulaire utile d'une conversation d'apprentissage de langue. Réponds UNIQUEMENT avec un JSON valide, sans texte autour, sans balises markdown.";

    const user = `Voici une conversation en ${langue} (niveau ${niveau}) :
"""
${transcript}
"""
Extrais 3 mots ou expressions utiles de cette conversation (pas déjà évidents pour un débutant), qui mériteraient d'être ajoutés au vocabulaire de l'apprenant. Format JSON exact :
[{"terme": "...", "traduction": "...", "contexte": "courte phrase d'exemple ou explication d'usage"}]`;

    const text = await callGroq(system, [{ role: 'user', content: user }]);
    const words = parseJsonResponse(text);

    return NextResponse.json({ words });
  } catch (error) {
    console.error('extract-vocab error:', error);
    return NextResponse.json({ words: [] });
  }
}
