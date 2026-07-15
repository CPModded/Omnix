import { Router } from 'express';
import { GuildsController } from '../controllers/guilds.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';

const router = Router();

// Récupération globale
router.get('/', isAuthenticated as any, GuildsController.getUserGuilds);

// NOUVEAU : Récupération dynamique des salons d'un serveur (Sécurisé par JWT + Admin check)
router.get('/:guildId/channels', isAuthenticated as any, canManageGuild as any, GuildsController.getGuildChannels);

// NOUVEAU : Récupération dynamique des rôles d'un serveur (Sécurisé par JWT + Admin check)
router.get('/:guildId/roles', isAuthenticated as any, canManageGuild as any, GuildsController.getGuildRoles);

export default router;