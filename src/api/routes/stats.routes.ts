import express, {
  type Request,
  type Response,
} from 'express';

import type { Client } from 'discord.js';

import { User } from '../../models/User.ts';

const router = express.Router();

let discordClient: Client | null = null;

/**
 * Enregistre le client Discord utilisé
 * par les statistiques.
 */
export function registerDiscordClient(
  client: Client
): void {
  discordClient = client;

  console.log(
    '[Stats] Client Discord enregistré.'
  );
}

/**
 * Heure de démarrage du processus.
 */
const startedAt = Date.now();

/**
 * Nombre de commandes OMNIX.
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

  if (Number.isFinite(envValue)) {
    return Math.max(
      0,
      Math.floor(envValue)
    );
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
      guildsCount: 0,
      membersCount: 0,
      ping: 0,
    };
  }

  const guildsCount =
    discordClient.guilds.cache.size;

  let membersCount = 0;

  for (
    const guild of discordClient.guilds.cache.values()
  ) {
    membersCount += Number(
      guild.memberCount ?? 0
    );
  }

  const rawPing =
    Number(discordClient.ws.ping);

  const ping =
    Number.isFinite(rawPing) &&
    rawPing >= 0
      ? Math.round(rawPing)
      : 0;

  return {
    connected:
      discordClient.isReady(),

    guildsCount,

    membersCount,

    ping,
  };
}

/**
 * Uptime logique du processus.
 */
function getUptime(): number {
  return Date.now() >= startedAt
    ? 100
    : 0;
}

/**
 * GET /api/stats
 */
router.get(
  '/stats',
  async (
    req: Request,
    res: Response
  ) => {
    const requestStarted =
      Date.now();

    try {
      const discordStats =
        getDiscordGuildStats();

      let totalUsers = 0;

      try {
        totalUsers =
          await User.countDocuments();
      } catch (error) {
        console.warn(
          '[Stats] MongoDB indisponible:',
          error
        );
      }

      const latency =
        Date.now() -
        requestStarted;

      return res.json({
        success: true,

        bot: {
          guildsCount:
            discordStats.guildsCount,

          membersCount:
            discordStats.membersCount,

          ping:
            discordStats.ping,

          uptime:
            getUptime(),

          connected:
            discordStats.connected,
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
        '[Stats] Erreur:',
        error
      );

      return res.status(200).json({
        success: false,

        bot: {
          guildsCount: 0,
          membersCount: 0,
          ping: 0,
          uptime: getUptime(),
          connected: false,
        },

        database: {
          totalUsers: 0,
          latency: 0,
        },

        commands: 0,

        api: {
          latency:
            Date.now() -
            requestStarted,
        },

        error:
          'Statistiques temporairement indisponibles.',

        timestamp:
          new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/stats/health
 */
router.get(
  '/stats/health',
  (
    req: Request,
    res: Response
  ) => {
    const discordStats =
      getDiscordGuildStats();

    return res.json({
      success: true,

      service: 'OMNIX',

      status: 'online',

      discord:
        discordStats.connected
          ? 'connected'
          : 'disconnected',

      timestamp:
        new Date().toISOString(),
    });
  }
);

export default router;