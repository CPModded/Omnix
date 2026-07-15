import { Events, ChatInputCommandInteraction } from 'discord.js';
import { ExtendedClient } from '../client';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

const PREMIUM_COMMANDS = ['ai', 'backup', 'stats', 'schedule', 'honeypot']; 

export default {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Cette commande doit être exécutée sur un serveur.",
        ephemeral: true
      });
    }

    try {
      let guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });

      if (!guildConfig) {
        guildConfig = new GuildConfig({ guildId: interaction.guildId });
        await guildConfig.save();
      }

      if (PREMIUM_COMMANDS.includes(interaction.commandName)) {
        const isGuildPremium = guildConfig.premium.isPremium;
        let isMemberPremium = false;
        
        const userDb = await User.findOne({ discordId: interaction.user.id });

        if (userDb) {
          if (userDb.isAdmin) {
            isMemberPremium = true;
          } else {
            const hasUserLicense = userDb.licenses.some(
              lic => lic.status === 'active' && lic.activatedGuildId === null
            );
            if (hasUserLicense) {
              isMemberPremium = true;
            }
          }
        }

        if (!isGuildPremium && !isMemberPremium) {
          const dashboardUrl = `${CONFIG.CLIENT_URL}/founder`;
          
          return interaction.reply({
            content: `❌ **La commande \`/${interaction.commandName}\` est réservée aux abonnés Premium.**\n\nPour débloquer cette option, vous pouvez :\n• Activer le Premium sur ce serveur depuis le Dashboard.\n• Détenir une licence personnelle Premium.\n\n🔗 En savoir plus : ${dashboardUrl}`,
            ephemeral: true
          });
        }
      }

      await command.execute({ interaction, guildConfig });

    } catch (error) {
      console.error(`[Bot Error] Exception sur la commande ${interaction.commandName} (Serveur : ${interaction.guildId}) :`, error);

      const errorText = "❌ Une erreur est survenue lors du traitement de la commande.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorText, ephemeral: true });
      } else {
        await interaction.reply({ content: errorText, ephemeral: true });
      }
    }
  }
};