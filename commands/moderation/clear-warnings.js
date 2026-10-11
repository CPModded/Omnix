"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ModerationCase_1 = __importDefault(require("../../../models/ModerationCase"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('clear-warnings')
        .setDescription('Retire tous les avertissements actifs')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Membre concerné')
        .setRequired(true)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const user = interaction.options.getUser('membre', true);
        const result = await ModerationCase_1.default.updateMany({
            guildId: guild.id,
            userId: user.id,
            action: 'warn',
            active: true,
        }, {
            $set: {
                active: false,
            },
        });
        if (result.modifiedCount === 0) {
            return interaction.reply({
                content: `ℹ️ **${user.tag}** n'a aucun avertissement actif.`,
                ephemeral: true,
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🧹 Avertissements supprimés')
            .setDescription(`Les avertissements actifs de ${user} ont été retirés.`)
            .addFields({
            name: '📊 Nombre retiré',
            value: `${result.modifiedCount}`,
            inline: true,
        })
            .setFooter({
            text: `Action effectuée par ${interaction.user.tag}`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
