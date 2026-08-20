import { Router } from 'express';
import type { Client } from 'discord.js';
import { User } from '../../models/User.ts';
const router = Router();
let discordClient: Client | null = null;
const startedAt = Date.now();
/**
 * Enregistre le client Discord utilisé par OMNIX.
 */
export function registerDiscordClient(client: Client): void {
  discordClient = client;
  console.log('[Stats] Client Discord enregistré.');
}
/**
 * Permet aux autres parties de récupérer le client.
 */
export function getDiscordClient(): Client | null {
  return discordClient;
}
/**
 * Nombre de commandes chargées.
 */
function getCommandCount(): number {
  const globalValue = (
    globalThis as typeof globalThis & {
      __OMNIX_COMMAND_COUNT?: number;
    }
  ).__OMNIX_COMMAND_COUNT;
  if (
    typeof globalValue === 'number' &&
    Number.isFinite(globalValue)
  ) {
    return Math.max(0, Math.floor(globalValue));
  }
  const envValue = Number(
    process.env.OMNIX_COMMAND_COUNT ?? 0
  );
  if (Number.isFinite(envValue)) {
    return Math.max(0, Math.floor(envValue));
  }
  return 0;
}
/**
 * Statistiques Discord.
 */
function getDiscordGuildStats() {
  if (!discordClient) {
    return {
      connected: false,
      ready: false,
      guildsCount: 0,
      membersCount: 0,
      ping: 0,
    };
  }
  let membersCount = 0;
  for (const guild of discordClient.guilds.cache.values()) {
    membersCount += Number(guild.memberCount ?? 0);
  }
  const rawPing = Number(discordClient.ws.ping);
  return {
    connected: discordClient.isReady(),
    ready: discordClient.isReady(),
    guildsCount:
      discordClient.guilds.cache.size,
    membersCount,
    ping:
      Number.isFinite(rawPing) && rawPing >= 0
        ? Math.round(rawPing)
        : 0,
  };
}
/**
 * Temps depuis le démarrage du processus.
 */
function getProcessUptime(): number {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - startedAt) / 1000
    )
  );
}
/**
 * GET /api/stats
 */
router.get('/', async (_req, res) => {
  const requestStarted = Date.now();
  try {
    const discord = getDiscordGuildStats();
    let totalUsers = 0;
    try {
      totalUsers = await User.countDocuments();
    } catch (error) {
      console.warn(
        '[Stats] MongoDB indisponible:',
        error
      );
    }
    const apiLatency =
      Date.now() - requestStarted;
    return res.status(200).json({
      success: true,
      bot: {
        guildsCount: discord.guildsCount,
        membersCount: discord.membersCount,
        ping: discord.ping,
        connected: discord.connected,
        ready: discord.ready,
        uptime: getProcessUptime(),
      },
      database: {
        totalUsers,
        latency: apiLatency,
      },
      commands: getCommandCount(),
      api: {
        latency: apiLatency,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[Stats] Erreur:',
      error
    );
    return res.status(200).json({
      success: false,
      bot: {
        guildsCount: 0,
        membersCount: 0,
        ping: 0,
        connected: false,
        ready: false,
        uptime: getProcessUptime(),
      },
      database: {
        totalUsers: 0,
        latency: 0,
      },
      commands: 0,
      api: {
        latency:
          Date.now() - requestStarted,
      },
      error:
        'Statistiques temporairement indisponibles.',
      timestamp: new Date().toISOString(),
    });
  }
});
/**
 * GET /api/stats/health
 */
router.get('/health', (_req, res) => {
  const discord =
    getDiscordGuildStats();
  const healthy =
    discord.connected;
  return res.status(
    healthy ? 200 : 503
  ).json({
    success: healthy,
    service: 'OMNIX',
    status:
      healthy
        ? 'online'
        : 'degraded',
    discord:
      discord.connected
        ? 'connected'
        : 'disconnected',
    timestamp:
      new Date().toISOString(),
  });
});
export default router;