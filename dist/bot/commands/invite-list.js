"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('invite-list')
        .setDescription('Affiche les invitations du serveur')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const invites = await guild.invites
            .fetch()
            .catch(() => null);
        if (!invites) {
            return interaction.reply({
                content: '❌ Impossible de récupérer les invitations.',
                ephemeral: true,
            });
        }
        const list = [...invites.values()]
            .slice(0, 30)
            .map(invite => {
            const inviter = invite.inviter
                ? invite.inviter.tag
                : 'Inconnu';
            return (`🔗 \`${invite.code}\` — ` +
                `**${invite.uses ?? 0}** utilisations — ` +
                `${inviter}`);
        })
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🔗 Invitations du serveur')
            .setDescription(list || 'Aucune invitation trouvée.')
            .setFooter({
            text: `${invites.size} invitation(s)`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
