import type { Request, Response } from 'express';
import type { Client } from 'discord.js';
import { User } from '../../models/User.ts';
let discordClient: Client | null = null;
const startedAt = Date.now();
/**
 * Enregistre le client Discord.
 */
export function registerStatsDiscordClient(
  client: Client
): void {
  discordClient = client;
  console.log(
    '[StatsController] Client Discord enregistré.'
  );
}
/**
 * Retourne le nombre de commandes OMNIX.
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
    return Math.max(
      0,
      Math.floor(globalValue)
    );
  }
  const envValue = Number(
    process.env.OMNIX_COMMAND_COUNT ?? 0
  );
  return Number.isFinite(envValue)
    ? Math.max(0, Math.floor(envValue))
    : 0;
}
/**
 * Statistiques Discord.
 */
function getDiscordStats() {
  if (!discordClient) {
    return {
      connected: false,
      guildsCount: 0,
      membersCount: 0,
      ping: 0,
    };
  }
  let membersCount = 0;
  for (
    const guild
    of discordClient.guilds.cache.values()
  ) {
    membersCount += Number(
      guild.memberCount ?? 0
    );
  }
  const ping =
    Number(discordClient.ws.ping);
  return {
    connected:
      discordClient.isReady(),
    guildsCount:
      discordClient.guilds.cache.size,
    membersCount,
    ping:
      Number.isFinite(ping) && ping >= 0
        ? Math.round(ping)
        : 0,
  };
}
/**
 * GET /api/stats
 */
export async function getStats(
  _req: Request,
  res: Response
) {
  const started = Date.now();
  try {
    const discord =
      getDiscordStats();
    let totalUsers = 0;
    try {
      totalUsers =
        await User.countDocuments();
    } catch (error) {
      console.warn(
        '[StatsController] MongoDB:',
        error
      );
    }
    const latency =
      Date.now() - started;
    return res.json({
      success: true,
      bot: {
        guildsCount:
          discord.guildsCount,
        membersCount:
          discord.membersCount,
        ping:
          discord.ping,
        connected:
          discord.connected,
        uptime:
          Math.floor(
            (Date.now() - startedAt) /
            1000
          ),
      },
      database: {
        totalUsers,
        latency,
      },
      commands:
        getCommandCount(),
      api: {
        latency,
      },
      timestamp:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[StatsController] Erreur:',
      error
    );
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les statistiques.',
    });
  }
}
/**
 * GET /api/stats/health
 */
export function health(
  _req: Request,
  res: Response
) {
  const discord =
    getDiscordStats();
  return res.status(
    discord.connected ? 200 : 503
  ).json({
    success:
      discord.connected,
    service:
      'OMNIX',
    status:
      discord.connected
        ? 'online'
        : 'degraded',
    discord:
      discord.connected
        ? 'connected'
        : 'disconnected',
    timestamp:
      new Date().toISOString(),
  });
}