export interface OmnixAIContext {
  guildId: string;
  userId: string;

  serverName?: string;

  conversationHistory?: {
    role: 'user' | 'assistant';
    content: string;
  }[];

  additionalContext?: string;
}

export function buildContext(
  context: OmnixAIContext
): string {

  return `
# CONTEXTE OMNIX

Serveur Discord :
- Guild ID : ${context.guildId}
- Nom : ${context.serverName ?? 'Inconnu'}

Utilisateur :
- User ID : ${context.userId}

${context.additionalContext ?? ''}

# HISTORIQUE

${
  context.conversationHistory
    ?.map(
      message =>
        `${message.role.toUpperCase()}: ${message.content}`
    )
    .join('\n') ?? 'Aucun historique.'
}
`;
}