"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('move')
        .setDescription('Déplace un membre vers un salon vocal')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.MoveMembers)
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Membre à déplacer')
        .setRequired(true))
        .addChannelOption(option => option
        .setName('salon')
        .setDescription('Salon vocal de destination')
        .addChannelTypes(2)
        .setRequired(true)),
    async execute(interaction) {
        const member = interaction.options.getMember('membre');
        const channel = interaction.options.getChannel('salon', true);
        if (!member ||
            !('voice' in member) ||
            !channel.isVoiceBased()) {
            return interaction.reply({
                content: '❌ Membre ou salon vocal invalide.',
                ephemeral: true,
            });
        }
        if (!member.voice.channel) {
            return interaction.reply({
                content: '❌ Ce membre n’est actuellement dans aucun salon vocal.',
                ephemeral: true,
            });
        }
        await member.voice.setChannel(channel, `Déplacement par ${interaction.user.tag}`);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🔀 Membre déplacé')
            .setDescription(`${member} a été déplacé vers ${channel}.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
