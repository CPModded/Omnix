import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { License } from '../../models/License';
import { GuildConfig } from '../../models/GuildConfig';

export class LicenseController {
  // Activation d'une clé de licence sur un serveur ciblé
  static async activateLicense(req: AuthenticatedRequest, res: Response) {
    const { licenseKey, guildId } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Identification requise.' });
    }

    try {
      // 1. Recherche de la clé de licence
      const license = await License.findOne({ key: licenseKey });

      if (!license) {
        return res.status(404).json({ error: 'Cette clé de licence est invalide.' });
      }

      if (license.status !== 'active') {
        return res.status(400).json({ error: `Cette clé de licence est déjà ${license.status}.` });
      }

      // 2. Recherche et mise à jour de la configuration du serveur (Guild ID)
      let guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) {
        guildConfig = new GuildConfig({ guildId });
      }

      // Calcul de l'expiration
      const now = new Date();
      let expiresAt: Date | null = null;
      if (license.durationInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(now.getDate() + license.durationInDays);
      }

      // Application des modifications premium
      guildConfig.premium.isPremium = true;
      guildConfig.premium.tier = license.tier;
      guildConfig.premium.expiresAt = expiresAt;

      await guildConfig.save();

      // 3. Changement du statut de la licence
      license.status = 'used';
      license.activatedGuildId = guildId;
      license.activatedAt = now;
      license.expiresAt = expiresAt;
      
      await license.save();

      return res.json({
        message: `Licence ${license.tier.toUpperCase()} activée avec succès pour le serveur ${guildId}.`,
        expiresAt: expiresAt
      });

    } catch (error: any) {
      console.error('Erreur lors de l\'activation de la licence :', error.message);
      return res.status(500).json({ error: 'Échec du traitement de la licence.' });
    }
  }
}