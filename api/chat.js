export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { receivedMessage, relation, goal, userStyle, history } = req.body;

    const systemPrompt = `Eres un asistente que ayuda a responder mensajes difíciles o delicados.
El usuario ha recibido un mensaje y necesita ayuda para responder bien.
Tu trabajo es generar 3 respuestas posibles, cada una con un tono distinto pero todas naturales, humanas y adecuadas a la situación.

Reglas:
- Escribe como si fuera el propio usuario quien escribe, no como una IA
- Sin florituras, sin formalidades innecesarias
- Adapta el tono a la relación y al objetivo del usuario
- Las respuestas deben parecer escritas desde el móvil, en el momento
- Usa el estilo del usuario si está disponible
- Ten en cuenta el historial de conversaciones anteriores si existe`;

    const userPrompt = `Mensaje recibido: "${receivedMessage}"
Relación: ${relation}
Quiero conseguir: ${goal}
${userStyle ? `Mi forma de escribir: ${userStyle}` : ''}
${history && history.length > 0 ? `\nContexto de conversaciones anteriores:\n${history.map(h => `- Con ${h.relation}: "${h.snippet}"`).join('\n')}` : ''}

Genera 3 respuestas posibles.`;

    const tool = {
      name: "generate_replies",
      description: "Generate 3 possible replies for the user",
      input_schema: {
        type: "object",
        properties: {
          reply1: { type: "string", description: "Primera opción de respuesta" },
          reply2: { type: "string", description: "Segunda opción de respuesta" },
          reply3: { type: "string", description: "Tercera opción de respuesta" },
          tone1:  { type: "string", description: "Descripción corta del tono (ej: directo, con humor, cariñoso)" },
          tone2:  { type: "string" },
          tone3:  { type: "string" },
          situation_read: { type: "string", description: "Lectura breve de la situación (1 frase)" }
        },
        required: ["reply1", "reply2", "reply3", "tone1", "tone2", "tone3", "situation_read"]
      }
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [tool],
        tool_choice: { type: "any" },
        temperature: 0.8,
        max_tokens: 800
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    const toolBlock = data.content.find(b => b.type === 'tool_use');
    if (!toolBlock) return res.status(500).json({ error: 'No tool_use block in response' });

    return res.status(200).json({ replies: toolBlock.input });

  } catch (err) {
    return res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}
