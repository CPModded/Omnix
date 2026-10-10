"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ModerationCase_1 = __importDefault(require("../../../models/ModerationCase"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Retire un avertissement')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .addIntegerOption(option => option
        .setName('case')
        .setDescription('Numéro de la case')
        .setMinValue(1)
        .setRequired(true)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const caseNumber = interaction.options.getInteger('case', true);
        const warning = await ModerationCase_1.default.findOne({
            guildId: guild.id,
            caseNumber,
            action: 'warn',
        });
        if (!warning) {
            return interaction.reply({
                content: `❌ La Case #${caseNumber} n'existe pas.`,
                ephemeral: true,
            });
        }
        if (!warning.active) {
            return interaction.reply({
                content: `⚠️ La Case #${caseNumber} est déjà inactive.`,
                ephemeral: true,
            });
        }
        warning.active = false;
        await warning.save();
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('↩️ Avertissement retiré')
            .setDescription(`L'avertissement **Case #${caseNumber}** a été retiré.`)
            .addFields({
            name: '👤 Membre',
            value: `<@${warning.userId}>`,
            inline: true,
        }, {
            name: '👮 Modérateur',
            value: `<@${interaction.user.id}>`,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
