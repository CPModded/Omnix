"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('role-permissions')
        .setDescription('Affiche les permissions principales d’un rôle')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addRoleOption(option => option
        .setName('role')
        .setDescription('Rôle à consulter')
        .setRequired(true)),
    async execute(interaction) {
        const role = interaction.options.getRole('role', true);
        const permissions = role.permissions;
        const importantPermissions = [
            [
                'Administrator',
                '👑 Administrateur',
                permissions.has(discord_js_1.PermissionFlagsBits.Administrator),
            ],
            [
                'ManageGuild',
                '⚙️ Gérer le serveur',
                permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild),
            ],
            [
                'ManageChannels',
                '📺 Gérer les salons',
                permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels),
            ],
            [
                'ManageRoles',
                '🎭 Gérer les rôles',
                permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles),
            ],
            [
                'ManageMessages',
                '🧹 Gérer les messages',
                permissions.has(discord_js_1.PermissionFlagsBits.ManageMessages),
            ],
            [
                'BanMembers',
                '🔨 Bannir',
                permissions.has(discord_js_1.PermissionFlagsBits.BanMembers),
            ],
            [
                'KickMembers',
                '👢 Expulser',
                permissions.has(discord_js_1.PermissionFlagsBits.KickMembers),
            ],
            [
                'ModerateMembers',
                '🔇 Modérer',
                permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers),
            ],
        ];
        const description = importantPermissions
            .map(([, name, enabled]) => `${enabled ? '✅' : '❌'} ${name}`)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(role.color || 0x5865f2)
            .setTitle(`🎭 Permissions de ${role.name}`)
            .setDescription(description)
            .setFooter({
            text: `ID : ${role.id}`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};
