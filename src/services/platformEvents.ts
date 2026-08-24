import PlatformEvent, { type PlatformEventType } from '../models/PlatformEvent';
export async function recordPlatformEvent(type: PlatformEventType, data: { userId?: string; guildId?: string; metadata?: Record<string, unknown> } = {}) {
  try { await PlatformEvent.create({ type, ...data }); } catch (error) { console.error('[PlatformEvent] unable to record event:', error); }
}
