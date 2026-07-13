/**
 * ====================================================================
 * GESTIONNAIRE D'INTERACTIONS GLOBAL (BOT DISCORD)
 * Intercepte, valide et applique l'isolation de données ainsi que la
 * sécurité Premium pour toutes les commandes.
 * ====================================================================
 */

import { Events, ChatInputCommandInteraction } from 'discord.js';
import { ExtendedClient } from '../client';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

// Liste des commandes restreintes au Premium
const PREMIUM_COMMANDS = ['ai', 'backup', 'stats', 'schedule']; 

export default {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Isolation Multi-Tenant : Blocage si la commande est lancée hors d'un serveur (MP)
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Cette commande doit être exécutée sur un serveur.",
        ephemeral: true
      });
    }

    try {
      // 1. Chargement de la configuration propre à ce serveur (Multi-Tenant)
      let guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });

      if (!guildConfig) {
        guildConfig = new GuildConfig({ guildId: interaction.guildId });
        await guildConfig.save();
      }

      // 2. VÉRIFICATION DE LA SÉCURITÉ PREMIUM
      if (PREMIUM_COMMANDS.includes(interaction.commandName)) {
        
        // A. Vérification de la licence du Serveur (Guild Premium)
        const isGuildPremium = guildConfig.premium.isPremium;

        // B. Vérification de la licence personnelle du Membre (User Premium)
        let isMemberPremium = false;
        const userDb = await User.findOne({ discordId: interaction.user.id });

        if (userDb) {
          // Un administrateur du bot (Owner) contourne automatiquement les restrictions
          if (userDb.isAdmin) {
            isMemberPremium = true;
          } else {
            // On vérifie si l'utilisateur possède une licence active d'utilisateur (non liée à un serveur)
            const hasUserLicense = userDb.licenses.some(
              lic => lic.status === 'active' && lic.activatedGuildId === null
            );
            if (hasUserLicense) {
              isMemberPremium = true;
            }
          }
        }

        // C. Blocage si ni le serveur ni le membre n'ont le Premium
        if (!isGuildPremium && !isMemberPremium) {
          const dashboardUrl = `${CONFIG.CLIENT_URL}/founder`;
          
          return interaction.reply({
            content: `❌ **La commande \`/${interaction.commandName}\` est réservée aux abonnés Premium.**\n\nPour débloquer cette option, vous pouvez :\n• Activer le Premium sur ce serveur depuis le Dashboard.\n• Détenir une licence personnelle Premium.\n\n🔗 En savoir plus : ${dashboardUrl}`,
            ephemeral: true
          });
        }
      }

      // 3. Exécution de la commande avec son contexte isolé
      await command.execute({ interaction, guildConfig });

    } catch (error) {
      console.error(`[Bot Error] Exception sur la commande ${interaction.commandName} (Serveur : ${interaction.guildId}) :`, error);

      const errorText = "Une erreur est survenue lors du traitement de la commande.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorText, ephemeral: true });
      } else {
        await interaction.reply({ content: errorText, ephemeral: true });
      }
    }
  }
};