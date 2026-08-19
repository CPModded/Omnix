import express, {
  type Request,
  type Response,
} from 'express';

import { User } from '../../models/User.ts';

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

/**
 * Nombre de commandes OMNIX.
 *
 * Temporairement récupéré depuis :
 *
 * OMNIX_COMMAND_COUNT
 *
 * Exemple Render :
 *
 * OMNIX_COMMAND_COUNT=1420
 *
 * Plus tard, cette valeur pourra être remplacée
 * par le vrai nombre de commandes chargées par le bot.
 */
const configuredCommandCount = Number(
  process.env.OMNIX_COMMAND_COUNT || '0'
);

/* =========================================================
   TEMPS DE DÉMARRAGE
========================================================= */

/**
 * Date de démarrage du processus Node.
 *
 * Cette valeur sert uniquement à calculer
 * l'uptime du processus actuel.
 */
const startedAt = Date.now();

/* =========================================================
   UPTIME
========================================================= */

/**
 * Retourne l'état actuel du processus.
 *
 * IMPORTANT :
 *
 * Cette fonction ne prétend pas calculer
 * l'uptime historique de Render.
 *
 * Elle indique simplement que le processus
 * OMNIX fonctionne actuellement.
 */
function getUptime(): number {
  const elapsed = Date.now() - startedAt;

  if (elapsed >= 0) {
    return 100;
  }

  return 0;
}

/* =========================================================
   STATISTIQUES PUBLIQUES
========================================================= */

/**
 * GET
 *
 * /api/stats
 *
 * Cette route est PUBLIQUE.
 *
 * Aucun JWT n'est nécessaire.
 *
 * Elle est utilisée par :
 *
 * - la page d'accueil
 * - les cartes statistiques
 * - les statistiques générales OMNIX
 */
router.get(
  '/api/stats',
  async (
    req: Request,
    res: Response
  ) => {
    const requestStartedAt = Date.now();

    try {
      /* =====================================================
         UTILISATEURS OMNIX
      ===================================================== */

      /**
       * Nombre total d'utilisateurs enregistrés
       * dans MongoDB.
       */
      const totalUsers =
        await User.countDocuments();

      /* =====================================================
         SERVEURS DISCORD
      ===================================================== */

      /**
       * On récupère uniquement le champ guilds.
       *
       * Cela évite de charger inutilement
       * toutes les données utilisateurs.
       */
      const users =
        await User.find(
          {},
          {
            guilds: 1,
          }
        ).lean();

      /**
       * Set permettant d'éviter les doublons.
       *
       * Exemple :
       *
       * User A → serveur 123
       * User B → serveur 123
       *
       * Le serveur 123 ne sera compté qu'une fois.
       */
      const guildIds =
        new Set<string>();

      for (const user of users) {
        const guilds =
          Array.isArray(
            (user as any).guilds
          )
            ? (user as any).guilds
            : [];

        for (const guild of guilds) {
          const guildId =
            String(
              guild?.id || ''
            ).trim();

          if (guildId) {
            guildIds.add(guildId);
          }
        }
      }

      const guildsCount =
        guildIds.size;

      /* =====================================================
         LATENCE
      ===================================================== */

      /**
       * Temps nécessaire pour construire
       * la réponse statistique.
       *
       * Ce n'est PAS encore la vraie latence
       * WebSocket du bot Discord.
       */
      const latency =
        Date.now() -
        requestStartedAt;

      /* =====================================================
         UPTIME
      ===================================================== */

      const uptime =
        getUptime();

      /* =====================================================
         COMMANDES
      ===================================================== */

      const commands =
        Number.isFinite(
          configuredCommandCount
        )
          ? configuredCommandCount
          : 0;

      /* =====================================================
         RÉPONSE
      ===================================================== */

      return res.json({
        success: true,

        bot: {
          /**
           * Nombre de serveurs connus
           * dans MongoDB.
           */
          guildsCount,

          /**
           * Latence actuelle de la requête API.
           */
          ping: latency,

          /**
           * État du processus.
           */
          uptime,
        },

        database: {
          /**
           * Nombre d'utilisateurs OMNIX.
           */
          totalUsers,

          /**
           * Temps de réponse MongoDB/API.
           */
          latency,
        },

        /**
         * Nombre de commandes configuré.
         */
        commands,
      });
    } catch (error) {
      /* =====================================================
         ERREUR
      ===================================================== */

      console.error(
        '[Public Stats]',
        error
      );

      /**
       * On renvoie volontairement HTTP 200
       * avec success:false.
       *
       * Pourquoi ?
       *
       * Pour que le frontend puisse distinguer :
       *
       * API disponible
       * +
       * statistiques momentanément indisponibles
       *
       * d'une véritable panne HTTP.
       */
      return res.status(200).json({
        success: false,

        bot: {
          guildsCount: 0,

          ping: 0,

          uptime: 100,
        },

        database: {
          totalUsers: 0,

          latency: 0,
        },

        commands: 0,

        error:
          'Statistiques temporairement indisponibles.',
      });
    }
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

/**
 * GET
 *
 * /api/stats/health
 *
 * Petite route permettant de vérifier rapidement
 * que l'API publique fonctionne.
 */
router.get(
  '/api/stats/health',
  (
    req: Request,
    res: Response
  ) => {
    return res.json({
      success: true,

      status: 'online',

      uptime: getUptime(),

      timestamp:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;