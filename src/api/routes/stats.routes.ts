import express, {
  type Request,
  type Response,
} from 'express';

import type { Client } from 'discord.js';

import { User } from '../../models/User.ts';

const router =
  express.Router();

let discordClient: Client | null =
  null;

const startedAt =
  Date.now();

/**
 * Enregistre le client Discord.
 */
export function registerDiscordClient(
  client: Client,
): void {
  discordClient = client;

  console.log(
    '[Stats] Client Discord enregistré.',
  );
}

/**
 * Nombre de commandes.
 */
function getCommandCount(): number {
  const globalState =
    globalThis as typeof globalThis & {
      __OMNIX_COMMAND_COUNT?: number;
    };

  const globalValue =
    globalState.__OMNIX_COMMAND_COUNT;

  if (
    typeof globalValue ===
      'number' &&
    Number.isFinite(globalValue)
  ) {
    return Math.max(
      0,
      Math.floor(globalValue),
    );
  }

  const envValue =
    Number(
      process.env
        .OMNIX_COMMAND_COUNT ??
        0,
    );

  if (
    Number.isFinite(
      envValue,
    )
  ) {
    return Math.max(
      0,
      Math.floor(envValue),
    );
  }

  return 0;
}

/**
 * Uptime en secondes.
 */
function getUptime(): number {
  return Math.floor(
    (Date.now() - startedAt) /
      1000,
  );
}

/**
 * Stats Discord.
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

  let membersCount =
    0;

  for (
    const guild of
    discordClient.guilds.cache.values()
  ) {
    membersCount +=
      Number(
        guild.memberCount ?? 0,
      );
  }

  const rawPing =
    Number(
      discordClient.ws.ping,
    );

  return {
    connected:
      discordClient.isReady(),

    guildsCount:
      discordClient.guilds.cache
        .size,

    membersCount,

    ping:
      Number.isFinite(
        rawPing,
      ) &&
      rawPing >= 0
        ? Math.round(rawPing)
        : 0,
  };
}

/**
 * GET /api/stats
 */
router.get(
  '/stats',
  async (
    req: Request,
    res: Response,
  ) => {
    const started =
      Date.now();

    try {
      const discord =
        getDiscordStats();

      let totalUsers =
        0;

      try {
        totalUsers =
          await User.countDocuments();
      } catch (error) {
        console.warn(
          '[Stats] MongoDB indisponible:',
          error,
        );
      }

      const latency =
        Date.now() -
        started;

      return res.json({
        success: true,

        bot: {
          connected:
            discord.connected,

          guildsCount:
            discord.guildsCount,

          membersCount:
            discord.membersCount,

          ping:
            discord.ping,

          uptime:
            getUptime(),
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
        error,
      );

      return res.status(200).json({
        success: false,

        bot: {
          connected: false,
          guildsCount: 0,
          membersCount: 0,
          ping: 0,
          uptime: getUptime(),
        },

        database: {
          totalUsers: 0,
          latency: 0,
        },

        commands: 0,

        api: {
          latency:
            Date.now() -
            started,
        },

        error:
          'Statistiques temporairement indisponibles.',

        timestamp:
          new Date().toISOString(),
      });
    }
  },
);

/**
 * GET /api/stats/health
 */
router.get(
  '/stats/health',
  (
    req: Request,
    res: Response,
  ) => {
    const discord =
      getDiscordStats();

    return res.json({
      success: true,

      service:
        'OMNIX',

      status:
        'online',

      discord:
        discord.connected
          ? 'connected'
          : 'disconnected',

      timestamp:
        new Date().toISOString(),
    });
  },
);

export default router;