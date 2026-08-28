export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

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

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Missing messages'
      });
    }

    // ── CONVERSACIÓN ──

    const conversation = messages
      .map(function(m) {

        const who =
          m.role === 'mine'
            ? 'USUARIO'
            : 'OTRA PERSONA';

        return who + ': ' + m.text;

      })
      .join('\n');

    // ── INSTRUCCIONES ──

    const instructions =
      'Eres eablo, un asistente que ayuda al usuario ' +
      'a responder mensajes difíciles o delicados.\n\n' +

      'Tu trabajo es proponer respuestas que el usuario ' +
      'pueda enviar directamente.\n\n' +

      'NO eres terapeuta.\n' +
      'NO das consejos.\n' +
      'NO juzgas.\n' +
      'NO explicas qué debería hacer el usuario.\n\n' +

      'RELACIÓN:\n' +
      relation + '\n\n' +

      'OBJETIVO:\n' +
      goal + '\n\n' +

      'CONVERSACIÓN COMPLETA:\n\n' +
      conversation + '\n\n' +

      'REGLAS:\n\n' +

      '- Escribe como si las respuestas las hubiera escrito el propio usuario.\n' +
      '- Deben sonar naturales y humanas.\n' +
      '- Deben parecer escritas desde el móvil.\n' +
      '- Sin florituras.\n' +
      '- Sin formalidades.\n' +
      '- Sin lenguaje de terapeuta.\n' +
      '- Sin consejos de relación.\n' +
      '- No uses frases artificiales como "entiendo cómo te sientes".\n' +
      '- No hagas respuestas excesivamente perfectas.\n' +
      '- No hagas las tres respuestas casi iguales.\n' +
      '- Las tres deben poder enviarse realmente.\n' +
      '- Ten en cuenta toda la conversación anterior.\n' +
      '- No trates el último mensaje como una conversación aislada.\n' +
      '- No repitas simplemente las palabras de la otra persona.\n' +
      '- Haz avanzar la conversación.\n' +
      '- Respeta el objetivo indicado.\n' +
      '- No inventes hechos.\n\n' +

      'Genera exactamente tres respuestas.\n\n' +

      'reply1: La opción más natural y equilibrada.\n' +
      'reply2: Una opción algo más cercana o cálida.\n' +
      'reply3: Una opción algo más directa o firme.\n\n' +

      'tone1, tone2 y tone3: etiquetas muy cortas como "Natural", "Cercana" o "Directa".\n\n' +

      'situation_read: descripción interna muy breve de lo que está ocurriendo. NO es un consejo.\n\n' +

      (userStyle
        ? 'ESTILO DEL USUARIO:\n' + userStyle + '\n\n'
        : '') +

      'Devuelve únicamente el objeto JSON solicitado.';

    // ── INTERACTIONS API ──

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },

        body: JSON.stringify({

          model: 'gemini-3.6-flash',

          system_instruction: instructions,

          input: conversation,

          generation_config: {
            max_output_tokens: 2000
          },

          response_format: {

            type: 'text',

            mime_type: 'application/json',

            schema: {

              type: 'object',

              properties: {

                reply1: {
                  type: 'string'
                },

                reply2: {
                  type: 'string'
                },

                reply3: {
                  type: 'string'
                },

                tone1: {
                  type: 'string'
                },

                tone2: {
                  type: 'string'
                },

                tone3: {
                  type: 'string'
                },

                situation_read: {
                  type: 'string'
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

    // ── RESPUESTA DE GEMINI ──

    const data = await response.json();

    if (!response.ok) {

      console.error(
        'Gemini error:',
        data
      );

      return res.status(response.status).json({
        error: 'Gemini error',
        detail: data
      });
    }

    // ── EXTRAER TEXTO ──

    const steps = Array.isArray(data.steps)
      ? data.steps
      : [];

    const modelOutput = steps
      .slice()
      .reverse()
      .find(function(step) {
        return step.type === 'model_output';
      });

    const text =
      modelOutput &&
      Array.isArray(modelOutput.content)
        ? (
            modelOutput.content.find(function(item) {
              return item.type === 'text';
            }) || {}
          ).text || ''
        : '';

    if (!text) {

      console.error(
        'Empty Gemini response:',
        data
      );

      return res.status(500).json({
        error: 'Empty response from Gemini'
      });
    }

    // ── PARSEAR JSON ──

    let replies;

    try {

      replies = JSON.parse(text);

    } catch (err) {

      console.error(
        'Invalid Gemini JSON:',
        text
      );

      return res.status(502).json({
        error: 'Invalid JSON returned by Gemini',
        raw: text
      });
    }

    // ── RESPUESTA AL FRONTEND ──

    return res.status(200).json({
      replies: replies
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
