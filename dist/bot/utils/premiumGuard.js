"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPremium = checkPremium;
const config_1 = require("../../config");
function checkPremium(interaction, guildConfig) {
    if (!guildConfig.premium.isPremium) {
        // Utilisation directe et dynamique du CLIENT_URL configuré
        const dashboardUrl = `${config_1.CONFIG.CLIENT_URL}/founder`;
        interaction.reply({
            content: `❌ **Cette commande est réservée aux serveurs détenteurs d'une licence Premium.**\n\nPour activer les fonctionnalités avancées, rendez-vous sur notre dashboard :\n🔗 ${dashboardUrl}`,
            ephemeral: true
        }).catch(() => null);
        return false;
    }
    return true;
}
