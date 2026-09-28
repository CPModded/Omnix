import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getGuildConfig } from '../utils/guildConfig';
import { ensureTicketPanel } from '../utils/ticketPanel';
import { omnixLoading, omnixSuccess, omnixError } from '../utils/omnixUi';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gère le système de tickets OMNIX.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand(s => s.setName('setup').setDescription('Installe ou met à jour le panneau de tickets OMNIX.'))
    .addSubcommand(s => s.setName('status').setDescription('Affiche le statut du système de tickets.')),

  async execute(interaction: any) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getGuildConfig(interaction.guildId);
    if (!config) return interaction.editReply({ embeds: [omnixError('Configuration introuvable', 'La configuration OMNIX de ce serveur est introuvable.')] });

    const tickets: any = config.modules?.tickets || {};
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const embed = new EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Tickets').setDescription('État actuel du système de tickets.')
        .addFields(
          { name: 'Statut', value: tickets.enabled ? 'Activé' : 'Désactivé', inline: true },
          { name: 'Catégorie', value: tickets.categoryId ? `<#${tickets.categoryId}>` : 'Non configurée', inline: true },
          { name: 'Panneau', value: tickets.panelChannelId ? `<#${tickets.panelChannelId}>` : 'Non configuré', inline: true },
          { name: 'Rôle support', value: tickets.supportRoleId ? `<@&${tickets.supportRoleId}>` : 'Non configuré', inline: true },
        ).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Tu dois avoir la permission **Gérer le serveur** pour configurer les tickets.', flags: MessageFlags.Ephemeral });
    }

    let result;
    try {
      result = await ensureTicketPanel(interaction.guild, config);
    } catch (error: any) {
      if (error?.message === 'TICKET_SETUP_BUSY') return interaction.editReply({ embeds: [omnixLoading('Configuration déjà en cours', 'Une autre configuration de tickets est déjà en cours. Réessaie dans quelques secondes.')] });
      throw error;
    }
    return interaction.editReply({
      embeds: [omnixSuccess('Tickets configurés', `Le système utilise maintenant **un seul panneau**.\n\nPanneau : <#${result.panel.id}>\nCatégorie : <#${result.category.id}>\nRôle support : ${result.supportRole ? `<@&${result.supportRole.id}>` : 'aucun rôle détecté'}`)],
    });
  },
};
