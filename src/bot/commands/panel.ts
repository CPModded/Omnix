import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../utils/guildConfig';
import GuildTicket from '../../models/GuildTicket';

async function syncOpenTicketsByPerson(interaction: any, tickets: any, categoryId: string) {
  const openTickets = await GuildTicket.find({ guildId: interaction.guild.id, status: 'open' }).lean();
  let synced = 0;

  for (const ticket of openTickets) {
    const channel: any = interaction.guild.channels.cache.get(ticket.channelId);
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    try {
      if (channel.parentId !== categoryId) await channel.setParent(categoryId).catch(() => null);
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      if (tickets.supportRoleId) {
        await channel.permissionOverwrites.edit(tickets.supportRoleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }
      synced++;
    } catch (error) {
      console.warn('[Panel Ticket] Synchronisation impossible:', ticket.channelId, error);
    }
  }

  return synced;
}

export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Gère les panneaux OMNIX.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand(sub =>
      sub.setName('ticket').setDescription('Crée ou synchronise le panneau de tickets OMNIX.')
    ),

  async execute(interaction: any) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', flags: MessageFlags.Ephemeral });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Tu dois avoir la permission **Gérer le serveur**.', flags: MessageFlags.Ephemeral });
    }

    const config = await getGuildConfig(interaction.guildId);
    if (!config) return interaction.reply({ content: 'La configuration OMNIX de ce serveur est introuvable.', flags: MessageFlags.Ephemeral });

    const tickets: any = config.modules?.tickets || {};
    let category: any = tickets.categoryId ? interaction.guild.channels.cache.get(tickets.categoryId) : null;
    if (!category || category.type !== ChannelType.GuildCategory) {
      category = await interaction.guild.channels.create({ name: 'TICKETS · SUPPORT', type: ChannelType.GuildCategory });
    }

    let supportRole: any = tickets.supportRoleId ? interaction.guild.roles.cache.get(tickets.supportRoleId) : null;
    if (!supportRole) {
      supportRole = interaction.guild.roles.cache.find((r: any) => /support|moderateur|modérateur|moderation|modération|staff|admin/i.test(r.name) && !r.managed) || null;
    }

    let panel: any = tickets.panelChannelId ? interaction.guild.channels.cache.get(tickets.panelChannelId) : null;
    if (!panel || panel.type !== ChannelType.GuildText) {
      panel = await interaction.guild.channels.create({
        name: '🎫・ouvrir-un-ticket',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
          ...(supportRole ? [{ id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        ],
      });
    } else if (panel.parentId !== category.id) {
      await panel.setParent(category.id).catch(() => null);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('omnix_ticket_create:support').setLabel('Support général').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('omnix_ticket_create:premium').setLabel('Support Premium').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('omnix_ticket_create:partnership').setLabel('Partenariat').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(0x7c5cff)
      .setTitle('OMNIX · Centre de support')
      .setDescription('Besoin d’aide ? Choisissez le type de demande. Un salon privé sera créé pour votre compte.')
      .addFields(
        { name: 'Support général', value: 'Question, problème technique ou aide sur OMNIX.' },
        { name: 'Support Premium', value: 'Question concernant votre licence ou une fonctionnalité Premium.' },
        { name: 'Partenariat', value: 'Proposition ou demande de partenariat avec OMNIX.' },
      )
      .setFooter({ text: 'OMNIX · Support officiel · Synchronisation individuelle active' })
      .setTimestamp();

    await panel.send({ embeds: [embed], components: [row] });

    const nextTickets: any = {
      enabled: true,
      categoryId: category.id,
      panelChannelId: panel.id,
      ...(supportRole ? { supportRoleId: supportRole.id } : {}),
    };
    await updateGuildConfig(interaction.guildId, { modules: { tickets: nextTickets } });

    const synced = await syncOpenTicketsByPerson(interaction, nextTickets, category.id);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle('Panel tickets OMNIX synchronisé')
        .setDescription(`Le panneau est prêt et les tickets ouverts ont été resynchronisés **par utilisateur**.`)
        .addFields(
          { name: 'Panneau', value: `<#${panel.id}>`, inline: true },
          { name: 'Catégorie', value: `<#${category.id}>`, inline: true },
          { name: 'Tickets synchronisés', value: String(synced), inline: true },
        )
        .setTimestamp()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
