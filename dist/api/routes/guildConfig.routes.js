"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const guildConfig_controller_1 = require("../controllers/guildConfig.controller");
const auth_1 = require("../middlewares/auth");
const guildAuth_1 = require("../middlewares/guildAuth");
const router = (0, express_1.Router)();
// Lecture de la configuration d'un serveur (Sécurisé par JWT + canManageGuild en 0ms)
router.get('/:guildId/config', auth_1.isAuthenticated, guildAuth_1.canManageGuild, guildConfig_controller_1.GuildConfigController.getConfig);
// Mise à jour de la configuration d'un serveur (Sécurisé par JWT + canManageGuild)
router.put('/:guildId/config', auth_1.isAuthenticated, guildAuth_1.canManageGuild, guildConfig_controller_1.GuildConfigController.updateConfig);
exports.default = router;
