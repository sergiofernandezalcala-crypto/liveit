export default async function handler(req, res) {

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Gemini API key not configured'
    });
  }

  try {

    const {
      relation,
      goal,
      messages,
      userStyle
    } = req.body;

    // ── VALIDACIÓN ──

    if (!relation) {
      return res.status(400).json({
        error: 'Missing relation'
      });
    }

    if (!goal) {
      return res.status(400).json({
        error: 'Missing goal'
      });
    }

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return res.status(400).json({
        error: 'Missing messages'
      });
    }

    // ── CONVERSACIÓN ──

    const conversation =
      messages
        .map(m => {

          const who =
            m.role === 'mine'
              ? 'USUARIO'
              : 'OTRA PERSONA';

          return `${who}: ${m.text}`;

        })
        .join('\n');

    // ── PROMPT ──

    const prompt = `
Eres eablo, un asistente que ayuda al usuario
a responder mensajes difíciles o delicados.

Tu trabajo es proponer respuestas que el usuario
pueda enviar directamente.

NO eres terapeuta.
NO das consejos.
NO juzgas.
NO explicas qué debería hacer el usuario.

RELACIÓN:
${relation}

OBJETIVO:
${goal}

CONVERSACIÓN COMPLETA:

${conversation}

REGLAS:

- Escribe como si las respuestas las hubiera escrito
  el propio usuario.
- Deben sonar naturales y humanas.
- Deben parecer escritas desde el móvil.
- Sin florituras.
- Sin formalidades.
- Sin lenguaje de terapeuta.
- Sin consejos de relación.
- Sin frases tipo "entiendo cómo te sientes".
- No hagas una respuesta excesivamente perfecta.
- No hagas las tres respuestas casi iguales.
- Las tres deben poder enviarse realmente.
- Ten en cuenta toda la conversación anterior.
- No trates el último mensaje como si fuera una
  conversación aislada.
- No repitas simplemente las palabras de la otra persona.
- Haz avanzar la conversación.
- Respeta el objetivo indicado.
- No inventes hechos que no aparecen en la conversación.

Genera exactamente tres respuestas:

reply1:
La opción más natural y equilibrada.

reply2:
Una opción algo más cercana o cálida.

reply3:
Una opción algo más directa o firme.

Los campos tone1, tone2 y tone3 deben ser etiquetas
MUY cortas, por ejemplo:
"Natural"
"Cercana"
"Directa"

situation_read debe ser una descripción interna
muy breve de lo que está ocurriendo en la conversación.
NO debe ser un consejo.

${userStyle
  ? `ESTILO DEL USUARIO:
${userStyle}`
  : ''}
`;

    // ── GEMINI ──

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {

            maxOutputTokens: 1000,

            response_mime_type:
              'application/json',

            response_schema: {

              type: 'OBJECT',

              properties: {

                reply1: {
                  type: 'STRING'
                },

                reply2: {
                  type: 'STRING'
                },

                reply3: {
                  type: 'STRING'
                },

                tone1: {
                  type: 'STRING'
                },

                tone2: {
                  type: 'STRING'
                },

                tone3: {
                  type: 'STRING'
                },

                situation_read: {
                  type: 'STRING'
                }

              },

              required: [
                'reply1',
                'reply2',
                'reply3',
                'tone1',
                'tone2',
                'tone3',
                'situation_read'
              ]

            }

          }

        })
      }
    );

    // ── RESPUESTA GOOGLE ──

    const data =
      await response.json();

    if (!response.ok) {

      console.error(
        'Gemini error:',
        data
      );

      return res.status(
        response.status
      ).json({
        error: 'Gemini error',
        detail: data
      });
    }

    const text =
      data
        .candidates?.[0]
        ?.content
        ?.parts?.[0]
        ?.text || '';

    if (!text) {

      console.error(
        'Empty Gemini response:',
        data
      );

      return res.status(500).json({
        error:
          'Empty response from Gemini'
      });
    }

    // ── PARSE JSON ──

    let replies;

    try {

      replies = JSON.parse(text);

    } catch (err) {

      console.error(
        'Invalid Gemini JSON:',
        text
      );

      return res.status(502).json({
        error:
          'Invalid JSON returned by Gemini'
      });
    }

    // ── RESPUESTA AL FRONTEND ──

    return res.status(200).json({
      replies
    });

  } catch (err) {

    console.error(
      'Server error:',
      err
    );

    return res.status(502).json({
      error: 'Error',
      detail: err.message
    });
  }
}
