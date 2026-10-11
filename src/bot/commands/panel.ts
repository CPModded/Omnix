import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { getGuildConfig } from '../utils/guildConfig';
import GuildTicket from '../../models/GuildTicket';
import { ensureTicketPanel } from '../utils/ticketPanel';
import { omnixLoading, omnixSuccess, omnixError } from '../utils/omnixUi';

async function syncOpenTicketsByPerson(interaction: any, tickets: any, categoryId: string) {
  const openTickets = await GuildTicket.find({ guildId: interaction.guild.id, status: 'open' }).lean();
  let synced = 0;
  for (const ticket of openTickets) {
    const channel: any = interaction.guild.channels.cache.get(ticket.channelId);
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    try {
      if (channel.parentId !== categoryId) await channel.setParent(categoryId).catch(() => null);
      await channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      if (tickets.supportRoleId) await channel.permissionOverwrites.edit(tickets.supportRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
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
    .addSubcommand(sub => sub.setName('ticket').setDescription('Crée ou synchronise le panneau unique de tickets OMNIX.')),

  async execute(interaction: any) {
    if (!interaction.guildId || !interaction.guild) return interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', flags: MessageFlags.Ephemeral });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Tu dois avoir la permission **Gérer le serveur**.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const config = await getGuildConfig(interaction.guildId);
    if (!config) return interaction.editReply({ embeds: [omnixError('Configuration introuvable', 'La configuration OMNIX de ce serveur est introuvable.')] });
    let result;
    try {
      result = await ensureTicketPanel(interaction.guild, config);
    } catch (error: any) {
      if (error?.message === 'TICKET_SETUP_BUSY') return interaction.editReply({ embeds: [omnixLoading('Configuration déjà en cours', 'Une autre configuration de tickets est déjà en cours. Réessaie dans quelques secondes.')] });
      throw error;
    }
    const synced = await syncOpenTicketsByPerson(interaction, result.tickets, result.category.id);
    return interaction.editReply({
      embeds: [omnixSuccess('Panel tickets synchronisé', `Un seul panneau actif est conservé et les tickets ouverts sont resynchronisés **par utilisateur**.`).addFields(
        { name: 'Panneau', value: `<#${result.panel.id}>`, inline: true },
        { name: 'Catégorie', value: `<#${result.category.id}>`, inline: true },
        { name: 'Tickets synchronisés', value: String(synced), inline: true },
      )],
    });
  },
};
