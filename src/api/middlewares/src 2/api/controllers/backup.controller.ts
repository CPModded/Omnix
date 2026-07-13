import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { GuildConfig } from '../../models/GuildConfig';
import { Backup } from '../../models/Backup';

export class BackupController {
  // 1. Crée une sauvegarde manuelle de la configuration du serveur
  static async createBackup(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;
    const user = req.user!;

    try {
      const config = await GuildConfig.findOne({ guildId });
      if (!config) {
        return res.status(404).json({ error: 'Aucune configuration trouvée pour ce serveur.' });
      }

      // Sérialisation propre des options du serveur
      const backupDataString = JSON.stringify(config.toObject());

      const backup = new Backup({
        guildId,
        creatorId: user.discordId,
        backupData: backupDataString
      });

      await backup.save();

      return res.json({ message: 'Sauvegarde de la configuration effectuée.', backupId: backup._id });
    } catch (error: any) {
      return res.status(500).json({ error: 'Échec de la sauvegarde.' });
    }
  }

  // 2. Restaure une sauvegarde existante
  static async restoreBackup(req: AuthenticatedRequest, res: Response) {
    const { guildId, backupId } = req.params;

    try {
      const backup = await Backup.findOne({ _id: backupId, guildId });

      if (!backup) {
        return res.status(404).json({ error: 'Sauvegarde introuvable pour ce serveur.' });
      }

      const restoredDataObject = JSON.parse(backup.backupData);
      
      // Sécurité : On exclut l'ID technique de MongoDB pour éviter les collisions de clés primaires
      delete restoredDataObject._id;
      delete restoredDataObject.createdAt;
      delete restoredDataObject.updatedAt;

      const updatedConfig = await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: restoredDataObject },
        { new: true, runValidators: true }
      );

      return res.json({ message: 'Configuration restaurée à son état précédent.', config: updatedConfig });
    } catch (error: any) {
      console.error('Erreur restauration:', error.message);
      return res.status(500).json({ error: 'Échec du processus de restauration.' });
    }
  }

  // 3. Exporte la liste des sauvegardes d'un serveur
  static async listBackups(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;

    try {
      const backups = await Backup.find({ guildId }).sort({ createdAt: -1 });
      return res.json(backups);
    } catch (error: any) {
      return res.status(500).json({ error: 'Impossible d\'extraire l\'historique.' });
    }
  }
}