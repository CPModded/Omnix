"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMongoError = logMongoError;
function logMongoError(error, context) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MongoDB] ${context.operation}${context.guildId ? ` guildId=${context.guildId}` : ''}${context.userId ? ` userId=${context.userId}` : ''}: ${message}`);
}
