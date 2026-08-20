// src/services/aiService.ts

export interface MessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Calcule le nombre de mots d'un texte ou d'une liste de messages
export function getWordCount(textOrMessages: string | MessagePayload[]): number {
  if (typeof textOrMessages === 'string') {
    return textOrMessages.split(/\s+/).filter(Boolean).length;
  }
  return textOrMessages.reduce((acc, msg) => acc + msg.content.split(/\s+/).filter(Boolean).length, 0);
}

// Élague l'historique de fin vers le début pour ne garder que les 500 mots les plus récents
export function pruneMessagesToLimit(messages: MessagePayload[], maxWords = 500): MessagePayload[] {
  let currentWords = 0;
  const result: MessagePayload[] = [];
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const words = getWordCount(messages[i].content);
    if (currentWords + words > maxWords) {
      break;
    }
    currentWords += words;
    result.unshift(messages[i]);
  }
  return result;
}