import type {
  Response,
  NextFunction,
} from 'express';

import type {
  AuthenticatedRequest,
} from './auth.ts';

import { GuildConfig } from '../../models/GuildConfig.ts';

import { CONFIG } from '../../config/index.ts';

export async function requirePremium(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const guildId =
    String(
      req.params.guildId || '',
    ).trim();

  const user =
    req.user;

  try {
    /*
     * =========================================================
     * OWNER OMNIX
     * =========================================================
     */

    if (
      user?.discordId &&
      CONFIG.OWNER_IDS.includes(
        user.discordId,
      )
    ) {
      next();
      return;
    }

    /*
     * =========================================================
     * PREMIUM UTILISATEUR
     * =========================================================
     */

    if (
      user?.isPremium === true ||
      user?.isAdmin === true
    ) {
      console.log(
        `[Premium Check] 💎 Accès Premium utilisateur : ${user.username}`,
      );

      next();

      return;
    }

    /*
     * =========================================================
     * GUILD ID
     * =========================================================
     */

    if (
      !/^\d{17,20}$/.test(
        guildId,
      )
    ) {
      res.status(400).json({
        success: false,
        error:
          'Identifiant de serveur invalide.',
        code:
          'INVALID_GUILD_ID',
      });

      return;
    }

    /*
     * =========================================================
     * PREMIUM GUILD
     * =========================================================
     */

    const config =
      await GuildConfig.findOne({
        guildId,
      }).lean();

    const isGuildPremium =
      Boolean(
        (config as any)?.premium
          ?.isPremium,
      );

    if (!isGuildPremium) {
      console.warn(
        `[Premium Check] 🚫 Serveur non Premium : ${guildId}`,
      );

      res.status(403).json({
        success: false,
        error:
          'Fonctionnalité Premium.',
        code:
          'PREMIUM_REQUIRED',
        message:
          'Cette fonctionnalité nécessite une licence Premium active.',
      });

      return;
    }

    console.log(
      `[Premium Check] 💎 Premium serveur confirmé : ${guildId}`,
    );

    next();

  } catch (error) {
    console.error(
      '[Premium Check] ❌ Erreur :',
      error,
    );

    res.status(500).json({
      success: false,
      error:
        'Erreur lors de la validation du statut Premium.',
      code:
        'PREMIUM_CHECK_ERROR',
    });
  }
}

export default requirePremium;