/**
 * ====================================================================
 * GESTIONNAIRE D'INTERACTIONS GLOBAL (BOT DISCORD)
 * Gère l'intercepteur de commandes et de boutons de Tickets.
 * ====================================================================
 */

import { Events, ChatInputCommandInteraction, ButtonInteraction, ChannelType, PermissionFlagsBits } from 'discord.js';
import { ExtendedClient } from '../client';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

const PREMIUM_COMMANDS = ['ai', 'backup', 'stats', 'schedule', 'honeypot']; 

export default {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction | ButtonInteraction, client: ExtendedClient) {
    
    // ----------------------------------------------------
    // SCÉNARIO A : COMPORTEMENT DES BOUTONS DE TICKETS (INTERACTIF)
    // ----------------------------------------------------
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_open_btn') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild!;
        const userId = interaction.user.id;

        try {
          // Chargement de la configuration
          let guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });
          if (!guildConfig) {
            guildConfig = new GuildConfig({ guildId: interaction.guildId });
            await guildConfig.save();
          }

          // Vérifie si le module de ticket est actif en base
          if (!guildConfig.modules.tickets.enabled) {
            return interaction.editReply({ content: "❌ Le module de support par ticket est actuellement désactivé sur ce serveur." });
          }

          // Incrémente le compteur
          guildConfig.modules.tickets.counter += 1;
          await guildConfig.save();

          const ticketNumber = guildConfig.modules.tickets.counter;
          const channelName = `ticket-${ticketNumber.toString().padStart(4, '0')}`;

          // Création du salon textuel privé
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: guildConfig.modules.tickets.categoryId || undefined,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: userId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              }
            ]
          });

          await ticketChannel.send({
            content: `👋 Bonjour <@${userId}>, bienvenue dans votre salon de support.\nDécrivez votre demande, un membre de l'équipe va vous répondre.`
          });

          return interaction.editReply({ content: `✅ Votre ticket a été créé avec succès : ${ticketChannel}` });

        } catch (err: any) {
          console.error('[Bot Ticket Button Error] :', err.message);
          return interaction.editReply({ content: "❌ Échec de la création de votre salon de ticket de support." });
        }
      }
      return;
    }

    // ----------------------------------------------------
    // SCÉNARIO B : COMPORTEMENT DES COMMANDES SLASH STANDARD
    // ----------------------------------------------------
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

      // VÉRIFICATION DE LA SÉCURITÉ PREMIUM
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