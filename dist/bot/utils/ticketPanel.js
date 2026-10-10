"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTicketPanel = ensureTicketPanel;
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("./guildConfig");
const TicketPanelLock_1 = __importDefault(require("../../models/TicketPanelLock"));
async function ensureTicketPanel(guild, config) {
    const tickets = config?.modules?.tickets || {};
    // Verrou distribué : /ticket setup et /panel ticket ne peuvent pas
    // créer simultanément deux catégories/panneaux pour le même serveur.
    const now = new Date();
    const lockedUntil = new Date(Date.now() + 30_000);
    try {
        await TicketPanelLock_1.default.findOneAndUpdate({ guildId: guild.id, $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }] }, { $set: { lockedUntil, updatedAt: now }, $setOnInsert: { guildId: guild.id } }, { upsert: true, new: true });
    }
    catch (error) {
        if (error?.code === 11000) {
            throw new Error('TICKET_SETUP_BUSY');
        }
        throw error;
    }
    try {
        return await ensureTicketPanelLocked(guild, config);
    }
    finally {
        await TicketPanelLock_1.default.updateOne({ guildId: guild.id }, { $set: { lockedUntil: new Date(Date.now() - 1000), updatedAt: new Date() } }).catch(() => null);
    }
}
async function ensureTicketPanelLocked(guild, config) {
    const tickets = config?.modules?.tickets || {};
    let category = tickets.categoryId ? guild.channels.cache.get(tickets.categoryId) : null;
    if (!category || category.type !== discord_js_1.ChannelType.GuildCategory) {
        category = await guild.channels.create({ name: 'TICKETS · SUPPORT', type: discord_js_1.ChannelType.GuildCategory });
    }
    let supportRole = tickets.supportRoleId ? guild.roles.cache.get(tickets.supportRoleId) : null;
    if (!supportRole) {
        supportRole = guild.roles.cache.find((r) => /support|moderateur|modérateur|moderation|modération|staff|admin/i.test(r.name) && !r.managed) || null;
    }
    let panel = tickets.panelChannelId ? guild.channels.cache.get(tickets.panelChannelId) : null;
    if (!panel || panel.type !== discord_js_1.ChannelType.GuildText) {
        panel = await guild.channels.create({
            name: '🎫・ouvrir-un-ticket',
            type: discord_js_1.ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [discord_js_1.PermissionFlagsBits.SendMessages] },
                ...(supportRole ? [{ id: supportRole.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory] }] : []),
            ],
        });
    }
    else if (panel.parentId !== category.id) {
        await panel.setParent(category.id).catch(() => null);
    }
    const categories = Array.isArray(tickets.categoriesList) && tickets.categoriesList.length ? tickets.categoriesList : [
        { id: 'support', name: 'Support général', emoji: '🎫', type: 'category', targetId: category.id, welcomeMessage: tickets.entryText || 'Bonjour {user}, un conseiller va vous répondre.' },
        { id: 'premium', name: 'Support Premium', emoji: '⭐', type: 'category', targetId: category.id, welcomeMessage: tickets.entryText || 'Bonjour {user}, un conseiller va vous répondre.' },
        { id: 'partnership', name: 'Partenariat', emoji: '🤝', type: 'category', targetId: category.id, welcomeMessage: tickets.entryText || 'Bonjour {user}, un conseiller va vous répondre.' },
    ];
    const components = [];
    if (tickets.uiMode === 'select') {
        const { StringSelectMenuBuilder } = await Promise.resolve().then(() => __importStar(require('discord.js')));
        const menu = new StringSelectMenuBuilder().setCustomId('omnix_ticket_create_select').setPlaceholder('Choisissez votre demande').addOptions(categories.slice(0, 25).map((c) => ({ label: String(c.name || 'Ticket').slice(0, 100), value: String(c.id).slice(0, 100), emoji: String(c.emoji || '🎫').slice(0, 2) })));
        components.push(new discord_js_1.ActionRowBuilder().addComponents(menu));
    }
    else {
        for (let i = 0; i < categories.length && i < 20; i += 5)
            components.push(new discord_js_1.ActionRowBuilder().addComponents(...categories.slice(i, i + 5).map((c) => new discord_js_1.ButtonBuilder().setCustomId(`omnix_ticket_create:${c.id}`).setLabel(String(c.name || 'Ticket').slice(0, 80)).setEmoji(String(c.emoji || '🎫').slice(0, 2)).setStyle(i === 0 ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary))));
    }
    const row = components;
    const embed = new discord_js_1.EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Centre de support').setDescription(String(tickets.panelText || 'Choisissez le type de demande qui correspond à votre besoin.')).setFooter({ text: 'OMNIX · Support officiel' }).setTimestamp();
    for (const c of categories.slice(0, 25))
        embed.addFields({ name: `${c.emoji || '🎫'} ${String(c.name || 'Ticket')}`.slice(0, 256), value: String(c.welcomeMessage || 'Ouvrir un ticket privé.').slice(0, 1024), inline: true });
    // Un seul panneau OMNIX : on réutilise le message enregistré et on
    // supprime les anciens panneaux OMNIX restés dans le salon lors d'un
    // précédent /ticket setup.
    let panelMessage = null;
    if (tickets.panelMessageId) {
        panelMessage = await panel.messages.fetch(tickets.panelMessageId).catch(() => null);
    }
    if (panelMessage?.author?.id === guild.client.user?.id) {
        await panelMessage.edit({ embeds: [embed], components: row }).catch(() => null);
    }
    else {
        const recent = await panel.messages.fetch({ limit: 100 }).catch(() => null);
        if (recent) {
            const oldPanels = recent.filter((message) => message.author?.id === guild.client.user?.id &&
                message.components?.some((component) => component.components?.some((button) => (String(button.customId || '').startsWith('omnix_ticket_create:') || String(button.customId || '') === 'omnix_ticket_create_select'))));
            for (const old of oldPanels.values())
                await old.delete().catch(() => null);
        }
        panelMessage = await panel.send({ embeds: [embed], components: row });
    }
    // Nettoyage des anciens panneaux OMNIX présents dans d'autres salons :
    // après une série de /ticket setup, il ne reste qu'un panneau officiel.
    for (const candidate of guild.channels.cache.values()) {
        if (!candidate || candidate.type !== discord_js_1.ChannelType.GuildText || candidate.id === panel.id)
            continue;
        try {
            const messages = await candidate.messages.fetch({ limit: 50 });
            const oldPanels = messages.filter((message) => message.id !== panelMessage?.id &&
                message.author?.id === guild.client.user?.id &&
                message.components?.some((component) => component.components?.some((button) => (String(button.customId || '').startsWith('omnix_ticket_create:') || String(button.customId || '') === 'omnix_ticket_create_select'))));
            for (const old of oldPanels.values())
                await old.delete().catch(() => null);
        }
        catch { /* permissions/rate limits : le panneau canonique reste intact */ }
    }
    const nextTickets = {
        ...tickets,
        enabled: true,
        categoryId: category.id,
        panelChannelId: panel.id,
        panelMessageId: panelMessage?.id || tickets.panelMessageId || null,
        ...(supportRole ? { supportRoleId: supportRole.id } : {}),
    };
    await (0, guildConfig_1.updateGuildConfig)(guild.id, { modules: { tickets: nextTickets } });
    return { category, supportRole, panel, panelMessage, tickets: nextTickets };
}
