import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';
import { requirePremium } from '../middlewares/premiumCheck'; // Import du vérificateur Premium

const router = Router();

// Routes sécurisées : Seuls les serveurs Premium peuvent lister, créer ou restaurer des sauvegardes
router.get(
  '/:guildId/backups', 
  isAuthenticated as any, 
  canManageGuild as any, 
  requirePremium as any, // BLOQUE L'ACCÈS WEB SI NON PREMIUM
  BackupController.listBackups
);

router.post(
  '/:guildId/backups', 
  isAuthenticated as any, 
  canManageGuild as any, 
  requirePremium as any, // BLOQUE L'ACCÈS WEB SI NON PREMIUM
  BackupController.createBackup
);

router.post(
  '/:guildId/backups/:backupId/restore', 
  isAuthenticated as any, 
  canManageGuild as any, 
  requirePremium as any, // BLOQUE L'ACCÈS WEB SI NON PREMIUM
  BackupController.restoreBackup
);

export default router;