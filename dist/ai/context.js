"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContext = buildContext;
function buildContext(context) {
    return `
# CONTEXTE OMNIX

Serveur Discord :
- Guild ID : ${context.guildId}
- Nom : ${context.serverName ?? 'Inconnu'}

Utilisateur :
- User ID : ${context.userId}

${context.additionalContext ?? ''}

# HISTORIQUE

${context.conversationHistory
        ?.map(message => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n') ?? 'Aucun historique.'}
`;
}
