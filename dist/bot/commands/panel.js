"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
const GuildTicket_1 = __importDefault(require("../../models/GuildTicket"));
const ticketPanel_1 = require("../utils/ticketPanel");
const omnixUi_1 = require("../utils/omnixUi");
async function syncOpenTicketsByPerson(interaction, tickets, categoryId) {
    const openTickets = await GuildTicket_1.default.find({ guildId: interaction.guild.id, status: 'open' }).lean();
    let synced = 0;
    for (const ticket of openTickets) {
        const channel = interaction.guild.channels.cache.get(ticket.channelId);
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildText)
            continue;
        try {
            if (channel.parentId !== categoryId)
                await channel.setParent(categoryId).catch(() => null);
            await channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
            if (tickets.supportRoleId)
                await channel.permissionOverwrites.edit(tickets.supportRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
            synced++;
        }
        catch (error) {
            console.warn('[Panel Ticket] Synchronisation impossible:', ticket.channelId, error);
        }
    }
    return synced;
}
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('panel')
        .setDescription('Gère les panneaux OMNIX.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild.toString())
        .addSubcommand(sub => sub.setName('ticket').setDescription('Crée ou synchronise le panneau unique de tickets OMNIX.')),
    async execute(interaction) {
        if (!interaction.guildId || !interaction.guild)
            return interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', flags: discord_js_1.MessageFlags.Ephemeral });
        if (!interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild))
            return interaction.reply({ content: 'Tu dois avoir la permission **Gérer le serveur**.', flags: discord_js_1.MessageFlags.Ephemeral });
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const config = await (0, guildConfig_1.getGuildConfig)(interaction.guildId);
        if (!config)
            return interaction.editReply({ embeds: [(0, omnixUi_1.omnixError)('Configuration introuvable', 'La configuration OMNIX de ce serveur est introuvable.')] });
        let result;
        try {
            result = await (0, ticketPanel_1.ensureTicketPanel)(interaction.guild, config);
        }
        catch (error) {
            if (error?.message === 'TICKET_SETUP_BUSY')
                return interaction.editReply({ embeds: [(0, omnixUi_1.omnixLoading)('Configuration déjà en cours', 'Une autre configuration de tickets est déjà en cours. Réessaie dans quelques secondes.')] });
            throw error;
        }
        const synced = await syncOpenTicketsByPerson(interaction, result.tickets, result.category.id);
        return interaction.editReply({
            embeds: [(0, omnixUi_1.omnixSuccess)('Panel tickets synchronisé', `Un seul panneau actif est conservé et les tickets ouverts sont resynchronisés **par utilisateur**.`).addFields({ name: 'Panneau', value: `<#${result.panel.id}>`, inline: true }, { name: 'Catégorie', value: `<#${result.category.id}>`, inline: true }, { name: 'Tickets synchronisés', value: String(synced), inline: true })],
        });
    },
};
