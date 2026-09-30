import AIMemory from '../models/AiMemory';
import AiRateLimit from '../models/AiRateLimit';
import { logMongoError } from '../utils/mongoLogger';

/* =========================================================
   TYPES
========================================================= */

export type AIMessageRole =
  | 'user'
  | 'assistant'
  | 'system';

export interface MessagePayload {
  role: AIMessageRole;
  content: string;
  timestamp?: Date;
}

export interface AIMemoryContext {
  guildId: string;
  channelId: string;
  userId: string;
}

/* =========================================================
   LIMITS
========================================================= */

export const AI_MAX_CONTEXT_WORDS = 6000;

export const AI_MAX_MEMORY_MESSAGES = 150;

/** Nombre maximal de messages ajoutés à la mémoire IA par utilisateur et par heure. */
export const AI_MEMORY_MESSAGES_PER_HOUR = 150;
export const AI_MEMORY_WINDOW_MS = 60 * 60 * 1000;

/** Persistent, atomic allowance shared by bot workers and HTTP API. */
export async function consumeAIMemoryAllowance(userId: string, messageCount = 1): Promise<boolean> {
  if (!userId || messageCount <= 0) return true;

  // 1 interaction utilisateur = 1 message consommé.
  const requested = Math.max(1, Math.floor(messageCount));
  if (requested > AI_MEMORY_MESSAGES_PER_HOUR) return false;

  const key = `ai:${userId}`;
  const now = new Date();
  const cutoff = new Date(now.getTime() - AI_MEMORY_WINDOW_MS);

  try {
    let row = await AiRateLimit.findOne({ key }).lean();

    // Première utilisation : création simple, sans pipeline MongoDB.
    if (!row) {
      try {
        await AiRateLimit.create({
          key,
          windowStartedAt: now,
          count: requested,
        });
        return true;
      } catch (error: any) {
        // Une autre requête peut avoir créé la ligne entre-temps.
        if (error?.code !== 11000) throw error;
        row = await AiRateLimit.findOne({ key }).lean();
      }
    }

    if (!row) return false;

    const startedAt = new Date(row.windowStartedAt).getTime();

    // Fenêtre expirée : remise à zéro avec un $set classique.
    if (!Number.isFinite(startedAt) || startedAt <= cutoff.getTime()) {
      const reset = await AiRateLimit.updateOne(
        {
          key,
          windowStartedAt: row.windowStartedAt,
        },
        {
          $set: {
            windowStartedAt: now,
            count: requested,
          },
        },
      );

      if (reset.matchedCount > 0) return true;

      // Une autre requête a gagné la course : on retente avec son compteur.
      row = await AiRateLimit.findOne({ key }).lean();
      if (!row) return false;
    }

    const currentCount = Math.max(0, Number(row.count) || 0);
    if (currentCount + requested > AI_MEMORY_MESSAGES_PER_HOUR) return false;

    // Incrément atomique : deux requêtes simultanées ne peuvent pas dépasser la limite.
    const updated = await AiRateLimit.updateOne(
      {
        key,
        windowStartedAt: row.windowStartedAt,
        count: { $lte: AI_MEMORY_MESSAGES_PER_HOUR - requested },
      },
      { $inc: { count: requested } },
    );

    return updated.modifiedCount > 0;
  } catch (error) {
    logMongoError(error, { operation: 'ai-rate-limit', userId });
    return false;
  }
}

export async function getAIMemoryUsage(userId: string): Promise<{ used: number; limit: number; remaining: number; resetAt: Date | null }> {
  const limit = AI_MEMORY_MESSAGES_PER_HOUR;
  if (!userId) return { used: 0, limit, remaining: limit, resetAt: null };
  try {
    const row = await AiRateLimit.findOne({ key: `ai:${userId}` }).lean();
    if (!row || Date.now() - new Date(row.windowStartedAt).getTime() >= AI_MEMORY_WINDOW_MS) {
      return { used: 0, limit, remaining: limit, resetAt: null };
    }
    const used = Math.min(limit, Math.max(0, Number(row.count) || 0));
    return { used, limit, remaining: Math.max(0, limit - used), resetAt: new Date(new Date(row.windowStartedAt).getTime() + AI_MEMORY_WINDOW_MS) };
  } catch (error) {
    logMongoError(error, { operation: 'ai-rate-limit-usage', userId });
    return { used: 0, limit, remaining: limit, resetAt: null };
  }
}

export const AI_MAX_MESSAGE_LENGTH = 4000;

/* =========================================================
   WORD COUNT
========================================================= */

export function getWordCount(
  text: string,
): number {
  if (
    typeof text !== 'string' ||
    !text.trim()
  ) {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

export function getMessagesWordCount(
  messages: MessagePayload[],
): number {
  return messages.reduce(
    (total, message) =>
      total +
      getWordCount(
        message.content,
      ),
    0,
  );
}

/*
 * Ancienne API conservée pour éviter
 * de casser les commandes existantes.
 */
export function getWordCountFromInput(
  input:
    | string
    | MessagePayload[],
): number {
  if (typeof input === 'string') {
    return getWordCount(input);
  }

  return getMessagesWordCount(
    input,
  );
}

/* =========================================================
   NORMALIZATION
========================================================= */

export function normalizeMessage(
  message: MessagePayload,
): MessagePayload | null {
  if (!message) {
    return null;
  }

  if (
    message.role !== 'user' &&
    message.role !== 'assistant' &&
    message.role !== 'system'
  ) {
    return null;
  }

  const content =
    String(
      message.content ?? '',
    ).trim();

  if (!content) {
    return null;
  }

  return {
    role: message.role,

    content:
      content.substring(
        0,
        AI_MAX_MESSAGE_LENGTH,
      ),

    timestamp:
      message.timestamp ??
      new Date(),
  };
}

/* =========================================================
   PRUNE
========================================================= */

export function pruneMessagesToLimit(
  messages: MessagePayload[],
  maxWords = AI_MAX_CONTEXT_WORDS,
): MessagePayload[] {
  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return [];
  }

  const result: MessagePayload[] = [];

  let wordCount = 0;

  /*
   * On part de la fin afin de garder
   * le contexte le plus récent.
   */
  for (
    let index =
      messages.length - 1;
    index >= 0;
    index--
  ) {
    const message =
      normalizeMessage(
        messages[index],
      );

    if (!message) {
      continue;
    }

    const words =
      getWordCount(
        message.content,
      );

    /*
     * Un message individuel trop gros
     * n'est pas envoyé.
     */
    if (words > maxWords) {
      continue;
    }

    if (
      wordCount + words >
      maxWords
    ) {
      break;
    }

    result.unshift(message);

    wordCount += words;
  }

  return result;
}

/* =========================================================
   CONTEXT VALIDATION
========================================================= */

function isValidContext(
  context: AIMemoryContext,
): boolean {
  return Boolean(
    context &&
    context.guildId?.trim() &&
    context.channelId?.trim() &&
    context.userId?.trim(),
  );
}

/* =========================================================
   LOAD MEMORY
========================================================= */

export async function getAIMemory(
  context: AIMemoryContext,
): Promise<MessagePayload[]> {
  if (!isValidContext(context)) {
    return [];
  }

  try {
    const memory =
      await AIMemory.findOne({
        guildId:
          context.guildId,

        channelId:
          context.channelId,

        userId:
          context.userId,
      }).lean();

    if (!memory) {
      return [];
    }

    const messages =
      Array.isArray(
        memory.messages,
      )
        ? memory.messages.map(
            (message) => ({
              role:
                message.role,

              content:
                message.content,

              timestamp:
                message.timestamp,
            }),
          )
        : [];

    return pruneMessagesToLimit(
      messages,
      AI_MAX_CONTEXT_WORDS,
    );
  } catch (error) {
    console.error(
      '[AI Service] Erreur récupération mémoire:',
      error,
    );

    return [];
  }
}

/* =========================================================
   SAVE ONE MESSAGE
========================================================= */

export async function saveAIMemoryMessage(
  context: AIMemoryContext,
  message: MessagePayload,
): Promise<void> {
  if (!isValidContext(context)) {
    throw new Error(
      'Contexte IA invalide.',
    );
  }

  const normalized =
    normalizeMessage(message);

  if (!normalized) {
    return;
  }

  await AIMemory.findOneAndUpdate(
    {
      guildId:
        context.guildId,

      channelId:
        context.channelId,

      userId:
        context.userId,
    },

    {
      $push: {
        messages: {
          role:
            normalized.role,

          content:
            normalized.content,

          timestamp:
            normalized.timestamp,
        },
      },
    },

    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  await trimAIMemory(context);
}

/* =========================================================
   SAVE MULTIPLE MESSAGES
========================================================= */

export async function saveAIMemoryMessages(
  context: AIMemoryContext,
  messages: MessagePayload[],
): Promise<void> {
  if (!isValidContext(context)) {
    throw new Error(
      'Contexte IA invalide.',
    );
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return;
  }

  const normalized =
    messages
      .map(normalizeMessage)
      .filter(
        (
          message,
        ): message is MessagePayload =>
          message !== null,
      );

  if (!normalized.length) {
    return;
  }

  await AIMemory.findOneAndUpdate(
    {
      guildId:
        context.guildId,

      channelId:
        context.channelId,

      userId:
        context.userId,
    },

    {
      $push: {
        messages: {
          $each: normalized,
        },
      },
    },

    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  await trimAIMemory(context);
}

/* =========================================================
   TRIM DATABASE MEMORY
========================================================= */

export async function trimAIMemory(
  context: AIMemoryContext,
): Promise<void> {
  if (!isValidContext(context)) {
    return;
  }

  try {
    const memory =
      await AIMemory.findOne({
        guildId:
          context.guildId,

        channelId:
          context.channelId,

        userId:
          context.userId,
      });

    if (!memory) {
      return;
    }

    if (
      memory.messages.length <=
      AI_MAX_MEMORY_MESSAGES
    ) {
      return;
    }

    memory.messages =
      memory.messages.slice(
        -AI_MAX_MEMORY_MESSAGES,
      );

    await memory.save();
  } catch (error) {
    console.error(
      '[AI Service] Erreur nettoyage mémoire:',
      error,
    );
  }
}

/* =========================================================
   CLEAR MEMORY
========================================================= */

export async function clearAIMemory(
  context: AIMemoryContext,
): Promise<boolean> {
  if (!isValidContext(context)) {
    return false;
  }

  try {
    const result =
      await AIMemory.deleteOne({
        guildId:
          context.guildId,

        channelId:
          context.channelId,

        userId:
          context.userId,
      });

    return (
      result.deletedCount > 0
    );
  } catch (error) {
    console.error(
      '[AI Service] Erreur suppression mémoire:',
      error,
    );

    return false;
  }
}

/* =========================================================
   BUILD CONTEXT
========================================================= */

export async function buildAIContext(
  context: AIMemoryContext,
  systemPrompt?: string,
): Promise<MessagePayload[]> {
  const memory =
    await getAIMemory(context);

  const messages: MessagePayload[] =
    [];

  /*
   * Le system prompt reste toujours
   * en première position.
   */
  if (systemPrompt?.trim()) {
    messages.push({
      role: 'system',
      content:
        systemPrompt.trim(),
      timestamp: new Date(),
    });
  }

  messages.push(...memory);

  /*
   * Attention :
   * le system prompt compte également
   * dans la limite finale.
   */
  return pruneMessagesToLimit(
    messages,
    AI_MAX_CONTEXT_WORDS,
  );
}

/* =========================================================
   EXPORT
========================================================= */

export default {
  getWordCount,

  getMessagesWordCount,

  getWordCountFromInput,

  normalizeMessage,

  pruneMessagesToLimit,

  getAIMemory,

  saveAIMemoryMessage,

  saveAIMemoryMessages,

  trimAIMemory,

  clearAIMemory,

  buildAIContext,
};