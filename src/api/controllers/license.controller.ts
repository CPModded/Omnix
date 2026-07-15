/**
 * ====================================================================
 * CONTRÔLEUR D'ACTIVATION DES LICENCES PREMIUM (DASHBOARD)
 * ====================================================================
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { License } from '../../models/License';
import { GuildConfig } from '../../models/GuildConfig';

export class LicenseController {
  static async activateLicense(req: AuthenticatedRequest, res: Response) {
    const { licenseKey, guildId } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Identification requise.' });
    }

    try {
      const license = await License.findOne({ key: licenseKey });

      if (!license) {
        return res.status(404).json({ error: 'Cette clé de licence est invalide.' });
      }

      if (license.status !== 'active') {
        return res.status(400).json({ error: `Cette clé de licence est déjà ${license.status}.` });
      }

      // Application immédiate de l'abonnement Premium sur la configuration du serveur
      let guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) {
        guildConfig = new GuildConfig({ guildId });
      }

      const now = new Date();
      let expiresAt: Date | null = null;
      if (license.durationInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(now.getDate() + license.durationInDays);
      }

      guildConfig.premium.isPremium = true;
      guildConfig.premium.tier = license.tier;
      guildConfig.premium.expiresAt = expiresAt;

      await guildConfig.save();

      // Consommation et mise à jour du statut de la clé de licence
      license.status = 'used';
      license.activatedGuildId = guildId;
      license.activatedAt = now;
      license.expiresAt = expiresAt;
      
      await license.save();

      console.log(`[Licensing] ✅ Licence ${license.tier.toUpperCase()} consommée par ${user.username} sur le serveur : ${guildId}`);

      return res.json({
        message: `Licence ${license.tier.toUpperCase()} activée avec succès pour votre serveur.`,
        expiresAt: expiresAt
      });

    } catch (error: any) {
      console.error('Erreur lors de l\'activation de la licence :', error.message);
      return res.status(500).json({ error: 'Échec de l\'activation de la licence.' });
    }
  }
}