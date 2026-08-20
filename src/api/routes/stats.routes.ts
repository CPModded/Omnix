import express, {
  type Request,
  type Response,
} from 'express';

import type { Client } from 'discord.js';

import { User } from '../../models/User.ts';

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   DISCORD CLIENT
========================================================= */

/**
 * Le vrai client Discord est enregistré depuis :
 *
 * src/index.ts
 *
 * Cela permet à cette route d'utiliser directement :
 *
 * discordClient.guilds.cache
 * discordClient.ws.ping
 */
let discordClient:
  Client | null = null;

/**
 * Enregistre le client Discord.
 */
export function registerDiscordClient(
  client: Client
): void {
  discordClient =
    client;

  console.log(
    '[Stats] Client Discord enregistré.'
  );
}

/* =========================================================
   START TIME
========================================================= */

/**
 * Date de démarrage du processus.
 */
const startedAt =
  Date.now();

/* =========================================================
   COMMAND COUNT
========================================================= */

/**
 * Nombre réel de commandes.
 *
 * Cette valeur peut être alimentée plus tard directement
 * par ton système loadCommands().
 *
 * Pour l'instant, on utilise :
 *
 * globalThis.__OMNIX_COMMAND_COUNT
 *
 * si elle existe.
 *
 * Sinon :
 *
 * process.env.OMNIX_COMMAND_COUNT
 *
 * Cela permet au système de fonctionner même avant
 * la modification du loader de commandes.
 */
function getCommandCount(): number {
  const globalValue =
    (
      globalThis as typeof globalThis & {
        __OMNIX_COMMAND_COUNT?: number;
      }
    ).__OMNIX_COMMAND_COUNT;

  if (
    typeof globalValue ===
    'number' &&
    Number.isFinite(
      globalValue
    )
  ) {
    return Math.max(
      0,
      Math.floor(
        globalValue
      )
    );
  }

  const envValue =
    Number(
      process.env.OMNIX_COMMAND_COUNT ||
      0
    );

  if (
    Number.isFinite(
      envValue
    )
  ) {
    return Math.max(
      0,
      Math.floor(
        envValue
      )
    );
  }

  return 0;
}

/* =========================================================
   DISCORD GUILD STATS
========================================================= */

function getDiscordGuildStats() {
  /**
   * Le client n'est pas encore disponible.
   */
  if (!discordClient) {
    return {
      connected:
        false,

      guildsCount:
        0,

      membersCount:
        0,

      ping:
        0,
    };
  }

  /**
   * Nombre réel de serveurs présents
   * dans le cache Discord.
   */
  const guildsCount =
    discordClient.guilds.cache.size;

  /**
   * Nombre total de membres.
   *
   * guild.memberCount représente le nombre de membres
   * de chaque serveur.
   */
  let membersCount =
    0;

  for (
    const guild of
    discordClient.guilds.cache.values()
  ) {
    membersCount +=
      Number(
        guild.memberCount || 0
      );
  }

  /**
   * Ping WebSocket Discord.
   *
   * -1 signifie généralement que Discord n'est
   * pas encore prêt à fournir la latence.
   */
  const rawPing =
    Number(
      discordClient.ws.ping
    );

  const ping =
    Number.isFinite(
      rawPing
    ) &&
    rawPing >= 0
      ? Math.round(
          rawPing
        )
      : 0;

  return {
    connected:
      discordClient.isReady(),

    guildsCount,

    membersCount,

    ping,
  };
}

/* =========================================================
   UPTIME
========================================================= */

/**
 * Uptime du processus OMNIX.
 *
 * Ici on considère qu'un processus qui répond
 * correctement est à 100%.
 *
 * Ce n'est pas un historique d'uptime Render.
 */
function getUptime(): number {
  const elapsed =
    Date.now() -
    startedAt;

  if (
    elapsed >= 0
  ) {
    return 100;
  }

  return 0;
}

/* =========================================================
   PUBLIC STATS
========================================================= */

/**
 * GET /api/stats
 *
 * Cette route est volontairement PUBLIC.
 *
 * La page d'accueil doit pouvoir afficher les statistiques
 * sans connexion Discord.
 */
router.get(
  '/api/stats',
  async (
    req: Request,
    res: Response
  ) => {
    const requestStarted =
      Date.now();

    try {
      /* ===================================================
         DISCORD
      =================================================== */

      const discordStats =
        getDiscordGuildStats();

      /* ===================================================
         MONGODB
      =================================================== */

      let totalUsers =
        0;

      try {
        totalUsers =
          await User.countDocuments();
      } catch (databaseError) {
        /**
         * MongoDB ne doit pas empêcher la page publique
         * d'afficher les statistiques Discord.
         */
        console.warn(
          '[Stats] MongoDB indisponible :',
          databaseError
        );

        totalUsers =
          0;
      }

      /* ===================================================
         API LATENCY
      =================================================== */

      const apiLatency =
        Date.now() -
        requestStarted;

      /* ===================================================
         COMMANDS
      =================================================== */

      const commandCount =
        getCommandCount();

      /* ===================================================
         UPTIME
      =================================================== */

      const uptime =
        getUptime();

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.json({
        success:
          true,

        bot: {
          /**
           * Nombre réel de guilds Discord.
           */
          guildsCount:
            discordStats.guildsCount,

          /**
           * Nombre réel de membres présents
           * sur les serveurs du bot.
           */
          membersCount:
            discordStats.membersCount,

          /**
           * Ping réel du WebSocket Discord.
           */
          ping:
            discordStats.ping,

          /**
           * Uptime du processus.
           */
          uptime,

          /**
           * Permet au frontend de savoir
           * si le bot Discord est réellement connecté.
           */
          connected:
            discordStats.connected,
        },

        database: {
          /**
           * Utilisateurs OMNIX enregistrés.
           */
          totalUsers,

          /**
           * Temps nécessaire pour traiter
           * la requête API.
           */
          latency:
            apiLatency,
        },

        /**
         * Nombre de commandes OMNIX.
         */
        commands:
          commandCount,

        /**
         * Latence de cette requête.
         */
        api: {
          latency:
            apiLatency,
        },

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Public Stats] Erreur :',
        error
      );

      /**
       * Même en cas de problème,
       * on retourne une structure JSON cohérente.
       *
       * On évite ainsi que le frontend obtienne
       * une réponse complètement différente.
       */
      return res.status(200).json({
        success:
          false,

        bot: {
          guildsCount:
            0,

          membersCount:
            0,

          ping:
            0,

          uptime:
            getUptime(),

          connected:
            false,
        },

        database: {
          totalUsers:
            0,

          latency:
            0,
        },

        commands:
          0,

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

/* =========================================================
   HEALTH CHECK
========================================================= */

/**
 * GET /api/stats/health
 *
 * Petite route utile pour Render.
 *
 * Elle permet de vérifier rapidement que l'API répond.
 */
router.get(
  '/api/stats/health',
  (
    req: Request,
    res: Response
  ) => {
    const discordStats =
      getDiscordGuildStats();

    return res.json({
      success:
        true,

      service:
        'OMNIX',

      status:
        'online',

      discord:
        discordStats.connected
          ? 'connected'
          : 'disconnected',

      timestamp:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;