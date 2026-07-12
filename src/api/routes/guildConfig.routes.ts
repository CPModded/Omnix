import { Router } from 'express';
import { GuildConfigController } from '../controllers/guildConfig.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';

const router = Router();

// Routes sécurisées par JWT et vérification des droits admin
router.get('/:guildId/config', isAuthenticated as any, canManageGuild as any, GuildConfigController.getConfig);
router.put('/:guildId/config', isAuthenticated as any, canManageGuild as any, GuildConfigController.updateConfig);

export default router;