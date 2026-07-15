/**
 * ====================================================================
 * COMMANDES DE GESTION DES TICKETS (VERSION DYNAMIQUE SAAS)
 * ====================================================================
 */

import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChannelType, 
  PermissionFlagsBits as DiscordPermissions,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
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
        .setDescription('Ouvrir un salon de support privé standard')
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
        .setDescription('Déployer le panneau de tickets configuré (Premium Only)')
        .addChannelOption(opt => opt.setName('channel').setDescription('Salon de réception du panneau').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('custom')
        .setDescription('Lister l\'intégralité des catégories actives et leur routage')
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

    if (!guildConfig.modules.tickets.enabled) {
      return interaction.reply({
        content: "❌ Le module de tickets est désactivé sur ce serveur.",
        ephemeral: true
      });
    }

    const isUserPremium = CONFIG_OWNERS_IDS_CHECK(userId) || guildConfig.premium.isPremium;
    if (['setup', 'transcript'].includes(subcommand) && !isUserPremium) {
      return interaction.reply({
        content: "❌ **Cette fonctionnalité requiert un abonnement OMNIX Premium.**",
        ephemeral: true
      });
    }

    // ==========================================
    // SCÉNARIO 1 : DÉPLOYER LE PANNEAU DYNAMIQUE (PREMIUM)
    // ==========================================
    if (subcommand === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel', true) as TextChannel;

      try {
        const categories = guildConfig.modules.tickets.categoriesList || [];

        if (categories.length === 0) {
          return interaction.editReply({
            content: "❌ Aucune catégorie n'est configurée pour ce serveur. Configurez-les depuis le Dashboard OMNIX."
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('🎫 Besoin d\'aide ?')
          .setDescription('Choisissez votre demande :')
          .setColor(0x06b6d4)
          .setFooter({ text: 'Système d\'assistance automatisé d\'OMNIX' });

        // Génération DYNAMIQUE du menu de sélection à partir de la base de données
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('ticket_select_menu')
          .setPlaceholder('Sélectionnez le motif de votre demande...');

        categories.forEach(cat => {
          selectMenu.addOptions({
            label: cat.name,
            value: `ticket_${cat.id}`,
            emoji: cat.emoji || '🎫',
            description: cat.welcomeMessage.slice(0, 50) + '...' // Extrait la description pour l'échanger
          });
        });

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await channel.send({ embeds: [embed], components: [row] });
        return interaction.editReply({ content: `✅ Panneau de tickets dynamiques déployé dans le salon ${channel}.` });

      } catch (error: any) {
        console.error('[Ticket Setup Error] :', error.message);
        return interaction.editReply({ content: "❌ Échec de la configuration." });
      }
    }

    // ==========================================
    // SCÉNARIO 2 : LISTER LES CATÉGORIES (DÉBOGAGE)
    // ==========================================
    if (subcommand === 'custom') {
      const categories = guildConfig.modules.tickets.categoriesList || [];
      if (categories.length === 0) {
        return interaction.reply({ content: "ℹ️ Aucune catégorie enregistrée.", ephemeral: true });
      }

      const listText = categories.map((c, i) => {
        return `**${i + 1}.** ${c.emoji} **${c.name}** (ID: \`${c.id}\`) — Routage : \`${c.type.toUpperCase()}\``;
      }).join('\n');

      return interaction.reply({
        content: `📂 **Catégories de tickets actives sur ce serveur :**\n\n${listText}\n\n*Configurez, ajoutez ou supprimez des catégories depuis l'interface web.*`,
        ephemeral: true
      });
    }

    // ==========================================
    // SÉLECTION DE SOUS-COMMANDES TRADITIONNELLES
    // ==========================================
    if (subcommand === 'open') {
      await interaction.deferReply({ ephemeral: true });
      guildConfig.modules.tickets.counter += 1;
      await guildConfig.save();

      const ticketNumber = guildConfig.modules.tickets.counter;
      const channelName = `ticket-general-${ticketNumber.toString().padStart(4, '0')}`;

      try {
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: guildConfig.modules.tickets.categoryId || undefined,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [DiscordPermissions.ViewChannel] },
            { id: userId, allow: [DiscordPermissions.ViewChannel, DiscordPermissions.SendMessages, DiscordPermissions.ReadMessageHistory] }
          ]
        });

        await ticketChannel.send({ content: `👋 <@${userId}>, bienvenue dans votre salon de support.` });
        return interaction.editReply({ content: `✅ Ticket créé : ${ticketChannel}` });
      } catch (error) {
        return interaction.editReply({ content: "❌ Échec de la création." });
      }
    }

    if (subcommand === 'close') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-') && !channel.isThread()) {
        return interaction.reply({ content: "❌ Vous devez être dans un salon de ticket.", ephemeral: true });
      }
      await interaction.reply({ content: "🔒 **Fermeture du ticket en cours...**" });
      await channel.permissionOverwrites.edit(userId, { SendMessages: false }).catch(() => null);
    }

    if (subcommand === 'add') {
      const channel = interaction.channel as TextChannel;
      const target = interaction.options.getMember('target') as GuildMember;
      await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true }).catch(() => null);
      return interaction.reply({ content: `✅ <@${target.id}> ajouté.` });
    }

    if (subcommand === 'remove') {
      const channel = interaction.channel as TextChannel;
      const target = interaction.options.getMember('target') as GuildMember;
      await channel.permissionOverwrites.delete(target.id).catch(() => null);
      return interaction.reply({ content: `🗑️ <@${target.id}> retiré.` });
    }

    if (subcommand === 'delete') {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith('ticket-') && !channel.isThread()) {
        return interaction.reply({ content: "❌ Vous devez être dans un salon de ticket.", ephemeral: true });
      }
      await interaction.reply({ content: "🗑️ **Suppression définitive...**" });
      setTimeout(() => { channel.delete().catch(() => null); }, 2000);
    }

    if (subcommand === 'transcript') {
      const channel = interaction.channel as TextChannel;
      await interaction.deferReply();
      const messages = await channel.messages.fetch({ limit: 100 });
      const sortedMessages = [...messages.values()].reverse();

      let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Transcript</title></head><body style="background:#1e1f22; color:#dbdee1; padding:20px;">`;
      sortedMessages.forEach(msg => {
        html += `<p><b>${msg.author.tag}</b> [${msg.createdAt.toLocaleString('fr-FR')}]: ${msg.content}</p>`;
      });
      html += `</body></html>`;

      const buffer = Buffer.from(html, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });
      return interaction.editReply({ files: [attachment] });
    }
  }
};

function CONFIG_OWNERS_IDS_CHECK(userId: string): boolean {
  return (process.env.DISCORD_OWNER_IDS ? process.env.DISCORD_OWNER_IDS.split(',') : []).includes(userId);
}

export default ticketCommand;