import { ChatInputCommandInteraction } from 'discord.js';
import { IGuildConfig } from '../../models/GuildConfig';
import { CONFIG } from '../../config';

export function checkPremium(interaction: ChatInputCommandInteraction, guildConfig: IGuildConfig): boolean {
  if (!guildConfig.premium.isPremium) {
    // Utilisation directe et dynamique du CLIENT_URL configuré
    const dashboardUrl = `${CONFIG.CLIENT_URL}/founder`;

    interaction.reply({
      content: `❌ **Cette commande est réservée aux serveurs détenteurs d'une licence Premium.**\n\nPour activer les fonctionnalités avancées, rendez-vous sur notre dashboard :\n🔗 ${dashboardUrl}`,
      ephemeral: true
    }).catch(() => null);

    return false;
  }
  return true;
}