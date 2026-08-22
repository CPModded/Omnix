// src/services/aiService.ts

/* =========================================================
   TYPES
========================================================= */

export type AiMessageRole =
  | 'user'
  | 'assistant'
  | 'system';

export interface MessagePayload {
  role: AiMessageRole;
  content: string;
}

/* =========================================================
   WORD COUNT
========================================================= */

/**
 * Calcule approximativement le nombre de mots.
 *
 * Accepte :
 * - une chaîne
 * - une liste de messages
 */
export function getWordCount(
  textOrMessages:
    | string
    | MessagePayload[],
): number {
  if (typeof textOrMessages === 'string') {
    return countWords(
      textOrMessages,
    );
  }

  return textOrMessages.reduce(
    (total, message) =>
      total +
      countWords(
        message.content,
      ),
    0,
  );
}

/**
 * Compteur interne.
 *
 * On normalise les espaces pour éviter
 * les résultats incohérents avec :
 *
 * "hello     world"
 *
 * ou :
 *
 * "hello\nworld"
 */
function countWords(
  text: string,
): number {
  if (!text) {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/* =========================================================
   MESSAGE PRUNING
========================================================= */

/**
 * Garde les messages les plus récents
 * jusqu'à atteindre la limite de mots.
 *
 * IMPORTANT :
 *
 * L'ordre original des messages est conservé.
 */
export function pruneMessagesToLimit(
  messages: MessagePayload[],
  maxWords = 500,
): MessagePayload[] {
  /*
   * Protection contre une valeur invalide.
   */
  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return [];
  }

  if (
    !Number.isFinite(maxWords) ||
    maxWords <= 0
  ) {
    return [];
  }

  const result: MessagePayload[] = [];

  let currentWords = 0;

  /*
   * On part de la fin pour conserver
   * les messages les plus récents.
   */
  for (
    let index = messages.length - 1;
    index >= 0;
    index--
  ) {
    const message =
      messages[index];

    if (!message) {
      continue;
    }

    const words =
      countWords(
        message.content,
      );

    /*
     * Un message unique dépassant la limite
     * est ignoré plutôt que de dépasser
     * la limite globale.
     */
    if (
      currentWords + words >
      maxWords
    ) {
      continue;
    }

    currentWords += words;

    /*
     * On réinsère au début afin de
     * restaurer l'ordre chronologique.
     */
    result.unshift(message);
  }

  return result;
}

/* =========================================================
   TOKEN ESTIMATION
========================================================= */

/**
 * Estimation très approximative des tokens.
 *
 * Ce n'est PAS un tokenizer officiel.
 *
 * Elle sert uniquement à avoir une estimation
 * locale avant d'envoyer une requête à un modèle.
 */
export function estimateTokens(
  textOrMessages:
    | string
    | MessagePayload[],
): number {
  const words =
    getWordCount(
      textOrMessages,
    );

  /*
   * Approximation volontairement prudente :
   *
   * ~1.3 token / mot
   *
   * La valeur réelle dépend du tokenizer
   * du modèle utilisé.
   */
  return Math.ceil(
    words * 1.3,
  );
}

/* =========================================================
   MESSAGE TOKEN ESTIMATION
========================================================= */

/**
 * Estime les tokens d'une liste de messages.
 */
export function estimateMessageTokens(
  messages: MessagePayload[],
): number {
  return estimateTokens(
    messages,
  );
}