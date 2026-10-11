"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
const ticketPanel_1 = require("../utils/ticketPanel");
const omnixUi_1 = require("../utils/omnixUi");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Gère le système de tickets OMNIX.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild.toString())
        .addSubcommand(s => s.setName('setup').setDescription('Installe ou met à jour le panneau de tickets OMNIX.'))
        .addSubcommand(s => s.setName('status').setDescription('Affiche le statut du système de tickets.')),
    async execute(interaction) {
        if (!interaction.guildId || !interaction.guild) {
            return interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', flags: discord_js_1.MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const config = await (0, guildConfig_1.getGuildConfig)(interaction.guildId);
        if (!config)
            return interaction.editReply({ embeds: [(0, omnixUi_1.omnixError)('Configuration introuvable', 'La configuration OMNIX de ce serveur est introuvable.')] });
        const tickets = config.modules?.tickets || {};
        const sub = interaction.options.getSubcommand();
        if (sub === 'status') {
            const embed = new discord_js_1.EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Tickets').setDescription('État actuel du système de tickets.')
                .addFields({ name: 'Statut', value: tickets.enabled ? 'Activé' : 'Désactivé', inline: true }, { name: 'Catégorie', value: tickets.categoryId ? `<#${tickets.categoryId}>` : 'Non configurée', inline: true }, { name: 'Panneau', value: tickets.panelChannelId ? `<#${tickets.panelChannelId}>` : 'Non configuré', inline: true }, { name: 'Rôle support', value: tickets.supportRoleId ? `<@&${tickets.supportRoleId}>` : 'Non configuré', inline: true }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }
        if (!interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
            return interaction.editReply({ content: 'Tu dois avoir la permission **Gérer le serveur** pour configurer les tickets.' });
        }
        let result;
        try {
            result = await (0, ticketPanel_1.ensureTicketPanel)(interaction.guild, config);
        }
        catch (error) {
            if (error?.message === 'TICKET_SETUP_BUSY')
                return interaction.editReply({ embeds: [(0, omnixUi_1.omnixLoading)('Configuration déjà en cours', 'Une autre configuration de tickets est déjà en cours. Réessaie dans quelques secondes.')] });
            throw error;
        }
        return interaction.editReply({
            embeds: [(0, omnixUi_1.omnixSuccess)('Tickets configurés', `Le système utilise maintenant **un seul panneau**.\n\nPanneau : <#${result.panel.id}>\nCatégorie : <#${result.category.id}>\nRôle support : ${result.supportRole ? `<@&${result.supportRole.id}>` : 'aucun rôle détecté'}`)],
        });
    },
};
