export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { system, messages, temperature, max_tokens } = req.body;

    const tool = {
      name: "respond_to_user",
      description: "Respond to the user in character",
      input_schema: {
        type: "object",
        properties: {
          line:               { type: "string" },
          subtitle_es:        { type: "string" },
          char_name:          { type: "string" },
          char_role:          { type: "string" },
          natural_model:      { type: "string" },
          expects_user_input: { type: "boolean" },
          situation_ended:    { type: "boolean" },
          mood:               { type: "string" }
        },
        required: ["line","subtitle_es","char_name","char_role","natural_model","expects_user_input","situation_ended","mood"]
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
        model: 'claude-haiku-4-5',
        system,
        messages,
        tools: [tool],
        tool_choice: { type: "any" },
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 400
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    // Extract structured input from tool_use block
    const toolBlock = data.content.find(b => b.type === 'tool_use');
    if (!toolBlock) return res.status(500).json({ error: 'No tool_use block in response' });

    // Return in same format frontend expects
    return res.status(200).json({
      content: [{ type: 'tool_result', input: toolBlock.input }]
    });

  } catch (err) {
    return res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}
