import type { Response } from 'express';
import crypto from 'node:crypto';
import { AuthenticatedRequest } from '../middlewares/auth';
import { GuildConfig } from '../../models/GuildConfig';
import { Backup } from '../../models/Backup';

function snapshotConfig(config: any): Record<string, unknown> {
  if (config && typeof config.toObject === 'function') {
    return config.toObject();
  }
  return JSON.parse(JSON.stringify(config || {}));
}

export class BackupController {
  static async createBackup(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;
    const user = req.user;
    if (!user?.discordId) return res.status(401).json({ success: false, error: 'Authentification requise.' });

    try {
      const config = await GuildConfig.findOne({ guildId });
      if (!config) return res.status(404).json({ success: false, error: 'Aucune configuration trouvée pour ce serveur.' });

      const data = snapshotConfig(config);
      const serialized = JSON.stringify(data);
      const backup = new Backup({
        guildId,
        backupId: `BCK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
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
    } catch (error: any) {
      console.error('[Bot Backup API Error]', error);
      return res.status(500).json({ success: false, error: 'Échec de la sauvegarde.', details: error?.message });
    }
  }

  static async restoreBackup(req: AuthenticatedRequest, res: Response) {
    const { guildId, backupId } = req.params;
    try {
      const backup = await Backup.findOne({ backupId, guildId });
      if (!backup) return res.status(404).json({ success: false, error: 'Sauvegarde introuvable pour ce serveur.' });

      const restoredDataObject: any = JSON.parse(JSON.stringify(backup.data || {}));
      delete restoredDataObject._id;
      delete restoredDataObject.createdAt;
      delete restoredDataObject.updatedAt;
      delete restoredDataObject.__v;
      delete restoredDataObject.guildId;

      const updatedConfig = await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: restoredDataObject },
        { new: true, runValidators: true, upsert: true },
      );
      return res.json({ success: true, message: 'Configuration restaurée à son état précédent.', config: updatedConfig });
    } catch (error: any) {
      console.error('[Backup Restore Error]', error);
      return res.status(500).json({ success: false, error: 'Échec du processus de restauration.', details: error?.message });
    }
  }

  static async listBackups(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;
    try {
      const backups = await Backup.find({ guildId }).sort({ createdAt: -1 }).limit(50);
      return res.json({ success: true, backups });
    } catch (error: any) {
      console.error('[Bot Backup List API Error]', error);
      return res.status(500).json({ success: false, error: "Impossible d'extraire l'historique." });
    }
  }
}
