"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("../../config");
const localization_1 = require("../../services/localization");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder().setName('language').setDescription('Gère les langues automatiques d’OMNIX (Owner uniquement).')
        .addSubcommand(s => s.setName('set').setDescription('Définit la langue du serveur.').addStringOption(o => o.setName('locale').setDescription('Code langue').setRequired(true).addChoices(...localization_1.SUPPORTED_LOCALES.map(l => ({ name: l, value: l })))))
        .addSubcommand(s => s.setName('auto').setDescription('Active ou désactive la détection automatique.').addBooleanOption(o => o.setName('enabled').setDescription('Détection automatique').setRequired(true)))
        .addSubcommand(s => s.setName('role').setDescription('Associe un rôle à une langue.').addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)).addStringOption(o => o.setName('locale').setDescription('Langue').setRequired(true).addChoices(...localization_1.SUPPORTED_LOCALES.map(l => ({ name: l, value: l })))))
        .addSubcommand(s => s.setName('status').setDescription('Affiche la configuration des langues.')),
    async execute(interaction) {
        if (!config_1.CONFIG.OWNER_IDS.includes(String(interaction.user.id)))
            return interaction.reply({ content: 'Cette commande est réservée au propriétaire d’OMNIX.', flags: discord_js_1.MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();
        const config = await GuildConfig_1.default.findOne({ guildId: interaction.guildId });
        if (!config)
            return interaction.reply({ content: 'Configuration du serveur introuvable.', flags: discord_js_1.MessageFlags.Ephemeral });
        if (sub === 'set') {
            config.locale = (0, localization_1.normalizeLocale)(interaction.options.getString('locale'));
            await config.save();
            return interaction.reply({ embeds: [new discord_js_1.EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Langue').setDescription(`Langue du serveur définie sur **${config.locale}**.`)] });
        }
        if (sub === 'auto') {
            config.autoLocale = interaction.options.getBoolean('enabled');
            await config.save();
            return interaction.reply({ content: `Détection automatique ${config.autoLocale ? 'activée' : 'désactivée'}.`, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        if (sub === 'role') {
            const role = interaction.options.getRole('role');
            const locale = (0, localization_1.normalizeLocale)(interaction.options.getString('locale'));
            await (0, localization_1.setGuildLanguageRole)(interaction.guildId, role.id, locale);
            return interaction.reply({ content: `Le rôle ${role} utilise maintenant **${locale}**.`, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        return interaction.reply({ embeds: [new discord_js_1.EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Langues').setDescription(`Auto : **${config.autoLocale !== false ? 'activée' : 'désactivée'}**\nLangue serveur : **${config.locale}**\nRôles configurés : **${Object.keys(config.languageRoles || {}).length}**`)] });
    }
};
