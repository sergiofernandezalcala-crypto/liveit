export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });

  try {
    const { receivedMessage, relation, goal, userStyle, history } = req.body;

    const prompt = `Eres un asistente que ayuda a responder mensajes difíciles o delicados.
El usuario ha recibido un mensaje y necesita ayuda para responder bien.
Genera 3 respuestas posibles, cada una con un tono distinto pero todas naturales, humanas y adecuadas.

Reglas:
- Escribe como si fuera el propio usuario, no como una IA
- Sin florituras ni formalidades
- Respuestas que parezcan escritas desde el móvil, en el momento
- NUNCA: consejos de relación, juicios, frases de terapeuta, "entiendo cómo te sientes"
- Tono: cálido y humano, ligeramente mejor que el usuario sin pasarse
${userStyle ? `- Estilo del usuario: ${userStyle}` : ''}
${history && history.length > 0 ? `- Contexto previo: ${history.map(h => `con ${h.relation}: "${h.snippet}"`).join(', ')}` : ''}

Mensaje recibido: "${receivedMessage}"
Relación: ${relation}
Objetivo: ${goal}

Responde ÚNICAMENTE con este JSON exacto, sin markdown, sin explicaciones:
{
  "reply1": "...",
  "reply2": "...",
  "reply3": "...",
  "tone1": "...",
  "tone2": "...",
  "tone3": "...",
  "situation_read": "..."
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 800
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const replies = JSON.parse(clean);

    return res.status(200).json({ replies });

  } catch (err) {
    return res.status(502).json({ error: 'Error', detail: err.message });
  }
}
