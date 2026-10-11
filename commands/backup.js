"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Backup_1 = __importDefault(require("../../models/Backup"));
const guildConfig_1 = require("../utils/guildConfig");
const node_crypto_1 = __importDefault(require("node:crypto"));
const backupCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('backup')
        .setDescription('Gérer les sauvegardes de configuration de votre serveur (Premium Only)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('create')
        .setDescription('Créer une sauvegarde immédiate de la configuration'))
        .addSubcommand(sub => sub.setName('list')
        .setDescription('Lister les 5 dernières sauvegardes du serveur')),
    async execute({ interaction, guildConfig }) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        // 1. Sous-commande : CRÉATION DE SAUVEGARDE
        if (subcommand === 'create') {
            await interaction.deferReply({ ephemeral: true });
            try {
                // Toujours récupérer une configuration valide depuis MongoDB.
                // Le CommandContext peut ne pas fournir guildConfig selon le handler.
                const config = guildConfig ?? await (0, guildConfig_1.getGuildConfig)(guildId);
                const snapshot = typeof config?.toObject === 'function'
                    ? config.toObject()
                    : JSON.parse(JSON.stringify(config));
                const serialized = JSON.stringify(snapshot);
                const backup = new Backup_1.default({
                    guildId,
                    backupId: `BCK-${node_crypto_1.default.randomBytes(5).toString('hex').toUpperCase()}`,
                    name: 'Sauvegarde manuelle',
                    type: 'manual',
                    status: 'completed',
                    createdBy: userId,
                    data: snapshot,
                    size: Buffer.byteLength(serialized, 'utf8'),
                    itemCount: Object.keys(snapshot || {}).length,
                    completedAt: new Date(),
                });
                await backup.save();
                return interaction.editReply({
                    content: `✅ **Sauvegarde de configuration créée avec succès !**\n\n• **ID de la sauvegarde :** \`${backup.backupId}\`\n• **Créée par :** <@${userId}>\n\n*Note : Vous pouvez restaurer cette sauvegarde à tout moment depuis le Dashboard ou l'API.*`
                });
            }
            catch (error) {
                console.error('[Bot Backup Error] :', error.message);
                return interaction.editReply({
                    content: "❌ Une erreur est survenue lors de la tentative de sauvegarde. Veuillez réessayer."
                });
            }
        }
        // 2. Sous-commande : LISTER LES SAUVEGARDES
        if (subcommand === 'list') {
            try {
                // Recherche des 5 dernières sauvegardes pour ce serveur
                const backups = await Backup_1.default.find({ guildId }).sort({ createdAt: -1 }).limit(5);
                if (backups.length === 0) {
                    return interaction.reply({
                        content: "ℹ️ Aucune sauvegarde n'a encore été enregistrée pour ce serveur.",
                        ephemeral: true
                    });
                }
                const listText = backups.map((b, index) => {
                    const dateStr = b.createdAt.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `**${index + 1}.** ID: \`${b.backupId}\` — *Créée le : ${dateStr}*`;
                }).join('\n');
                return interaction.reply({
                    content: `📂 **Historique des sauvegardes du serveur :**\n\n${listText}\n\n*Pour restaurer l'une de ces sauvegardes, rendez-vous sur le Dashboard Web.*`,
                    ephemeral: true
                });
            }
            catch (error) {
                console.error('[Bot Backup List Error] :', error.message);
                return interaction.reply({
                    content: "❌ Impossible de récupérer la liste des sauvegardes pour le moment.",
                    ephemeral: true
                });
            }
        }
    }
};
exports.default = backupCommand;
