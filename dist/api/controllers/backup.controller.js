"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const GuildConfig_1 = require("../../models/GuildConfig");
const Backup_1 = require("../../models/Backup");
function snapshotConfig(config) {
    if (config && typeof config.toObject === 'function') {
        return config.toObject();
    }
    return JSON.parse(JSON.stringify(config || {}));
}
class BackupController {
    static async createBackup(req, res) {
        const { guildId } = req.params;
        const user = req.user;
        if (!user?.discordId)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        try {
            const config = await GuildConfig_1.GuildConfig.findOne({ guildId });
            if (!config)
                return res.status(404).json({ success: false, error: 'Aucune configuration trouvée pour ce serveur.' });
            const data = snapshotConfig(config);
            const serialized = JSON.stringify(data);
            const backup = new Backup_1.Backup({
                guildId,
                backupId: `BCK-${node_crypto_1.default.randomBytes(5).toString('hex').toUpperCase()}`,
                name: 'Sauvegarde manuelle',
                type: 'manual',
                status: 'completed',
                createdBy: user.discordId,
                data,
                size: Buffer.byteLength(serialized, 'utf8'),
                itemCount: Object.keys(data).length,
                completedAt: new Date(),
            });
            await backup.save();
            return res.json({ success: true, message: 'Sauvegarde de la configuration effectuée.', backupId: backup.backupId, backup });
        }
        catch (error) {
            console.error('[Bot Backup API Error]', error);
            return res.status(500).json({ success: false, error: 'Échec de la sauvegarde.', details: error?.message });
        }
    }
    static async restoreBackup(req, res) {
        const { guildId, backupId } = req.params;
        try {
            const backup = await Backup_1.Backup.findOne({ backupId, guildId });
            if (!backup)
                return res.status(404).json({ success: false, error: 'Sauvegarde introuvable pour ce serveur.' });
            const restoredDataObject = JSON.parse(JSON.stringify(backup.data || {}));
            delete restoredDataObject._id;
            delete restoredDataObject.createdAt;
            delete restoredDataObject.updatedAt;
            delete restoredDataObject.__v;
            delete restoredDataObject.guildId;
            const updatedConfig = await GuildConfig_1.GuildConfig.findOneAndUpdate({ guildId }, { $set: restoredDataObject }, { new: true, runValidators: true, upsert: true });
            return res.json({ success: true, message: 'Configuration restaurée à son état précédent.', config: updatedConfig });
        }
        catch (error) {
            console.error('[Backup Restore Error]', error);
            return res.status(500).json({ success: false, error: 'Échec du processus de restauration.', details: error?.message });
        }
    }
    static async listBackups(req, res) {
        const { guildId } = req.params;
        try {
            const backups = await Backup_1.Backup.find({ guildId }).sort({ createdAt: -1 }).limit(50);
            return res.json({ success: true, backups });
        }
        catch (error) {
            console.error('[Bot Backup List API Error]', error);
            return res.status(500).json({ success: false, error: "Impossible d'extraire l'historique." });
        }
    }
}
exports.BackupController = BackupController;
