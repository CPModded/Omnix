import 'dotenv/config';

const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const API_KEY =
  process.env.OPENROUTER_API_KEY ??
  process.env.OPENROUTER_KEY;

const MODEL =
  process.env.OPENROUTER_MODEL ??
  'openai/gpt-4o-mini';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;

  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

export async function askOpenRouter(
  input: string | OpenRouterMessage[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      '[OpenRouter] OPENROUTER_API_KEY est introuvable.'
    );
  }

  const messages: OpenRouterMessage[] =
    Array.isArray(input)
      ? input
      : [
          {
            role: 'user',
            content: input,
          },
        ];

  if (options?.systemPrompt) {
    messages.unshift({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  const response = await fetch(
    OPENROUTER_URL,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',

        'HTTP-Referer':
          process.env.CLIENT_URL ??
          'https://omnix.bot',

        'X-Title': 'OMNIX',
      },

      body: JSON.stringify({
        model: MODEL,
        messages,

        temperature:
          options?.temperature ?? 0.7,

        max_tokens:
          options?.maxTokens ?? 1000,
      }),
    }
  );

  const data =
    (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    const errorMessage =
      data.error?.message ??
      `HTTP ${response.status}`;

    throw new Error(
      `[OpenRouter] ${response.status} - ${errorMessage}`
    );
  }

  const content =
    data.choices?.[0]?.message?.content;

  if (
    typeof content !== 'string' ||
    !content.trim()
  ) {
    throw new Error(
      '[OpenRouter] Réponse vide du modèle.'
    );
  }

  return content.trim();
}

export default askOpenRouter;