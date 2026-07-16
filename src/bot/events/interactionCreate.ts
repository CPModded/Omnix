/**
 * ====================================================================
 * GESTIONNAIRE D'INTERACTIONS GLOBAL (BOT DISCORD - DYNAMIQUE SAAS)
 * ====================================================================
 */

import { 
  Events, 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  StringSelectMenuInteraction, 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder,
  TextChannel
} from 'discord.js';
import { ExtendedClient } from '../client';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

const PREMIUM_COMMANDS = ['ai', 'backup', 'stats', 'schedule', 'honeypot']; 

export default {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient) {
    
    // ----------------------------------------------------
    // SYSTEME DE VERIFICATION (ACCEPTATION DU REGLEMENT)
    // ----------------------------------------------------
    if (interaction.isButton() && interaction.customId === 'rules_accept_button') {
      await interaction.deferReply({ ephemeral: true });

      // Ce rôle "Verified" sera attribué dynamiquement s'il existe sur le serveur
      const member = interaction.member as any;
      const verifiedRole = interaction.guild?.roles.cache.find(r => r.name === 'Verified');

      try {
        if (!verifiedRole) {
          return interaction.editReply({ content: "⚠️ Le rôle 'Verified' n'existe pas encore sur ce serveur. Demandez à un administrateur d'exécuter la commande `/build`." });
        }

        if (member.roles.cache.has(verifiedRole.id)) {
          return interaction.editReply({ content: "ℹ️ Vous possédez déjà le rôle de vérification." });
        }

        await member.roles.add(verifiedRole.id);
        return interaction.editReply({ content: "✅ **Règlement accepté !** Vous avez reçu le rôle **Verified** et débloqué l'accès complet au serveur." });
      } catch (err: any) {
        console.error('[Rules Verification Error] :', err.message);
        return interaction.editReply({ content: "❌ Impossible de mettre à jour vos rôles de vérification." });
      }
    }

    // ----------------------------------------------------
    // SCÉNARIO A : COMPORTEMENT DU SÉLECTEUR DE TICKETS DYNAMIQUE
    // ----------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild!;
      const userId = interaction.user.id;
      const selectValue = interaction.values[0]; // ex: ticket_support_tech
      
      const categoryId = selectValue.replace('ticket_', ''); // support_tech

      try {
        let guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });
        if (!guildConfig) {
          guildConfig = new GuildConfig({ guildId: interaction.guildId });
          await guildConfig.save();
        }

        // Recherche de la catégorie correspondante dans le tableau de la base de données
        const categoriesList = guildConfig.modules.tickets.categoriesList || [];
        const catConfig = categoriesList.find(c => c.id === categoryId);

        if (!catConfig) {
          return interaction.editReply({ content: "❌ Cette catégorie n'est plus disponible sur ce serveur." });
        }

        guildConfig.modules.tickets.counter += 1;
        await guildConfig.save();

        const counter = guildConfig.modules.tickets.counter;
        const channelName = `ticket-${catConfig.id}-${counter.toString().padStart(4, '0')}`;

        // Remplacement de la variable {user} par la mention du joueur dans le message d'accueil personnalisé
        const customWelcomeText = catConfig.welcomeMessage.replace(/{user}/g, `<@${userId}>`);

        // --- ROUTE 1 : OUVERTURE EN FIL PRIVÉ (THREAD) ---
        if (catConfig.type === 'thread' && catConfig.targetId) {
          const parentChannel = guild.channels.cache.get(catConfig.targetId) as TextChannel;
          if (parentChannel) {
            const thread = await parentChannel.threads.create({
              name: channelName,
              type: ChannelType.PrivateThread,
              reason: 'OMNIX Ticket Support'
            });
            await thread.members.add(userId);
            
            await thread.send({ content: `${catConfig.emoji} ${customWelcomeText}` });
            return interaction.editReply({ content: `✅ Votre fil de discussion privé a été ouvert : <#${thread.id}>` });
          }
        }

        // --- ROUTE 2 : OUVERTURE EN SALON UNIQUE ---
        let parentCategory = catConfig.type === 'category' ? catConfig.targetId : null;
        if (!parentCategory) {
          parentCategory = guildConfig.modules.tickets.categoryId; // Catégorie de repli par défaut
        }

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategory || undefined,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
          ]
        });

        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`${catConfig.emoji} BESOIN D'AIDE — ${catConfig.name.toUpperCase()}`)
          .setDescription(customWelcomeText)
          .setColor(0x06b6d4)
          .setFooter({ text: "OMNIX Support" });

        await ticketChannel.send({ embeds: [welcomeEmbed] });
        return interaction.editReply({ content: `✅ Votre salon de ticket privé a été créé : ${ticketChannel}` });

      } catch (err: any) {
        console.error('[Bot Ticket select Menu Error] :', err.message);
        return interaction.editReply({ content: "❌ Impossible d'initialiser votre salon de support." });
      }
    }

    // ----------------------------------------------------
    // SCÉNARIO B : COMPORTEMENT DES COMMANDES SLASH STANDARD
    // ----------------------------------------------------
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      let guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId! });

      if (!guildConfig) {
        guildConfig = new GuildConfig({ guildId: interaction.guildId! });
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
            content: `❌ **La commande \`/${interaction.commandName}\` est réservée aux abonnés Premium.**\n\n🔗 En savoir plus : ${dashboardUrl}`,
            ephemeral: true
          });
        }
      }

      await command.execute({ interaction, guildConfig });

    } catch (error) {
      console.error(`[Bot Error] Exception sur la commande ${interaction.commandName} :`, error);
      const errorText = "❌ Une erreur est survenue lors du traitement de la commande.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorText, ephemeral: true });
      } else {
        await interaction.reply({ content: errorText, ephemeral: true });
      }
    }
  }
};