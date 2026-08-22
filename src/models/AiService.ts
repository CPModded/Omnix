// src/services/aiService.ts

import AIMemory from '../models/AiMemory.ts';

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
   CONFIGURATION
========================================================= */

/*
 * Nombre maximum de mots conservés dans le contexte IA.
 *
 * Cela limite la quantité de mémoire envoyée au modèle.
 */
export const AI_MAX_CONTEXT_WORDS = 500;

/*
 * Nombre maximum de messages conservés en base.
 *
 * Le contexte envoyé au modèle peut être inférieur
 * à cette limite.
 */
export const AI_MAX_MEMORY_MESSAGES = 50;

/*
 * Taille maximale d'un message.
 *
 * Évite qu'un utilisateur puisse stocker un message
 * gigantesque dans la mémoire IA.
 */
export const AI_MAX_MESSAGE_LENGTH = 4000;

/* =========================================================
   WORD COUNT
========================================================= */

/**
 * Compte les mots d'un texte.
 */
export function getWordCount(
  text: string,
): number {
  if (!text || !text.trim()) {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/**
 * Compte les mots d'une liste de messages.
 */
export function getMessagesWordCount(
  messages: MessagePayload[],
): number {
  return messages.reduce(
    (total, message) =>
      total +
      getWordCount(message.content),
    0,
  );
}

/**
 * Compatibilité avec l'ancienne fonction.
 */
export function getWordCountFromInput(
  textOrMessages:
    | string
    | MessagePayload[],
): number {
  if (typeof textOrMessages === 'string') {
    return getWordCount(
      textOrMessages,
    );
  }

  return getMessagesWordCount(
    textOrMessages,
  );
}

/* =========================================================
   MESSAGE NORMALIZATION
========================================================= */

/**
 * Nettoie et normalise un message avant
 * son stockage ou son utilisation.
 */
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
      content.slice(
        0,
        AI_MAX_MESSAGE_LENGTH,
      ),

    ...(message.timestamp
      ? {
          timestamp:
            message.timestamp,
        }
      : {}),
  };
}

/* =========================================================
   PRUNE CONTEXT
========================================================= */

/**
 * Conserve les messages les plus récents
 * sans dépasser la limite de mots.
 *
 * On travaille de la fin vers le début
 * afin de conserver le contexte le plus récent.
 */
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

  let currentWords = 0;

  for (
    let i = messages.length - 1;
    i >= 0;
    i--
  ) {
    const message =
      normalizeMessage(
        messages[i],
      );

    if (!message) {
      continue;
    }

    const words =
      getWordCount(
        message.content,
      );

    /*
     * Si le message seul dépasse la limite,
     * on ne l'ajoute pas.
     */
    if (
      currentWords + words >
      maxWords
    ) {
      continue;
    }

    currentWords += words;

    result.unshift(
      message,
    );
  }

  return result;
}

/* =========================================================
   MEMORY CONTEXT
========================================================= */

/**
 * Valide l'identité de la mémoire.
 */
function validateMemoryContext(
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

/**
 * Récupère la mémoire IA d'un utilisateur
 * dans un salon et un serveur précis.
 */
export async function getAIMemory(
  context: AIMemoryContext,
): Promise<MessagePayload[]> {
  if (
    !validateMemoryContext(
      context,
    )
  ) {
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

    /*
     * On ne renvoie jamais toute la mémoire
     * au modèle.
     */
    return pruneMessagesToLimit(
      messages,
      AI_MAX_CONTEXT_WORDS,
    );
  } catch (error) {
    console.error(
      '[AI Service] Impossible de récupérer la mémoire :',
      error,
    );

    return [];
  }
}

/* =========================================================
   SAVE MESSAGE
========================================================= */

/**
 * Ajoute un message à la mémoire IA.
 *
 * La mémoire est strictement isolée par :
 *
 * guildId + channelId + userId
 */
export async function saveAIMemoryMessage(
  context: AIMemoryContext,
  message: MessagePayload,
): Promise<void> {
  if (
    !validateMemoryContext(
      context,
    )
  ) {
    throw new Error(
      'Contexte IA invalide.',
    );
  }

  const normalized =
    normalizeMessage(
      message,
    );

  if (!normalized) {
    return;
  }

  try {
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
              normalized.timestamp ??
              new Date(),
          },
        },
      },

      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    /*
     * Nettoyage de la mémoire après insertion.
     */
    await trimAIMemory(
      context,
    );
  } catch (error) {
    console.error(
      '[AI Service] Impossible de sauvegarder la mémoire :',
      error,
    );

    throw error;
  }
}

/* =========================================================
   SAVE CONVERSATION
========================================================= */

/**
 * Ajoute plusieurs messages à la mémoire.
 */
export async function saveAIMemoryMessages(
  context: AIMemoryContext,
  messages: MessagePayload[],
): Promise<void> {
  if (
    !validateMemoryContext(
      context,
    )
  ) {
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

  const normalizedMessages =
    messages
      .map(normalizeMessage)
      .filter(
        (
          message,
        ): message is MessagePayload =>
          message !== null,
      );

  if (
    normalizedMessages.length === 0
  ) {
    return;
  }

  try {
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
            $each:
              normalizedMessages.map(
                (message) => ({
                  role:
                    message.role,

                  content:
                    message.content,

                  timestamp:
                    message.timestamp ??
                    new Date(),
                }),
              ),
          },
        },
      },

      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    await trimAIMemory(
      context,
    );
  } catch (error) {
    console.error(
      '[AI Service] Impossible de sauvegarder la conversation :',
      error,
    );

    throw error;
  }
}

/* =========================================================
   TRIM MEMORY
========================================================= */

/**
 * Nettoie les anciens messages de la mémoire.
 *
 * On conserve uniquement les derniers messages.
 */
export async function trimAIMemory(
  context: AIMemoryContext,
): Promise<void> {
  if (
    !validateMemoryContext(
      context,
    )
  ) {
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
      ) as typeof memory.messages;

    await memory.save();
  } catch (error) {
    console.error(
      '[AI Service] Erreur nettoyage mémoire :',
      error,
    );
  }
}

/* =========================================================
   CLEAR MEMORY
========================================================= */

/**
 * Supprime complètement la mémoire IA
 * d'un utilisateur dans un salon précis.
 */
export async function clearAIMemory(
  context: AIMemoryContext,
): Promise<boolean> {
  if (
    !validateMemoryContext(
      context,
    )
  ) {
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
      '[AI Service] Impossible de supprimer la mémoire :',
      error,
    );

    return false;
  }
}

/* =========================================================
   BUILD AI CONTEXT
========================================================= */

/**
 * Construit le contexte prêt à être envoyé
 * au moteur IA.
 */
export async function buildAIContext(
  context: AIMemoryContext,
  systemPrompt?: string,
): Promise<MessagePayload[]> {
  const memory =
    await getAIMemory(
      context,
    );

  const result: MessagePayload[] =
    [];

  if (
    systemPrompt?.trim()
  ) {
    result.push({
      role: 'system',

      content:
        systemPrompt.trim(),
    });
  }

  result.push(
    ...memory,
  );

  return pruneMessagesToLimit(
    result,
    AI_MAX_CONTEXT_WORDS,
  );
}

/* =========================================================
   DEFAULT EXPORT
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