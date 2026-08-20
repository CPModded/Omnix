import { Router } from 'express';

import { GuildsController } from '../controllers/guilds.controller.ts';
import { isAuthenticated } from '../middlewares/auth.ts';
import { canManageGuild } from '../middlewares/guildAuth.ts';

const router = Router();

/**
 * GET /api/guilds
 *
 * Récupère les serveurs Discord accessibles
 * par l'utilisateur connecté.
 */
router.get(
  '/',
  isAuthenticated as any,
  GuildsController.getUserGuilds
);

/**
 * GET /api/guilds/:guildId/channels
 *
 * Récupère les salons du serveur.
 */
router.get(
  '/:guildId/channels',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildChannels
);

/**
 * GET /api/guilds/:guildId/roles
 *
 * Récupère les rôles du serveur.
 */
router.get(
  '/:guildId/roles',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildRoles
);

export default router;