import express, {
  type Request,
  type Response,
} from 'express';

import mongoose from 'mongoose';

import { User } from '../../models/User.ts';
import GuildConfig from '../../models/GuildConfig.ts';
import AiSession from '../../models/AiSession.ts';

/* =========================================================
   OMNIX — STATS ROUTES
========================================================= */

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function getDiscordClient(
  req: Request,
): any | null {
  /*
   * Le client Discord peut être exposé par index.ts
   * ou attaché à l'application.
   *
   * On ne suppose pas une structure qui n'existe pas.
   */

  const app = req.app as any;

  return (
    app.locals.discordClient ||
    app.locals.client ||
    null
  );
}

/* =========================================================
   PUBLIC STATS
========================================================= */

/**
 * GET /api/stats
 *
 * Retourne les statistiques globales utilisées
 * par le site / dashboard.
 */

router.get(
  '/stats',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      /* -----------------------------------------------------
         DATABASE
      ----------------------------------------------------- */

      const databaseConnected =
        mongoose.connection.readyState === 1;

      /* -----------------------------------------------------
         USERS
      ----------------------------------------------------- */

      let totalUsers = 0;

      if (databaseConnected) {
        totalUsers =
          await User.countDocuments();
      }

      /* -----------------------------------------------------
         GUILDS
      ----------------------------------------------------- */

      let totalGuildConfigs = 0;

      if (databaseConnected) {
        totalGuildConfigs =
          await GuildConfig.countDocuments();
      }

      /* -----------------------------------------------------
         AI SESSIONS
      ----------------------------------------------------- */

      let totalAiSessions = 0;

      if (databaseConnected) {
        totalAiSessions =
          await AiSession.countDocuments();
      }

      /* -----------------------------------------------------
         DISCORD
      ----------------------------------------------------- */

      const discordClient =
        getDiscordClient(req);

      const guildsCount =
        discordClient?.guilds?.cache?.size || 0;

      const ping =
        typeof discordClient?.ws?.ping === 'number'
          ? discordClient.ws.ping
          : null;

      /* -----------------------------------------------------
         RESPONSE
         
         IMPORTANT :
         On garde les deux niveaux :
         
         bot
         database
         
         afin d'être compatible avec le Dashboard
         existant.
      ----------------------------------------------------- */

      return res.json({
        success: true,

        bot: {
          online:
            Boolean(
              discordClient,
            ),

          guildsCount,

          ping,

          uptime:
            discordClient?.uptime ??
            null,
        },

        database: {
          connected:
            databaseConnected,

          totalUsers,

          totalGuilds:
            totalGuildConfigs,

          totalAiSessions,
        },

        timestamp:
          new Date().toISOString(),
      });

    } catch (error) {
      console.error(
        '[Stats] Erreur /api/stats :',
        error,
      );

      return res.status(500).json({
        success: false,

        error:
          'Impossible de récupérer les statistiques.',

        code:
          'STATS_ERROR',
      });
    }
  },
);

/* =========================================================
   STATS HEALTH
========================================================= */

/**
 * GET /api/stats/health
 */

router.get(
  '/stats/health',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const databaseConnected =
        mongoose.connection.readyState === 1;

      const discordClient =
        getDiscordClient(req);

      const discordOnline =
        Boolean(
          discordClient,
        );

      return res.json({
        success: true,

        status:
          databaseConnected &&
          discordOnline
            ? 'healthy'
            : 'degraded',

        services: {
          database:
            databaseConnected
              ? 'online'
              : 'offline',

          discord:
            discordOnline
              ? 'online'
              : 'offline',
        },

        timestamp:
          new Date().toISOString(),
      });

    } catch (error) {
      console.error(
        '[Stats] Erreur health :',
        error,
      );

      return res.status(500).json({
        success: false,

        status:
          'error',

        error:
          'Impossible de vérifier la santé des services.',
      });
    }
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;