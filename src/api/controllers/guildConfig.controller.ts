import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';
import { License } from '../../models/License';
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
      // Toujours partir de la configuration canonique MongoDB.
      // Une licence utilisateur Premium doit également pouvoir être
      // répercutée sur le serveur géré depuis le dashboard.
      let config = await GuildConfig.findOne({ guildId });
      if (!config) {
        config = await updateGuildConfig(guildId, {});
      }

      const discordId = String(req.user?.discordId || '').trim();
      if (discordId) {
        const user = await User.findOne({ discordId })
          .select('isPremium')
          .lean();
        const now = new Date();
        const license = await License.findOne({
          buyerId: discordId,
          $or: [
            { status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
            { status: 'used', activatedGuildId: guildId, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          ],
        }).sort({ createdAt: -1 }).lean();

        const userPremium = Boolean(user?.isPremium) || Boolean(license);
        const currentExpiry = config.premium?.expiresAt
          ? new Date(config.premium.expiresAt).getTime()
          : 0;
        const guildPremiumExpired = Boolean(currentExpiry && currentExpiry <= Date.now());

        if (userPremium && (!config.premium?.isPremium || guildPremiumExpired || license)) {
          const expiresAt = license?.expiresAt || (config.premium?.expiresAt ?? null);
          const tier = license?.tier || config.premium?.tier || 'premium';
          config = await GuildConfig.findOneAndUpdate(
            { guildId },
            {
              $set: {
                plan: tier,
                'premium.isPremium': true,
                'premium.tier': tier,
                'premium.expiresAt': expiresAt,
                premiumExpiresAt: expiresAt,
              },
            },
            { new: true },
          ) || config;
        } else if (!userPremium && guildPremiumExpired) {
          config = await GuildConfig.findOneAndUpdate(
            { guildId },
            {
              $set: {
                plan: 'free',
                'premium.isPremium': false,
                'premium.tier': 'free',
                'premium.expiresAt': null,
                premiumExpiresAt: null,
              },
            },
            { new: true },
          ) || config;
        }
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

      // Le même statut Premium que celui affiché par le dashboard est
      // utilisé pour l'enregistrement. Cela évite le cas où l'interface
      // affiche Premium alors que l'API considère encore le serveur Free.
      let premiumActive = hasActiveGuildPremium(current);
      if (!premiumActive && req.user?.discordId) {
        const discordId = String(req.user.discordId);
        const user = await User.findOne({ discordId }).select('isPremium').lean();
        const now = new Date();
        const personalLicense = await License.findOne({
          buyerId: discordId,
          $or: [
            { status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
            { status: 'used', activatedGuildId: guildId, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          ],
        }).lean();
        premiumActive = Boolean(user?.isPremium || personalLicense);

        if (premiumActive) {
          const expiresAt = personalLicense?.expiresAt || current?.premium?.expiresAt || null;
          const tier = personalLicense?.tier || current?.premium?.tier || 'premium';
          await GuildConfig.updateOne(
            { guildId },
            { $set: { plan: tier, 'premium.isPremium': true, 'premium.tier': tier, 'premium.expiresAt': expiresAt, premiumExpiresAt: expiresAt }, $setOnInsert: { guildId } },
            { upsert: true },
          );
        }
      }

      // Les modules Premium sont contrôlés côté serveur. Le navigateur ne peut
      // donc pas contourner la formule Free en envoyant directement du JSON.
      if (!premiumActive) {
        for (const moduleName of PREMIUM_MODULES) {
          if (requestedModules[moduleName] === undefined) continue;

          const requested = requestedModules[moduleName];
          const currentEnabled = Boolean(current?.modules?.[moduleName]?.enabled);
          const requestedEnabled = Boolean(requested?.enabled);

          // Un enregistrement du dashboard renvoie souvent plusieurs modules
          // à la fois. On ne doit pas bloquer toute la sauvegarde simplement
          // parce qu'un module Premium est présent dans le payload.
          //
          // Free :
          // - false -> false : autorisé (aucun changement Premium)
          // - true  -> false : autorisé (désactivation)
          // - false -> true  : refusé (activation Premium)
          // - true  -> true  : on ignore le bloc et on conserve l'état serveur
          //   afin qu'une sauvegarde d'une autre option ne casse pas.
          if (requestedEnabled && !currentEnabled) {
            return res.status(403).json({
              success: false,
              error: `Le module ${moduleName} est réservé à OMNIX Premium.`,
              code: 'PREMIUM_REQUIRED',
            });
          }

          // Le dashboard envoie parfois le bloc complet même en Free.
          // La configuration Premium reste donc entièrement pilotée par le
          // serveur et n'écrase jamais un état Premium existant.
          delete requestedModules[moduleName];
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
