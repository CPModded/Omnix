import 'dotenv/config';

const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const MODEL =
  process.env.OPENROUTER_MODEL ??
  'nvidia/nemotron-3-ultra-550b-a55b:free';

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

export type OpenRouterTextContent = string;

export interface OpenRouterContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | OpenRouterTextContent
    | OpenRouterContentPart[];
}

interface OpenRouterResponse {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | OpenRouterContentPart[] | null;
      refusal?: string | null;
    };
  }>;

  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

function extractContent(
  content: string | OpenRouterContentPart[] | null | undefined,
): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((part) => part?.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
}

function getErrorMessage(
  data: OpenRouterResponse,
  status: number,
): string {
  return (
    data.error?.message?.trim() ||
    `HTTP ${status}`
  );
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function askOpenRouter(
  input: string | OpenRouterMessage[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  },
): Promise<string> {
  const apiKey =
    process.env.OPENROUTER_API_KEY ??
    process.env.OPENROUTER_KEY;

  if (!apiKey) {
    throw new Error(
      '[OpenRouter] OPENROUTER_API_KEY est introuvable.',
    );
  }

  const baseMessages: OpenRouterMessage[] =
    Array.isArray(input)
      ? [...input]
      : [
          {
            role: 'user',
            content: input,
          },
        ];

  if (options?.systemPrompt?.trim()) {
    baseMessages.unshift({
      role: 'system',
      content: options.systemPrompt.trim(),
    });
  }

  let lastError = '[OpenRouter] Échec inconnu.';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.CLIENT_URL ?? 'https://omnix.bot',
          'X-Title': 'OMNIX',
        },
        body: JSON.stringify({
          model: options?.model ?? MODEL,
          messages: baseMessages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1200,
        }),
        signal: controller.signal,
      });

      let data: OpenRouterResponse;
      try {
        data = (await response.json()) as OpenRouterResponse;
      } catch {
        throw new Error(
          `[OpenRouter] Réponse JSON invalide (HTTP ${response.status}).`,
        );
      }

      if (!response.ok) {
        const providerMessage = getErrorMessage(data, response.status);
        lastError =
          `[OpenRouter] ${response.status} - ${providerMessage}`;

        if (attempt < MAX_RETRIES && shouldRetry(response.status)) {
          await wait(700 * attempt);
          continue;
        }

        throw new Error(lastError);
      }

      const choice = data.choices?.[0];
      const content = extractContent(choice?.message?.content);

      if (content) {
        return content;
      }

      const refusal = choice?.message?.refusal?.trim();
      if (refusal) {
        return refusal;
      }

      const finishReason = choice?.finish_reason ?? 'inconnu';
      lastError =
        `[OpenRouter] Le modèle n'a retourné aucun contenu exploitable (finish_reason: ${finishReason}).`;

      // Certains modèles/providers peuvent répondre vide ponctuellement.
      // Une seconde tentative évite les faux échecs sans changer de modèle.
      if (attempt < MAX_RETRIES) {
        await wait(500 * attempt);
        continue;
      }

      throw new Error(lastError);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError =
          `[OpenRouter] Délai d'attente dépassé après ${REQUEST_TIMEOUT_MS / 1000}s.`;
      } else if (error instanceof Error) {
        lastError = error.message;
      } else {
        lastError = '[OpenRouter] Erreur inconnue.';
      }

      const retryable =
        lastError.includes('408') ||
        lastError.includes('429') ||
        lastError.includes('HTTP 5') ||
        lastError.includes('aucun contenu exploitable') ||
        lastError.includes('Délai d\'attente');

      if (attempt < MAX_RETRIES && retryable) {
        await wait(700 * attempt);
        continue;
      }

      throw new Error(lastError);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

export default askOpenRouter;
