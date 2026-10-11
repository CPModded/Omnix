"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const platformEvents_1 = require("../../services/platformEvents");
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
const GuildTicket_1 = __importDefault(require("../../models/GuildTicket"));
const InteractionReceipt_1 = __importDefault(require("../../models/InteractionReceipt"));
const localization_1 = require("../../services/localization");
const localInteractionReceipts = new Set();
const commandHandler_1 = require("../handlers/commandHandler");
exports.default = {
    name: discord_js_1.Events.InteractionCreate,
    async execute(interaction) {
        try {
            // =========================================================
            // SLASH COMMAND
            // =========================================================
            if (interaction.isChatInputCommand()) {
                const started = Date.now();
                // Discord peut livrer une même interaction à plusieurs instances
                // du bot. MongoDB sert de verrou distribué pour qu'une commande ne
                // soit exécutée qu'une seule fois. En cas de Mongo indisponible, on
                // conserve le comportement normal du bot.
                try {
                    const interactionKey = String(interaction.id);
                    if (localInteractionReceipts.has(interactionKey)) {
                        console.warn(`[InteractionCreate] Doublon local ignoré : ${interaction.commandName} (${interactionKey})`);
                        return;
                    }
                    localInteractionReceipts.add(interactionKey);
                    const localExpiry = setTimeout(() => localInteractionReceipts.delete(interactionKey), 2 * 60 * 1000);
                    localExpiry.unref?.();
                    const receiptExpiry = new Date(Date.now() + 2 * 60 * 1000);
                    try {
                        await InteractionReceipt_1.default.create({
                            interactionId: interactionKey,
                            kind: `command:${String(interaction.commandName)}`,
                            expiresAt: receiptExpiry,
                        });
                    }
                    catch (receiptError) {
                        if (receiptError?.code === 11000) {
                            console.warn(`[InteractionCreate] Doublon distribué ignoré : ${interaction.commandName} (${interactionKey})`);
                            return;
                        }
                        // Mongo indisponible : la barrière locale reste active.
                    }
                    await (0, commandHandler_1.executeCommand)(interaction);
                    await (0, platformEvents_1.recordPlatformEvent)('command_executed', { userId: interaction.user?.id, guildId: interaction.guildId || undefined, metadata: { command: interaction.commandName, durationMs: Date.now() - started } });
                }
                catch (error) {
                    await (0, platformEvents_1.recordPlatformEvent)('command_error', { userId: interaction.user?.id, guildId: interaction.guildId || undefined, metadata: { command: interaction.commandName, durationMs: Date.now() - started, error: error instanceof Error ? error.message.slice(0, 500) : 'error' } });
                    throw error;
                }
                return;
            }
            // =========================================================
            // AUTOCOMPLETE
            // =========================================================
            if (interaction.isAutocomplete()) {
                await (0, commandHandler_1.executeAutocomplete)(interaction);
                return;
            }
            // =========================================================
            // SELECT MENU / BOUTONS
            // =========================================================
            const isTicketSelect = Boolean(interaction.isStringSelectMenu?.() && interaction.customId === 'omnix_ticket_create_select');
            const effectiveCustomId = isTicketSelect ? `omnix_ticket_create:${String(interaction.values?.[0] || '')}` : String(interaction.customId || '');
            if (interaction.isButton() || isTicketSelect) {
                const [action, type] = effectiveCustomId.split(':');
                if (!action.startsWith('omnix_ticket_') || !interaction.guild)
                    return;
                const interactionKey = String(interaction.id);
                // Une interaction Discord ne doit être acquittée qu'une seule fois.
                // On garde une barrière locale pour les doublons livrés au même
                // processus, puis on acquitte immédiatement l'interaction avant toute
                // opération MongoDB. Ainsi, une base lente ne fait plus expirer le
                // bouton.
                if (localInteractionReceipts.has(`button:${interactionKey}`)) {
                    console.warn(`[InteractionCreate] Doublon local ignoré : bouton ${interaction.customId} (${interactionKey})`);
                    return;
                }
                localInteractionReceipts.add(`button:${interactionKey}`);
                const buttonLocalExpiry = setTimeout(() => localInteractionReceipts.delete(`button:${interactionKey}`), 2 * 60 * 1000);
                buttonLocalExpiry.unref?.();
                if (!interaction.deferred && !interaction.replied) {
                    try {
                        await interaction.deferReply({ flags: 64 });
                    }
                    catch (error) {
                        if (error?.code === 10062 || error?.rawError?.code === 10062) {
                            console.warn(`[InteractionCreate] Interaction expirée ou déjà consommée : bouton ${interaction.customId} (${interactionKey})`);
                            return;
                        }
                        throw error;
                    }
                }
                // Verrou distribué après l'acquittement Discord. Si une seconde
                // instance reçoit la même interaction, la première aura déjà
                // consommé le token Discord et la seconde sortira proprement.
                try {
                    await InteractionReceipt_1.default.create({
                        interactionId: interactionKey,
                        kind: `button:${String(interaction.customId)}`,
                        expiresAt: new Date(Date.now() + 2 * 60 * 1000),
                    });
                }
                catch (receiptError) {
                    if (receiptError?.code === 11000) {
                        console.warn(`[InteractionCreate] Doublon distribué ignoré : bouton ${interaction.customId} (${interactionKey})`);
                        return;
                    }
                    // Mongo indisponible : la barrière locale reste active et le
                    // traitement continue afin de ne pas casser les interactions.
                }
                let config;
                try {
                    config = await (0, guildConfig_1.getGuildConfig)(interaction.guild.id);
                }
                catch (error) {
                    console.error('[Ticket] Configuration indisponible :', error?.message || error);
                    return interaction.editReply({
                        content: '⚠️ OMNIX ne peut pas accéder à la configuration du serveur pour le moment. La base de données est temporairement indisponible. Réessaie dans quelques instants.',
                    }).catch(() => null);
                }
                const tickets = config?.modules?.tickets || {};
                const locale = await (0, localization_1.getInteractionLocale)(interaction, config).catch(() => 'fr');
                if (action === 'omnix_ticket_create') {
                    if (tickets.enabled === false) {
                        return interaction.editReply({ content: `❌ ${(0, localization_1.t)(locale, 'disabled')}` }).catch(() => null);
                    }
                    // Une seule réponse est affichée à l'utilisateur : elle est mise à
                    // jour au fur et à mesure. Cela évite le spam et donne un vrai état
                    // de progression comme une interface applicative.
                    await interaction.editReply({ content: `⏳ ${(0, localization_1.t)(locale, 'creating')}` }).catch(() => null);
                    const open = await GuildTicket_1.default.countDocuments({
                        guildId: interaction.guild.id,
                        userId: interaction.user.id,
                        status: 'open',
                    });
                    if (open >= Number(tickets.maxOpenPerUser || 1)) {
                        return interaction.editReply({ content: `⚠️ ${(0, localization_1.t)(locale, 'maxOpen')}` }).catch(() => null);
                    }
                    const selected = (Array.isArray(tickets.categoriesList) ? tickets.categoriesList : []).find((c) => String(c.id) === String(type));
                    const targetId = selected?.targetId || tickets.categoryId;
                    const target = targetId ? interaction.guild.channels.cache.get(targetId) : null;
                    const category = selected?.type === 'channel' ? target : (target?.type === discord_js_1.ChannelType.GuildCategory ? target : null);
                    if (!category && selected?.type !== 'channel')
                        return interaction.editReply({ content: `❌ ${(0, localization_1.t)(locale, 'destinationMissing')}` }).catch(() => null);
                    const moderatorRoleIds = Array.isArray(selected?.moderatorRoleIds) && selected.moderatorRoleIds.length ? selected.moderatorRoleIds : (Array.isArray(tickets.moderatorRoles) ? tickets.moderatorRoles.map((r) => r.roleId) : (tickets.supportRoleId ? [tickets.supportRoleId] : []));
                    const destinationParent = category?.type === discord_js_1.ChannelType.GuildCategory ? category.id : (tickets.categoryId || undefined);
                    await interaction.editReply({ content: `⏳ ${(0, localization_1.t)(locale, 'loading')}` }).catch(() => null);
                    const number = await (0, guildConfig_1.nextGuildTicketNumber)(interaction.guild.id);
                    let channel = null;
                    try {
                        channel = await interaction.guild.channels.create({
                            name: `ticket-${number}`,
                            type: discord_js_1.ChannelType.GuildText,
                            parent: destinationParent,
                            permissionOverwrites: [
                                { id: interaction.guild.roles.everyone.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
                                { id: interaction.user.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory] },
                                ...moderatorRoleIds.map((roleId) => ({ id: roleId, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory] })),
                            ],
                        });
                        await GuildTicket_1.default.create({
                            guildId: interaction.guild.id,
                            ticketNumber: number,
                            channelId: channel.id,
                            userId: interaction.user.id,
                            username: interaction.user.username,
                            subject: selected?.name || type || 'support',
                            categoryId: selected?.id || type || null,
                            status: 'open',
                        });
                        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`omnix_ticket_claim:${channel.id}`).setLabel((0, localization_1.t)(locale, 'claim')).setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`omnix_ticket_close:${channel.id}`).setLabel((0, localization_1.t)(locale, 'close')).setStyle(discord_js_1.ButtonStyle.Danger));
                        await channel.send({
                            content: `<@${interaction.user.id}> ${String(tickets.openingText || `Votre demande **${selected?.name || type || 'support'}** est ouverte.`).replaceAll('{user}', `<@${interaction.user.id}>`)}\n\n${String(selected?.welcomeMessage || tickets.entryText || '').replaceAll('{user}', `<@${interaction.user.id}>`)}`,
                            components: [row],
                        });
                        await (0, platformEvents_1.recordPlatformEvent)('ticket_created', {
                            userId: interaction.user.id,
                            guildId: interaction.guild.id,
                            metadata: { ticketNumber: number, channelId: channel.id, type: type || 'support' },
                        });
                        return interaction.editReply({ content: `✅ ${(0, localization_1.t)(locale, 'created')} ${channel}` });
                    }
                    catch (error) {
                        if (channel)
                            await channel.delete('Rollback création ticket OMNIX').catch(() => null);
                        console.error('[Ticket] Échec création :', error);
                        return interaction.editReply({ content: `❌ ${(0, localization_1.t)(locale, 'error')}` }).catch(() => null);
                    }
                }
                const ticketChannel = interaction.channel;
                if (!ticketChannel || !('name' in ticketChannel))
                    return;
                const ticket = await GuildTicket_1.default.findOne({
                    guildId: interaction.guild.id,
                    channelId: ticketChannel.id,
                    status: 'open',
                });
                if (!ticket) {
                    return interaction.editReply({ content: `❌ ${(0, localization_1.t)(locale, 'notTicket')}` }).catch(() => null);
                }
                const selectedTicketCategory = (Array.isArray(tickets.categoriesList) ? tickets.categoriesList : []).find((c) => String(c.id) === String(ticket.categoryId));
                const categoryRoles = Array.isArray(selectedTicketCategory?.moderatorRoleIds) ? selectedTicketCategory.moderatorRoleIds : [];
                const globalRoles = Array.isArray(tickets.moderatorRoles) ? tickets.moderatorRoles.map((r) => r.roleId).filter(Boolean) : [];
                const allowedRoleIds = categoryRoles.length ? categoryRoles : globalRoles;
                const staff = allowedRoleIds.some((roleId) => interaction.member?.roles?.cache?.has(String(roleId))) || Boolean(tickets.supportRoleId && interaction.member?.roles?.cache?.has(tickets.supportRoleId));
                if (!staff && !interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
                    return interaction.editReply({ content: `🔒 ${(0, localization_1.t)(locale, 'supportOnly')}` }).catch(() => null);
                }
                if (action === 'omnix_ticket_claim') {
                    ticket.claimedBy = interaction.user.id;
                    await ticket.save();
                    await (0, platformEvents_1.recordPlatformEvent)('ticket_claimed', { userId: interaction.user.id, guildId: interaction.guild.id, metadata: { ticketNumber: ticket.ticketNumber, channelId: ticket.channelId } });
                    return interaction.editReply({ content: `✅ Ticket **#${ticket.ticketNumber}** pris en charge par ${interaction.user}.` }).catch(() => null);
                }
                if (action === 'omnix_ticket_close') {
                    ticket.status = 'closed';
                    ticket.closedAt = new Date();
                    ticket.closedBy = interaction.user.id;
                    await ticket.save();
                    // Optional transcript: keep it bounded to the latest 100 messages
                    // so a 512 MiB container is not forced to hold a huge transcript.
                    if (tickets.transcriptChannelId && 'messages' in ticketChannel && typeof ticketChannel.messages?.fetch === 'function') {
                        const transcriptChannel = interaction.guild.channels.cache.get(tickets.transcriptChannelId);
                        if (transcriptChannel?.isTextBased?.() && typeof transcriptChannel.send === 'function') {
                            const fetched = await ticketChannel.messages.fetch({ limit: 100 }).catch(() => null);
                            if (fetched) {
                                const lines = [...fetched.values()].reverse().map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag || m.author?.username || 'Utilisateur'}: ${String(m.content || '[embed/fichier]').slice(0, 1000)}`);
                                const header = `📄 **Transcript ticket #${ticket.ticketNumber}**\nServeur : ${interaction.guild.name}\nCréé par : ${ticket.username}`;
                                await transcriptChannel.send(header).catch(() => null);
                                for (let i = 0; i < lines.length; i += 20) {
                                    await transcriptChannel.send('```text\n' + lines.slice(i, i + 20).join('\n').slice(0, 1950) + '\n```').catch(() => null);
                                }
                            }
                        }
                    }
                    if (tickets.logChannelId) {
                        const logChannel = interaction.guild.channels.cache.get(tickets.logChannelId);
                        if (logChannel?.isTextBased?.() && typeof logChannel.send === 'function') {
                            await logChannel.send(`🔒 Ticket #${ticket.ticketNumber} fermé par <@${interaction.user.id}> — <#${ticket.channelId}>`).catch(() => null);
                        }
                    }
                    await (0, platformEvents_1.recordPlatformEvent)('ticket_closed', { userId: interaction.user.id, guildId: interaction.guild.id, metadata: { ticketNumber: ticket.ticketNumber, channelId: ticket.channelId } });
                    await interaction.editReply({ content: `✅ ${(0, localization_1.t)(locale, 'closed')}` }).catch(() => null);
                    return ticketChannel.delete('Ticket OMNIX fermé');
                }
                return;
            }
            // =========================================================
            // SELECT MENUS
            // =========================================================
            if (interaction.isStringSelectMenu()) {
                console.log(`[InteractionCreate] Menu reçu : ${interaction.customId}`);
                return;
            }
            // =========================================================
            // USER SELECT MENU
            // =========================================================
            if (interaction.isUserSelectMenu()) {
                console.log(`[InteractionCreate] User Select reçu : ${interaction.customId}`);
                return;
            }
            // =========================================================
            // ROLE SELECT MENU
            // =========================================================
            if (interaction.isRoleSelectMenu()) {
                console.log(`[InteractionCreate] Role Select reçu : ${interaction.customId}`);
                return;
            }
            // =========================================================
            // CHANNEL SELECT MENU
            // =========================================================
            if (interaction.isChannelSelectMenu()) {
                console.log(`[InteractionCreate] Channel Select reçu : ${interaction.customId}`);
                return;
            }
            // =========================================================
            // MENTIONABLE SELECT MENU
            // =========================================================
            if (interaction.isMentionableSelectMenu()) {
                console.log(`[InteractionCreate] Mentionable Select reçu : ${interaction.customId}`);
                return;
            }
            // =========================================================
            // MODAL
            // =========================================================
            if (interaction.isModalSubmit()) {
                console.log(`[InteractionCreate] Modal reçu : ${interaction.customId}`);
                return;
            }
        }
        catch (error) {
            if (error?.code === 10062 || error?.rawError?.code === 10062) {
                console.warn('[InteractionCreate] Interaction expirée ou déjà consommée (10062).');
                return;
            }
            console.error('[InteractionCreate] Erreur :', error);
            // =========================================================
            // GESTION PROPRE DE L'ERREUR DISCORD
            // =========================================================
            try {
                if (!interaction.isRepliable()) {
                    return;
                }
                const errorMessage = '❌ OMNIX n’a pas pu terminer cette action. Si le problème persiste, vérifie l’état de la base de données dans le dashboard.';
                if (interaction.replied ||
                    interaction.deferred) {
                    await interaction.editReply({
                        content: errorMessage,
                        embeds: [],
                        components: [],
                    }).catch(() => null);
                    return;
                }
                await interaction.reply({
                    content: errorMessage,
                    flags: 64,
                }).catch(() => null);
            }
            catch (replyError) {
                console.error('[InteractionCreate] Impossible de répondre à l’erreur :', replyError);
            }
        }
    },
};
