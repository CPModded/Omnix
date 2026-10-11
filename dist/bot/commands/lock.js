"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('lock')
        .setDescription('Verrouille le salon actuel')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const channel = interaction.channel;
        if (!interaction.guild || !channel || !('permissionOverwrites' in channel)) {
            return interaction.reply({
                content: '❌ Ce salon ne peut pas être verrouillé.',
                ephemeral: true,
            });
        }
        const everyoneRole = interaction.guild.roles.everyone;
        await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: false,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🔒 Salon verrouillé')
            .setDescription(`Le salon ${channel} vient d’être verrouillé.`)
            .addFields({
            name: '🛡️ Responsable',
            value: interaction.user.tag,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
