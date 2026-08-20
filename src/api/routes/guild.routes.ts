import {
  Router,
} from 'express';

import {
  GuildsController,
} from '../controllers/guilds.controller';

import {
  isAuthenticated,
} from '../middlewares/auth';

import {
  canManageGuild,
} from '../middlewares/guildAuth';


const router =
  Router();


/* =========================================================
   LISTE DES SERVEURS
========================================================= */

router.get(
  '/',
  isAuthenticated as any,
  GuildsController.getUserGuilds,
);


/* =========================================================
   SALONS
========================================================= */

router.get(
  '/:guildId/channels',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildChannels,
);


/* =========================================================
   RÔLES
========================================================= */

router.get(
  '/:guildId/roles',
  isAuthenticated as any,
  canManageGuild as any,
  GuildsController.getGuildRoles,
);


export default router;