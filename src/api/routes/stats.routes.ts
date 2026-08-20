import express, {
  type Request,
  type Response,
} from 'express';
import type { Client } from 'discord.js';
import { User } from '../../models/User.ts';
/* =========================================================
   ROUTER
========================================================= */
const router = express.Router();
/* =========================================================
   DISCORD CLIENT
========================================================= */
let discordClient: Client | null = null;
/**
 * Enregistre le vrai client Discord.
 *
 * À appeler depuis src/index.ts après création du Client.
 */
export function registerDiscordClient(
  client: Client,
): void {
  discordClient = client;
  console.log(
    '[Stats] Client Discord enregistré.',
  );
}
/* =========================================================
   PROCESS START
========================================================= */
const startedAt = Date.now();
/* =========================================================
   COMMAND COUNT
========================================================= */
/**
 * Récupère le nombre réel de commandes OMNIX.
 *
 * Priorité :
 *
 * 1. globalThis.__OMNIX_COMMAND_COUNT
 * 2. process.env.OMNIX_COMMAND_COUNT
 * 3. 0
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
      Math.floor(globalValue),
    );
  }
  const envValue = Number(
    process.env.OMNIX_COMMAND_COUNT ?? 0,
  );
  if (
    Number.isFinite(envValue)
  ) {
    return Math.max(
      0,
      Math.floor(envValue),
    );
  }
  return 0;
}
/* =========================================================
   DISCORD STATS
========================================================= */
function getDiscordGuildStats() {
  /**
   * Client Discord pas encore enregistré.
   */
  if (!discordClient) {
    return {
      connected: false,
      guildsCount: 0,
      membersCount: 0,
      ping: 0,
    };
  }
  /**
   * Nombre de serveurs Discord
   * actuellement présents dans le cache.
   */
  const guildsCount =
    discordClient.guilds.cache.size;
  /**
   * Nombre total de membres
   * sur les serveurs du bot.
   */
  let membersCount = 0;
  for (
    const guild of
    discordClient.guilds.cache.values()
  ) {
    membersCount += Number(
      guild.memberCount ?? 0,
    );
  }
  /**
   * Latence WebSocket Discord.
   */
  const rawPing =
    Number(
      discordClient.ws.ping,
    );
  const ping =
    Number.isFinite(rawPing) &&
    rawPing >= 0
      ? Math.round(rawPing)
      : 0;
  /**
   * État réel du client Discord.
   */
  const connected =
    discordClient.isReady();
  return {
    connected,
    guildsCount,
    membersCount,
    ping,
  };
}
/* =========================================================
   UPTIME
========================================================= */
/**
 * Uptime logique du processus.
 *
 * Pour le moment :
 *
 * 100 = processus actif
 * 0   = processus invalide
 *
 * Ce n'est PAS l'uptime historique Render.
 */
function getUptime(): number {
  return Date.now() >= startedAt
    ? 100
    : 0;
}
/* =========================================================
   PUBLIC STATS
========================================================= */
/**
 * GET /api/stats
 *
 * IMPORTANT :
 *
 * Le router est monté dans app.ts avec :
 *
 * app.use('/api', statsRouter);
 *
 * La route ici doit donc être :
 *
 * /stats
 *
 * et devient automatiquement :
 *
 * /api/stats
 */
router.get(
  '/stats',
  async (
    req: Request,
    res: Response,
  ) => {
    const requestStarted =
      Date.now();
    try {
      /* =====================================================
         DISCORD
      ===================================================== */
      const discordStats =
        getDiscordGuildStats();
      /* =====================================================
         DATABASE
      ===================================================== */
      let totalUsers = 0;
      try {
        totalUsers =
          await User.countDocuments();
      } catch (error) {
        /**
         * MongoDB ne doit pas empêcher
         * les statistiques publiques Discord
         * de fonctionner.
         */
        console.warn(
          '[Stats] MongoDB indisponible:',
          error,
        );
        totalUsers = 0;
      }
      /* =====================================================
         API LATENCY
      ===================================================== */
      const latency =
        Date.now() -
        requestStarted;
      /* =====================================================
         COMMANDS
      ===================================================== */
      const commands =
        getCommandCount();
      /* =====================================================
         RESPONSE
      ===================================================== */
      return res.status(200).json({
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
        commands,
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
      const latency =
        Date.now() -
        requestStarted;
      /**
       * On garde une structure JSON stable
       * même lorsqu'une erreur survient.
       */
      return res.status(200).json({
        success: false,
        bot: {
          guildsCount: 0,
          membersCount: 0,
          ping: 0,
          uptime:
            getUptime(),
          connected: false,
        },
        database: {
          totalUsers: 0,
          latency: 0,
        },
        commands: 0,
        api: {
          latency,
        },
        error:
          'Statistiques temporairement indisponibles.',
        timestamp:
          new Date().toISOString(),
      });
    }
  },
);
/* =========================================================
   HEALTH CHECK
========================================================= */
/**
 * GET /api/stats/health
 *
 * Avec :
 *
 * app.use('/api', statsRouter)
 *
 * cette route devient :
 *
 * /api/stats/health
 */
router.get(
  '/stats/health',
  (
    req: Request,
    res: Response,
  ) => {
    const discordStats =
      getDiscordGuildStats();
    return res.status(200).json({
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
  },
);
/* =========================================================
   EXPORT
========================================================= */
export default router;