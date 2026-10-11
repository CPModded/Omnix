"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('say')
        .setDescription('Fait envoyer un message ou un embed personnalisé par OMNIX.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .addStringOption(option => option.setName('message')
        .setDescription('Le message à envoyer (max 4500 caractères)')
        .setRequired(true)
        .setMaxLength(4500))
        .addChannelOption(option => option.setName('salon')
        .setDescription('Le salon où envoyer le message (par défaut le salon actuel)')
        .addChannelTypes(discord_js_1.ChannelType.GuildText))
        .addStringOption(option => option.setName('titre_embed')
        .setDescription('Ajoute un titre (convertit automatiquement le message en Embed)'))
        .addStringOption(option => option.setName('couleur_embed')
        .setDescription('Code couleur hexadécimal pour l\'embed (ex: #06b6d4)')),
    async execute({ interaction, guildConfig }) {
        const message = interaction.options.getString('message', true);
        const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
        const embedTitle = interaction.options.getString('titre_embed');
        const embedColor = interaction.options.getString('couleur_embed') || '#06b6d4';
        if (!targetChannel || !('send' in targetChannel)) {
            return interaction.reply({ content: "❌ Le salon sélectionné n'est pas valide.", ephemeral: true });
        }
        try {
            if (embedTitle) {
                // Envoi sous forme d'Embed personnalisé
                const customEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(embedTitle)
                    .setDescription(message)
                    .setColor(embedColor.startsWith('#') ? embedColor : `#${embedColor}`)
                    .setTimestamp();
                await targetChannel.send({ embeds: [customEmbed] });
            }
            else {
                // Envoi sous forme de texte brut
                await targetChannel.send({ content: message });
            }
            return interaction.reply({ content: `✅ Message envoyé avec succès dans <#${targetChannel.id}>.`, ephemeral: true });
        }
        catch (err) {
            console.error('[Say Command Error] :', err);
            return interaction.reply({ content: "❌ Impossible d'envoyer le message dans ce salon (Permissions manquantes).", ephemeral: true });
        }
    }
};
