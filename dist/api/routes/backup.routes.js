"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const backup_controller_1 = require("../controllers/backup.controller");
const auth_1 = require("../middlewares/auth");
const guildAuth_1 = require("../middlewares/guildAuth");
const premiumCheck_1 = require("../middlewares/premiumCheck");
const router = (0, express_1.Router)();
// Lister l'historique des sauvegardes (Sécurisé par JWT + canManageGuild + requirePremium)
router.get('/:guildId/backups', auth_1.isAuthenticated, guildAuth_1.canManageGuild, premiumCheck_1.requirePremium, backup_controller_1.BackupController.listBackups);
// Créer un instantané manuel de sauvegarde (Sécurisé par JWT + canManageGuild + requirePremium)
router.post('/:guildId/backups', auth_1.isAuthenticated, guildAuth_1.canManageGuild, premiumCheck_1.requirePremium, backup_controller_1.BackupController.createBackup);
// Restaurer une sauvegarde existante (Sécurisé par JWT + canManageGuild + requirePremium)
router.post('/:guildId/backups/:backupId/restore', auth_1.isAuthenticated, guildAuth_1.canManageGuild, premiumCheck_1.requirePremium, backup_controller_1.BackupController.restoreBackup);
exports.default = router;
