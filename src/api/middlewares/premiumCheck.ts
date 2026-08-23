import type {
  Response,
  NextFunction,
} from 'express';

import type {
  AuthenticatedRequest,
} from './auth.ts';

import { GuildConfig } from '../../models/GuildConfig.ts';

/* =========================================================
   OMNIX — PREMIUM CHECK
========================================================= */

/**
 * Vérifie si une fonctionnalité Premium est accessible.
 *
 * Ordre d'autorisation :
 *
 * 1. Owner OMNIX
 * 2. Admin OMNIX
 * 3. Premium personnel
 * 4. Premium serveur
 *
 * Prérequis :
 *
 * - isAuthenticated
 * - req.user
 * - req.params.guildId
 */

export async function requirePremium(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /* -----------------------------------------------------
       AUTHENTIFICATION
    ----------------------------------------------------- */

    const user = req.user;

    if (!user?.discordId) {
      res.status(401).json({
        success: false,
        error: 'Authentification requise.',
        code: 'AUTH_REQUIRED',
      });

      return;
    }

    /* -----------------------------------------------------
       GUILD ID
    ----------------------------------------------------- */

    const guildId =
      String(
        req.params.guildId || '',
      ).trim();

    if (!guildId) {
      res.status(400).json({
        success: false,
        error: 'Guild ID manquant.',
        code: 'GUILD_ID_REQUIRED',
      });

      return;
    }

    /* -----------------------------------------------------
       OWNER OMNIX
       
       Le statut isOwner provient du JWT.
    ----------------------------------------------------- */

    if (user.isOwner) {
      console.log(
        `[Premium Check] 👑 Accès Owner accordé : ${user.discordId}`,
      );

      next();
      return;
    }

    /* -----------------------------------------------------
       ADMIN OMNIX
    ----------------------------------------------------- */

    if (user.isAdmin) {
      console.log(
        `[Premium Check] 🛡️ Accès Admin accordé : ${user.discordId}`,
      );

      next();
      return;
    }

    /* -----------------------------------------------------
       PREMIUM PERSONNEL
    ----------------------------------------------------- */

    if (user.isPremium) {
      console.log(
        `[Premium Check] 💎 Premium utilisateur accordé : ${user.discordId}`,
      );

      next();
      return;
    }

    /* -----------------------------------------------------
       PREMIUM SERVEUR
    ----------------------------------------------------- */

    const guildConfig =
      await GuildConfig.findOne({
        guildId,
      }).lean();

    if (!guildConfig) {
      console.warn(
        `[Premium Check] 🚫 Configuration serveur introuvable : ${guildId}`,
      );

      res.status(403).json({
        success: false,
        error: 'Fonctionnalité Premium.',
        code: 'PREMIUM_REQUIRED',
        message:
          'Ce serveur ne possède pas de licence Premium active.',
      });

      return;
    }

    /* -----------------------------------------------------
       CHECK PREMIUM
    ----------------------------------------------------- */

    const premium =
      (guildConfig as any).premium;

    const isGuildPremium =
      Boolean(
        premium?.isPremium,
      );

    if (!isGuildPremium) {
      console.warn(
        `[Premium Check] 🚫 Serveur non Premium : ${guildId}`,
      );

      res.status(403).json({
        success: false,
        error: 'Fonctionnalité Premium.',
        code: 'PREMIUM_REQUIRED',
        message:
          'Ce serveur ne possède pas de licence Premium active.',
      });

      return;
    }

    /* -----------------------------------------------------
       ACCESS GRANTED
    ----------------------------------------------------- */

    console.log(
      `[Premium Check] 💎 Premium serveur accordé : ${guildId}`,
    );

    next();
  } catch (error) {
    console.error(
      '[Premium Check] Erreur :',
      error,
    );

    res.status(500).json({
      success: false,
      error:
        'Erreur lors de la validation du statut Premium.',
      code: 'PREMIUM_CHECK_ERROR',
    });
  }
}

export default requirePremium;