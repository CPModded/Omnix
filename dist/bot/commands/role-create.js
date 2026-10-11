"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('role-create')
        .setDescription('Crée un nouveau rôle')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addStringOption(option => option
        .setName('nom')
        .setDescription('Nom du rôle')
        .setMaxLength(100)
        .setRequired(true))
        .addStringOption(option => option
        .setName('couleur')
        .setDescription('Couleur hexadécimale, exemple : #5865F2')
        .setRequired(false))
        .addBooleanOption(option => option
        .setName('mentionnable')
        .setDescription('Le rôle peut-il être mentionné ?')
        .setRequired(false)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const name = interaction.options.getString('nom', true);
        const color = interaction.options.getString('couleur');
        const mentionable = interaction.options.getBoolean('mentionnable') ?? false;
        if (color && !/^#?[0-9A-Fa-f]{6}$/.test(color)) {
            return interaction.reply({
                content: '❌ Couleur invalide. Utilise par exemple `#5865F2`.',
                ephemeral: true,
            });
        }
        const role = await guild.roles.create({
            name,
            color: color
                ? (color.startsWith('#') ? color : `#${color}`)
                : undefined,
            mentionable,
            reason: `Créé par ${interaction.user.tag}`,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(role.color || 0x5865f2)
            .setTitle('🎭 Rôle créé')
            .setDescription(`Le rôle ${role} a été créé avec succès.`)
            .addFields({
            name: '📝 Nom',
            value: role.name,
            inline: true,
        }, {
            name: '🎨 Couleur',
            value: role.hexColor,
            inline: true,
        }, {
            name: '🔔 Mentionnable',
            value: mentionable ? 'Oui' : 'Non',
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
