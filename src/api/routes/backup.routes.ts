import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';
import { requirePremium } from '../middlewares/premiumCheck';

const router = Router();

// Lister l'historique des sauvegardes (Sécurisé par JWT + canManageGuild + requirePremium)
router.get(
  '/:guildId/backups', 
  isAuthenticated as any, 
  canManageGuild as any, 
  requirePremium as any, 
  BackupController.listBackups
);

// Créer un instantané manuel de sauvegarde (Sécurisé par JWT + canManageGuild + requirePremium)
router.post(
  '/:guildId/backups', 
  isAuthenticated as any, 
  canManageGuild as any, 
  requirePremium as any, 
  BackupController.createBackup
);

// Restaurer une sauvegarde existante (Sécurisé par JWT + canManageGuild + requirePremium)
router.post(
  '/:guildId/backups/:backupId/restore', 
  isAuthenticated as any, 
  canManageGuild as any, 
  requirePremium as any, 
  BackupController.restoreBackup
);

export default router;