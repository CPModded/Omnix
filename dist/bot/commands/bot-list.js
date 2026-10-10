"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('bot-list')
        .setDescription('Affiche les bots présents sur le serveur'),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        await guild.members.fetch();
        const bots = guild.members.cache
            .filter(member => member.user.bot)
            .sort((a, b) => a.user.username.localeCompare(b.user.username));
        const list = bots
            .map((member, index) => `**${index + 1}.** ${member} — \`${member.user.tag}\``)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🤖 Bots du serveur')
            .setDescription(list || 'Aucun bot trouvé.')
            .addFields({
            name: '📊 Total',
            value: `${bots.size}`,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
