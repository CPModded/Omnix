import express, {
  type Request,
  type Response,
} from 'express';
import type { Client } from 'discord.js';
import { User } from '../../models/User.ts';
/* =========================================================
   OMNIX — STATISTICS ROUTES
========================================================= */
const router = express.Router();
/* =========================================================
   DISCORD CLIENT
========================================================= */
let discordClient: Client | null = null;
/**
 * Enregistre le client Discord principal.
 *
 * À appeler depuis index.ts après la création
 * du client Discord.
 */
export function registerDiscordClient(
  client: Client,
): void {
  discordClient = client;
  console.log(
    '[Stats] ✓ Client Discord enregistré.',
  );
}
/* =========================================================
   PROCESS START
========================================================= */
const startedAt =
  Date.now();
/* =========================================================
   COMMAND COUNT
========================================================= */
/**
 * Récupère le nombre réel de commandes OMNIX.
 *
 * Priorité :
 *
 * 1. globalThis.__OMNIX_COMMAND_COUNT
 * 2. globalThis.__OMNIX_COMMANDS
 * 3. client.commands.size
 * 4. process.env.OMNIX_COMMAND_COUNT
 */
function getCommandCount(): number {
  /*
   * ---------------------------------------------------------
   * GLOBAL COMMAND COUNT
   * ---------------------------------------------------------
   */
  const globalState =
    globalThis as typeof globalThis & {
      __OMNIX_COMMAND_COUNT?: number;
      __OMNIX_COMMANDS?: Map<
        string,
        unknown
      >;
    };
  if (
    typeof globalState
      .__OMNIX_COMMAND_COUNT ===
      'number'
  ) {
    return Math.max(
      0,
      Math.floor(
        globalState
          .__OMNIX_COMMAND_COUNT,
      ),
    );
  }
  /*
   * ---------------------------------------------------------
   * GLOBAL COMMAND COLLECTION
   * ---------------------------------------------------------
   */
  if (
    globalState.__OMNIX_COMMANDS &&
    typeof globalState
      .__OMNIX_COMMANDS.size ===
      'number'
  ) {
    return Math.max(
      0,
      globalState
        .__OMNIX_COMMANDS
        .size,
    );
  }
  /*
   * ---------------------------------------------------------
   * DISCORD CLIENT COMMAND COLLECTION
   * ---------------------------------------------------------
   *
   * discord.js Client ne possède pas
   * officiellement `commands`.
   *
   * On vérifie donc dynamiquement.
   */
  const dynamicClient =
    discordClient as any;
  if (
    dynamicClient?.commands &&
    typeof dynamicClient.commands.size ===
      'number'
  ) {
    return Math.max(
      0,
      dynamicClient.commands.size,
    );
  }
  /*
   * ---------------------------------------------------------
   * ENVIRONMENT FALLBACK
   * ---------------------------------------------------------
   */
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
      Math.floor(
        envValue,
      ),
    );
  }
  return 0;
}
/* =========================================================
   DISCORD STATS
========================================================= */
/**
 * Retourne les statistiques Discord
 * directement depuis le client connecté.
 */
function getDiscordStats() {
  /*
   * Client absent.
   */
  if (!discordClient) {
    return {
      connected:
        false,
      ready:
        false,
      guildsCount:
        0,
      membersCount:
        0,
      ping:
        0,
    };
  }
  /*
   * Vérifie que Discord est réellement prêt.
   */
  let ready =
    false;
  try {
    ready =
      discordClient.isReady();
  } catch {
    ready =
      false;
  }
  /*
   * Nombre de serveurs.
   */
  const guildsCount =
    discordClient.guilds.cache.size;
  /*
   * Nombre total de membres connus.
   */
  let membersCount =
    0;
  for (
    const guild of
    discordClient.guilds.cache.values()
  ) {
    const count =
      Number(
        guild.memberCount ??
        0,
      );
    if (
      Number.isFinite(
        count,
      ) &&
      count >= 0
    ) {
      membersCount +=
        count;
    }
  }
  /*
   * Latence WebSocket Discord.
   */
  let ping =
    0;
  try {
    const rawPing =
      Number(
        discordClient.ws.ping,
      );
    if (
      Number.isFinite(
        rawPing,
      ) &&
      rawPing >= 0
    ) {
      ping =
        Math.round(
          rawPing,
        );
    }
  } catch {
    ping =
      0;
  }
  return {
    connected:
      ready,
    ready,
    guildsCount,
    membersCount,
    ping,
  };
}
/* =========================================================
   UPTIME
========================================================= */
/**
 * Uptime du processus en secondes.
 */
function getUptimeSeconds(): number {
  return Math.max(
    0,
    Math.floor(
      (
        Date.now() -
        startedAt
      ) / 1000,
    ),
  );
}
/**
 * Uptime en pourcentage.
 *
 * Le Dashboard peut continuer à afficher
 * une valeur de disponibilité.
 */
function getUptimePercentage(): number {
  return discordClient?.isReady()
    ? 100
    : 0;
}
/* =========================================================
   DATABASE STATS
========================================================= */
async function getDatabaseStats() {
  const started =
    Date.now();
  try {
    const totalUsers =
      await User.countDocuments();
    return {
      connected:
        true,
      totalUsers,
      latency:
        Math.max(
          0,
          Date.now() -
          started,
        ),
    };
  } catch (error) {
    console.warn(
      '[Stats] ⚠️ MongoDB indisponible :',
      error,
    );
    return {
      connected:
        false,
      totalUsers:
        0,
      latency:
        Math.max(
          0,
          Date.now() -
          started,
        ),
    };
  }
}
/* =========================================================
   GET /api/stats
========================================================= */
/**
 * IMPORTANT :
 *
 * app.ts monte ce router sur "/".
 *
 * Donc :
 *
 * router.get('/stats')
 *
 * devient :
 *
 * GET /api/stats
 *
 * si app.ts contient :
 *
 * app.use('/api', statsRouter)
 *
 * =========================================================
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
      /*
       * Discord.
       */
      const discord =
        getDiscordStats();
      /*
       * Base de données.
       */
      const database =
        await getDatabaseStats();
      /*
       * Commandes.
       */
      const commands =
        getCommandCount();
      /*
       * Latence API.
       */
      const apiLatency =
        Math.max(
          0,
          Date.now() -
          requestStarted,
        );
      return res.json({
        success:
          true,
        bot: {
          connected:
            discord.connected,
          ready:
            discord.ready,
          guildsCount:
            discord.guildsCount,
          /*
           * Alias utiles au Dashboard.
           */
          guilds:
            discord.guildsCount,
          serverCount:
            discord.guildsCount,
          membersCount:
            discord.membersCount,
          members:
            discord.membersCount,
          ping:
            discord.ping,
          latency:
            discord.ping,
          uptime:
            getUptimePercentage(),
          uptimeSeconds:
            getUptimeSeconds(),
        },
        database: {
          connected:
            database.connected,
          totalUsers:
            database.totalUsers,
          latency:
            database.latency,
        },
        commands: {
          count:
            commands,
          total:
            commands,
        },
        /*
         * Certaines anciennes versions
         * du Dashboard attendent un nombre
         * directement dans `commands`.
         *
         * On ajoute donc également une valeur
         * simple via `commandCount`.
         */
        commandCount:
          commands,
        api: {
          latency:
            apiLatency,
          status:
            'online',
        },
        /*
         * Valeurs directement exploitables
         * par différents dashboards.
         */
        guildsCount:
          discord.guildsCount,
        membersCount:
          discord.membersCount,
        latency:
          discord.ping,
        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Stats] ❌ Erreur /api/stats :',
        error,
      );
      /*
       * On renvoie quand même une structure
       * stable afin que le Dashboard ne casse pas.
       */
      return res.status(
        200,
      ).json({
        success:
          false,
        error:
          'Statistiques temporairement indisponibles.',
        bot: {
          connected:
            false,
          ready:
            false,
          guildsCount:
            0,
          guilds:
            0,
          serverCount:
            0,
          membersCount:
            0,
          members:
            0,
          ping:
            0,
          latency:
            0,
          uptime:
            0,
          uptimeSeconds:
            getUptimeSeconds(),
        },
        database: {
          connected:
            false,
          totalUsers:
            0,
          latency:
            0,
        },
        commands: {
          count:
            0,
          total:
            0,
        },
        commandCount:
          0,
        api: {
          latency:
            Math.max(
              0,
              Date.now() -
              requestStarted,
            ),
          status:
            'error',
        },
        guildsCount:
          0,
        membersCount:
          0,
        latency:
          0,
        timestamp:
          new Date().toISOString(),
      });
    }
  },
);
/* =========================================================
   GET /api/stats/health
========================================================= */
router.get(
  '/stats/health',
  (
    req: Request,
    res: Response,
  ) => {
    const discord =
      getDiscordStats();
    return res.json({
      success:
        true,
      service:
        'OMNIX',
      status:
        discord.connected
          ? 'online'
          : 'starting',
      discord:
        discord.connected
          ? 'connected'
          : 'disconnected',
      guilds:
        discord.guildsCount,
      members:
        discord.membersCount,
      ping:
        discord.ping,
      uptime:
        getUptimeSeconds(),
      timestamp:
        new Date().toISOString(),
    });
  },
);
/* =========================================================
   EXPORT
========================================================= */
export default router;