import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth';
import { GuildConfig } from '../../models/GuildConfig';
import { updateGuildConfig } from '../../bot/utils/guildConfig';

const PREMIUM_MODULES = new Set(['ai', 'backups', 'honeypot']);

function hasActiveGuildPremium(config: any): boolean {
  const premium = config?.premium;
  const expiresAt = premium?.expiresAt ? new Date(premium.expiresAt).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return false;
  return Boolean(premium?.isPremium || (config?.plan && config.plan !== 'free'));
}

function normalizeDashboardPayload(input: any): Record<string, unknown> {
  const body = input && typeof input === 'object' ? { ...input } : {};
  const modules = body.modules && typeof body.modules === 'object' ? { ...body.modules } : {};

  // Compatibilité dashboard → modèle MongoDB.
  if (modules.welcome?.useEmbed !== undefined && modules.welcome.embed === undefined) {
    modules.welcome = { ...modules.welcome, embed: Boolean(modules.welcome.useEmbed) };
  }
  if (modules.goodbye?.useEmbed !== undefined && modules.goodbye.embed === undefined) {
    modules.goodbye = { ...modules.goodbye, embed: Boolean(modules.goodbye.useEmbed) };
  }

  if (modules.welcome && typeof modules.welcome === 'object') delete modules.welcome.useEmbed;
  if (modules.goodbye && typeof modules.goodbye === 'object') delete modules.goodbye.useEmbed;

  return { ...body, modules };
}

export class GuildConfigController {
  static async getConfig(req: AuthenticatedRequest, res: Response) {
    const guildId = String(req.params.guildId || '').trim();
    if (!/^\d{17,20}$/.test(guildId)) {
      return res.status(400).json({ success: false, error: 'Identifiant de serveur invalide.' });
    }

    try {
      const config = await GuildConfig.findOne({ guildId });
      if (!config) {
        const created = await updateGuildConfig(guildId, {});
        return res.json(created);
      }
      return res.json(config);
    } catch (error) {
      console.error('[Config API] GET', error);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération de la configuration.' });
    }
  }

  static async updateConfig(req: AuthenticatedRequest, res: Response) {
    const guildId = String(req.params.guildId || '').trim();
    if (!/^\d{17,20}$/.test(guildId)) {
      return res.status(400).json({ success: false, error: 'Identifiant de serveur invalide.' });
    }

    try {
      const payload = normalizeDashboardPayload(req.body);
      const current = await GuildConfig.findOne({ guildId }).lean();
      const requestedModules = payload.modules && typeof payload.modules === 'object' ? payload.modules as Record<string, any> : {};
      const premiumActive = hasActiveGuildPremium(current);

      // Les modules Premium sont contrôlés côté serveur. Le navigateur ne peut
      // donc pas contourner la formule Free en envoyant directement du JSON.
      if (!premiumActive) {
        for (const moduleName of PREMIUM_MODULES) {
          if (requestedModules[moduleName] !== undefined) {
            const requested = requestedModules[moduleName];
            if (requested?.enabled === true) {
            return res.status(403).json({
              success: false,
              error: `Le module ${moduleName} est réservé à OMNIX Premium.`,
              code: 'PREMIUM_REQUIRED',
            });
          }
          // Le dashboard envoie parfois le bloc complet même en Free :
          // on ignore ce bloc plutôt que de faire échouer une sauvegarde.
          delete requestedModules[moduleName];
          }
        }
      }

      // Le dashboard et le bot passent par le même service d’écriture.
      // Les champs système/premium ne sont jamais acceptés depuis le navigateur.
      const safePayload: Record<string, unknown> = { ...payload, modules: requestedModules };
      delete safePayload.premium;
      delete safePayload._id;
      delete safePayload.guildId;
      delete safePayload.createdAt;
      delete safePayload.updatedAt;

      const config = await updateGuildConfig(guildId, safePayload);

      return res.json({
        success: true,
        message: 'Paramètres enregistrés et synchronisés avec OMNIX.',
        config,
      });
    } catch (error) {
      console.error('[Config API] PUT', error);
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Données de configuration non conformes.',
      });
    }
  }
}
