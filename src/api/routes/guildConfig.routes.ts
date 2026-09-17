import { Router } from 'express';
import { GuildConfigController } from '../controllers/guildConfig.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';

const router = Router();

// Lecture de la configuration d'un serveur (Sécurisé par JWT + canManageGuild en 0ms)
router.get('/:guildId/config', isAuthenticated as any, canManageGuild as any, GuildConfigController.getConfig);

// Mise à jour de la configuration d'un serveur (Sécurisé par JWT + canManageGuild)
router.put('/:guildId/config', isAuthenticated as any, canManageGuild as any, GuildConfigController.updateConfig);

export default router;