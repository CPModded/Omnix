/**
 * ====================================================================
 * MODULE DE TICKETS SUPPORT (OMNIX SUPPORT CORE - AVEC TRANSCRIPT)
 * ====================================================================
 */

import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChannelType, 
  PermissionFlagsBits as DiscordPermissions,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  TextChannel,
  GuildMember
} from 'discord.js';
import { Command, CommandContext } from '../types';

const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gérer le système de tickets de support du serveur')
    .addSubcommand(sub =>
      sub.setName('open')
        .setDescription('Ouvrir un nouveau salon de support privé')
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Fermer temporairement le ticket actuel')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Ajouter un utilisateur au ticket de support')
        .addUserOption(opt => opt.setName('target').setDescription('Membre à ajouter').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Retirer un utilisateur du ticket de support')
        .addUserOption(opt => opt.setName('target').setDescription('Membre à retirer').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Déployer le panneau de création de ticket (Premium Only)')
        .addChannelOption(opt => opt.setName('channel').setDescription('Salon de réception du panneau').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addChannelOption(opt => opt.setName('category').setDescription('Catégorie d\'ouverture des tickets').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
    )
    .addSubcommand(sub =>
      sub.setName('transcript')
        .setDescription('Générer la transcription écrite du ticket (Premium Only)')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Supprimer définitivement le salon de ticket actuel')
    ) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const userId = interaction.user.id;

    // 0. VÉRIFICATION GLOBALE : Le module de ticket est-il actif en base ?
    if (!guildConfig.modules.tickets.enabled) {
      return interaction.reply({
        content: "❌ Le module de tickets de support est désactivé sur ce serveur. Activez-le sur la console OMNIX.",
        ephemeral: true
      });
    }

    // ==========================================
    // SÉCURITÉ PREMIUM BYPASS POUR LES SOU-COMMANDES PAYANTES
    // ==========================================
    const isUserPremium = interaction.user.id && (CONFIG_OWNERS_IDS_CHECK(userId) || guildConfig.premium.isPremium);
    
    if (['setup', 'transcript'].includes(subcommand) && !isUserPremium) {
      return interaction.reply({
        content: "❌ **Cette fonctionnalité est réservée aux abonnés Premium.**\nActivez le Premium sur votre compte ou votre serveur pour l'utiliser.",
        ephemeral: true
      });
    }

    // ==========================================
    // SCÉNARIO 1 : OUVRIR UN TICKET (FREE)
    // ==========================================
    if (subcommand === 'open') {
      await interaction.deferReply({ ephemeral: true });

      guildConfig.modules.tickets.counter += 1;
      await guildConfig.save();

      const ticketNumber = guildConfig.modules.tickets.counter;
      const channelName = `ticket-${ticketNumber.toString().padStart(4, '0')}`;

      try {
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: guildConfig.modules.tickets.categoryId || undefined, // Catégorie configurée sur la console
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [DiscordPermissions.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                DiscordPermissions.ViewChannel,
                DiscordPermissions.SendMessages,
                DiscordPermissions.ReadMessageHistory
              ]
            }
          ]
        });

        await ticketChannel.send({
          content: `👋 Bonjour <@${interaction.user.id}>, bienvenue dans votre salon de support.\nDécrivez votre demande de manière précise, un membre du personnel va vous répondre.`
        });

        return interaction.editReply({
          content: `✅ Votre ticket a été créé avec succès : ${ticketChannel}`
        });

      } catch (error: any) {
        console.error('[Ticket Command Open Error] :', error.message);
        return interaction.editReply({ content: "❌ Impossible de créer le salon de support." });
      }
    }

    // ==========================================
    // SCÉNARIO 2 : FERMER UN TICKET (FREE)
    // ==========================================
    if (subcommand === 'close') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: "❌ Cette commande peut uniquement être exécutée à l'intérieur d'un salon de ticket.", ephemeral: true });
      }

      await interaction.reply({ content: "🔒 **Fermeture du ticket en cours...**\nLe salon va être verrouillé pour l'écriture." });

      try {
        // Recherche de l'auteur du ticket (celui qui a les permissions d'écriture)
        const permissionOverwrites = channel.permissionOverwrites.cache;
        for (const [id, overwrite] of permissionOverwrites) {
          if (id !== guild.roles.everyone.id && id !== guild.members.me!.id) {
            // On bloque l'écriture pour l'utilisateur
            await channel.permissionOverwrites.edit(id, {
              SendMessages: false,
              ViewChannel: true,
              ReadMessageHistory: true
            });
          }
        }
        return channel.send({ content: "🔒 **Ticket Fermé.**\nUtilisez la commande `/ticket delete` pour supprimer le salon." });
      } catch (error: any) {
        return channel.send({ content: "❌ Impossible de verrouiller les permissions d'écriture." });
      }
    }

    // ==========================================
    // SCÉNARIO 3 : AJOUTER UN MEMBRE (FREE)
    // ==========================================
    if (subcommand === 'add') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: "❌ Vous devez être dans un salon de ticket.", ephemeral: true });
      }

      const target = interaction.options.getMember('target') as GuildMember;
      if (!target) {
        return interaction.reply({ content: "❌ Utilisateur introuvable sur le serveur.", ephemeral: true });
      }

      try {
        await channel.permissionOverwrites.edit(target.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
        return interaction.reply({ content: `✅ <@${target.id}> a été ajouté au ticket de support.` });
      } catch (error: any) {
        return interaction.reply({ content: "❌ Impossible d'ajouter le membre.", ephemeral: true });
      }
    }

    // ==========================================
    // SCÉNARIO 4 : RETIRER UN MEMBRE (FREE)
    // ==========================================
    if (subcommand === 'remove') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: "❌ Vous devez être dans un salon de ticket.", ephemeral: true });
      }

      const target = interaction.options.getMember('target') as GuildMember;
      if (!target) {
        return interaction.reply({ content: "❌ Utilisateur introuvable.", ephemeral: true });
      }

      try {
        await channel.permissionOverwrites.delete(target.id);
        return interaction.reply({ content: `🗑️ <@${target.id}> a été retiré du ticket.` });
      } catch (error: any) {
        return interaction.reply({ content: "❌ Impossible de retirer le membre.", ephemeral: true });
      }
    }

    // ==========================================
    // SCÉNARIO 5 : DÉPLOYER LE PANNEAU DE CRÉATION (PREMIUM)
    // ==========================================
    if (subcommand === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const category = interaction.options.getChannel('category', true);

      try {
        // Sauvegarde de l'ID de catégorie
        guildConfig.modules.tickets.categoryId = category.id;
        await guildConfig.save();

        const embed = new EmbedBuilder()
          .setTitle('🎫 SUPPORT TECHNIQUE OMNIX')
          .setDescription('Besoin d\'aide ou d\'entrer en contact avec nos équipes ?\nCliquez sur le bouton bleu ci-dessous pour ouvrir un salon privé.')
          .setColor(0x06b6d4)
          .setFooter({ text: 'Système d\'assistance automatisé d\'OMNIX' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_open_btn')
            .setLabel('Ouvrir un ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [row] });
        return interaction.editReply({ content: `✅ Panneau de tickets déployé avec succès dans le salon ${channel}.` });

      } catch (error: any) {
        console.error('[Ticket Setup Error] :', error.message);
        return interaction.editReply({ content: "❌ Échec de la configuration du panneau de tickets." });
      }
    }

    // ==========================================
    // SCÉNARIO 6 : GÉNÉRER UNE TRANSCRIPTION (PREMIUM)
    // ==========================================
    if (subcommand === 'transcript') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: "❌ Vous devez être dans un salon de ticket.", ephemeral: true });
      }

      await interaction.deferReply();

      try {
        // Récupération des 100 derniers messages
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = [...messages.values()].reverse();

        // Template HTML de transcription imitant Discord (Glassmorphic)
        let html = `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <title>Transcription - OMNIX Support</title>
            <style>
              body { background-color: #1e1f22; color: #dbdee1; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; margin: 0; }
              .container { max-width: 800px; margin: 0 auto; background-color: #2b2d31; border: 1px solid rgba(255,255,255,0.03); border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
              .header { border-bottom: 1px solid #35363c; padding-bottom: 16px; margin-bottom: 24px; }
              .title { font-size: 20px; font-weight: 800; color: white; }
              .sub { font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
              .message { display: flex; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.01); padding-bottom: 16px; }
              .avatar { width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.05); object-fit: cover; }
              .username { font-weight: 700; font-size: 14px; color: #ffffff; }
              .time { font-size: 10px; color: #94a3b8; margin-left: 8px; font-weight: 500; }
              .content { font-size: 13.5px; color: #dbdee1; margin-top: 6px; white-space: pre-wrap; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <span class="title">Transcription du Salon : ${channel.name}</span>
                <p class="sub">OMNIX AUTOMATED TRANSCRIPT — Date : ${new Date().toLocaleDateString('fr-FR')}</p>
              </div>
        `;

        sortedMessages.forEach(msg => {
          const avatarUrl = msg.author.displayAvatarURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
          const dateStr = msg.createdAt.toLocaleString('fr-FR');
          html += `
            <div class="message">
              <img src="${avatarUrl}" class="avatar" alt="Avatar">
              <div>
                <span class="username">${msg.author.tag}</span>
                <span class="time">${dateStr}</span>
                <div class="content">${msg.content || '[Fichier ou Embed Discord]'}</div>
              </div>
            </div>
          `;
        });

        html += `</div></body></html>`;

        const buffer = Buffer.from(html, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });

        return interaction.editReply({
          content: "📄 **Transcription HTML générée avec succès !**",
          files: [attachment]
        });

      } catch (error: any) {
        console.error('[Transcript Generation Error] :', error.message);
        return interaction.editReply({ content: "❌ Impossible de générer la transcription." });
      }
    }

    // ==========================================
    // SCÉNARIO 7 : SUPPRIMER DÉFINITIVEMENT LE TICKET (FREE)
    // ==========================================
    if (subcommand === 'delete') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: "❌ Vous devez être dans un salon de ticket.", ephemeral: true });
      }

      await interaction.reply({ content: "🗑️ **Suppression définitive du salon dans 3 secondes...**" });

      setTimeout(() => {
        channel.delete().catch(() => null);
      }, 3000);
    }
  }
};

// Fonction de secours interne pour valider les administrateurs globaux (DISCORD_OWNER_IDS)
function CONFIG_OWNERS_IDS_CHECK(userId: string): boolean {
  return (global as any).CONFIG_OWNERS || (process.env.DISCORD_OWNER_IDS ? process.env.DISCORD_OWNER_IDS.split(',') : []).includes(userId);
}

export default ticketCommand;