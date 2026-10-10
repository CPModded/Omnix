"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('channel-topic')
        .setDescription('Modifie le sujet d’un salon')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
        .addChannelOption(option => option
        .setName('salon')
        .setDescription('Salon concerné')
        .setRequired(true))
        .addStringOption(option => option
        .setName('sujet')
        .setDescription('Nouveau sujet')
        .setMaxLength(1024)
        .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('salon', true);
        const topic = interaction.options.getString('sujet', true);
        if (!('setTopic' in channel)) {
            return interaction.reply({
                content: '❌ Ce type de salon ne permet pas de définir un sujet.',
                ephemeral: true,
            });
        }
        await channel.setTopic(topic, `Sujet modifié par ${interaction.user.tag}`);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('📝 Sujet modifié')
            .setDescription(`Le sujet de ${channel} a été mis à jour.`)
            .addFields({
            name: '📝 Nouveau sujet',
            value: topic,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
