import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth';
import { License } from '../../models/License';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';

const guildIdPattern = /^\d{17,20}$/;

function activeExpiry(expiresAt: unknown): Date | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt as any);
  return Number.isFinite(d.getTime()) && d.getTime() > Date.now() ? d : null;
}

export class LicenseController {
  static async activateLicense(req: AuthenticatedRequest, res: Response) {
    const key = String(req.body?.licenseKey || '').trim().toUpperCase();
    const guildId = String(req.body?.guildId || '').trim();
    const user = req.user;
    if (!user?.discordId) return res.status(401).json({ success: false, error: 'Identification requise.' });
    if (!/^OMNIX-[A-Z0-9-]{8,64}$/.test(key) || !guildIdPattern.test(guildId)) {
      return res.status(400).json({ success: false, error: 'Licence ou serveur invalide.' });
    }

    try {
      const now = new Date();
      const license = await License.findOne({
        key,
        buyerId: user.discordId,
        status: { $in: ['active', 'used'] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      });
      if (!license) return res.status(404).json({ success: false, error: 'Licence introuvable, expirée ou non attribuée à votre compte.', code: 'LICENSE_NOT_AVAILABLE' });

      const ids = Array.from(new Set([
        ...(Array.isArray((license as any).activatedGuildIds) ? (license as any).activatedGuildIds.map(String) : []),
        ...((license as any).activatedGuildId ? [String((license as any).activatedGuildId)] : []),
      ]));
      const maxGuilds = Math.max(1, Number((license as any).maxGuilds || 10));
      if (ids.includes(guildId)) {
        return res.status(200).json({ success: true, message: 'Ce serveur utilise déjà cette licence.', alreadyActive: true, guildId, activatedGuildIds: ids, maxGuilds });
      }
      if (ids.length >= maxGuilds) {
        return res.status(409).json({ success: false, error: `La licence a atteint sa limite de ${maxGuilds} serveurs Premium.`, code: 'PREMIUM_SERVER_LIMIT', maxGuilds, activatedGuildIds: ids });
      }

      const expiresAt = Number(license.durationInDays || 0) > 0
        ? new Date(now.getTime() + Number(license.durationInDays) * 86400000)
        : activeExpiry((license as any).expiresAt);
      (license as any).expiresAt = expiresAt;
      (license as any).status = 'used';
      (license as any).activatedGuildIds = [...ids, guildId];
      if (!(license as any).activatedGuildId) (license as any).activatedGuildId = guildId;
      (license as any).activatedAt = (license as any).activatedAt || now;
      await license.save();

      const config = await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: { plan: license.tier, 'premium.isPremium': true, 'premium.tier': license.tier, 'premium.expiresAt': expiresAt, premiumExpiresAt: expiresAt }, $setOnInsert: { guildId } },
        { new: true, upsert: true, runValidators: true },
      );
      return res.json({ success: true, message: `Serveur Premium activé avec succès.`, expiresAt, guildId, activatedGuildIds: (license as any).activatedGuildIds, maxGuilds, config });
    } catch (e) {
      console.error('[Licensing] activation', e);
      return res.status(500).json({ success: false, error: 'Échec de l’activation de la licence.' });
    }
  }

  static async activatePremiumServer(req: AuthenticatedRequest, res: Response) {
    const guildId = String(req.body?.guildId || '').trim();
    const discordId = String(req.user?.discordId || '').trim();
    if (!discordId) return res.status(401).json({ success: false, error: 'Identification requise.' });
    if (!guildIdPattern.test(guildId)) return res.status(400).json({ success: false, error: 'Identifiant de serveur invalide.' });

    try {
      const user = await User.findOne({ discordId }).select('isPremium premiumExpiresAt').lean();
      const userPremium = Boolean(user?.isPremium && (!user?.premiumExpiresAt || new Date(user.premiumExpiresAt).getTime() > Date.now()));
      const now = new Date();
      const license = await License.findOne({
        buyerId: discordId,
        status: { $in: ['active', 'used'] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      }).sort({ createdAt: -1 });

      const ids = Array.from(new Set([
        ...(Array.isArray((license as any)?.activatedGuildIds) ? (license as any).activatedGuildIds.map(String) : []),
        ...((license as any)?.activatedGuildId ? [String((license as any).activatedGuildId)] : []),
      ]));
      const maxGuilds = Math.max(1, Number((license as any)?.maxGuilds || 10));
      const existingPremiumCount = await GuildConfig.countDocuments({ 'premium.isPremium': true, ownerId: discordId });

      if (!license && !userPremium) return res.status(403).json({ success: false, error: 'Aucun Premium actif n’est associé à votre compte.', code: 'PREMIUM_REQUIRED' });
      if (ids.includes(guildId) || (await GuildConfig.exists({ guildId, 'premium.isPremium': true }))) {
        return res.json({ success: true, alreadyActive: true, guildId, message: 'Ce serveur est déjà Premium.', activatedGuildIds: ids, maxGuilds });
      }
      if (license && ids.length >= maxGuilds) return res.status(409).json({ success: false, error: `Votre Premium est limité à ${maxGuilds} serveurs.`, code: 'PREMIUM_SERVER_LIMIT', maxGuilds, activatedGuildIds: ids });
      if (!license && existingPremiumCount >= 10) return res.status(409).json({ success: false, error: 'Votre Premium est limité à 10 serveurs.', code: 'PREMIUM_SERVER_LIMIT', maxGuilds: 10 });

      const expiresAt = license ? activeExpiry((license as any).expiresAt) : activeExpiry(user?.premiumExpiresAt);
      const tier = license?.tier || 'premium';
      await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: { plan: tier, 'premium.isPremium': true, 'premium.tier': tier, 'premium.expiresAt': expiresAt, premiumExpiresAt: expiresAt, ownerId: discordId }, $setOnInsert: { guildId } },
        { new: true, upsert: true, runValidators: true },
      );

      if (license) {
        (license as any).activatedGuildIds = [...ids, guildId];
        if (!(license as any).activatedGuildId) (license as any).activatedGuildId = guildId;
        (license as any).activatedAt = (license as any).activatedAt || now;
        await license.save();
      }
      return res.json({ success: true, message: 'Serveur Premium activé et enregistré.', guildId, activatedGuildIds: [...ids, guildId], maxGuilds: license ? maxGuilds : 10, expiresAt });
    } catch (e) {
      console.error('[Licensing] premium server activation', e);
      return res.status(500).json({ success: false, error: 'Impossible d’activer Premium sur ce serveur.' });
    }
  }
}
