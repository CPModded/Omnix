const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const MODEL =
  'nvidia/nemotron-3-ultra-550b-a55b:free';

export async function askOpenRouter(
  prompt: string
): Promise<string> {

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY est manquante dans les variables d’environnement.'
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      model: MODEL,

      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `OpenRouter ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content ??
    'Aucune réponse reçue.'
  );
}