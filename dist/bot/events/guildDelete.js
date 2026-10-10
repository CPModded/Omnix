"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const platformEvents_1 = require("../../services/platformEvents");
exports.default = {
    name: discord_js_1.Events.GuildDelete,
    async execute(guild) {
        console.log(`[Bot Sync] 📤 OMNIX a quitté le serveur : ${guild.name} (${guild.id})`);
        try {
            const config = await GuildConfig_1.default.findOne({
                guildId: guild.id,
            });
            if (!config) {
                console.log(`[Bot Sync] ℹ️ Aucune configuration trouvée pour ${guild.id}.`);
                return;
            }
            /*
             * IMPORTANT :
             * On ne supprime PAS automatiquement la configuration.
             *
             * Cela permet de conserver :
             * - statistiques
             * - historique
             * - configuration
             * - données Premium
             * - informations du serveur
             *
             * Si tu veux plus tard un système de purge,
             * on pourra l'ajouter séparément.
             */
            await (0, platformEvents_1.recordPlatformEvent)('guild_removed', { guildId: guild.id, userId: guild.ownerId, metadata: { name: guild.name } });
            console.log(`[Bot Sync] 💾 Configuration conservée pour ${guild.name}.`);
        }
        catch (error) {
            console.error(`[Bot Sync Error] Impossible de traiter le départ de ${guild.name}:`, error);
        }
    },
};
