import { OmnixLogger } from './logger';
export function logMongoError(error: unknown, context: { operation:string; guildId?:string; userId?:string }): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[MongoDB] ${context.operation}${context.guildId ? ` guildId=${context.guildId}` : ''}${context.userId ? ` userId=${context.userId}` : ''}: ${message}`);
}
