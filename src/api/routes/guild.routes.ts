import { Router } from 'express';

import { GuildsController } from '../controllers/guilds.controller.ts';
import { isAuthenticated } from '../middlewares/auth.ts';
import { canManageGuild } from '../middlewares/guildAuth.ts';

const router = Router();

/**
 * GET /api/guilds
 */
router.get(
  '/',
  isAuthenticated as any,
  GuildsController.getUserGuilds
);

/**
 * GET /api/guilds/:guildId/channels
 */
router.get(
  '/:guildId/channels',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildChannels
);

/**
 * GET /api/guilds/:guildId/roles
 */
router.get(
  '/:guildId/roles',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildRoles
);

export default router;