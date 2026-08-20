import { Router } from 'express';

import { GuildsController } from '../controllers/guilds.controller.ts';
import { isAuthenticated } from '../middlewares/auth.ts';
import { canManageGuild } from '../middlewares/guildAuth.ts';

/* =========================================================
   ROUTER
========================================================= */

const router = Router();

/* =========================================================
   GLOBAL GUILDS
========================================================= */

/**
 * GET /api/guilds
 *
 * Retourne les serveurs Discord accessibles
 * par l'utilisateur connecté.
 *
 * Protection :
 * - JWT / session
 * - utilisateur authentifié
 */
router.get(
  '/',
  isAuthenticated as any,
  GuildsController.getUserGuilds
);

/* =========================================================
   GUILD CHANNELS
========================================================= */

/**
 * GET /api/guilds/:guildId/channels
 *
 * Retourne les salons du serveur.
 *
 * Protection :
 * - utilisateur authentifié
 * - vérification des permissions sur le serveur
 */
router.get(
  '/:guildId/channels',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildChannels
);

/* =========================================================
   GUILD ROLES
========================================================= */

/**
 * GET /api/guilds/:guildId/roles
 *
 * Retourne les rôles du serveur.
 *
 * Protection :
 * - utilisateur authentifié
 * - vérification des permissions sur le serveur
 */
router.get(
  '/:guildId/roles',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildRoles
);

/* =========================================================
   EXPORT
========================================================= */

export default router;