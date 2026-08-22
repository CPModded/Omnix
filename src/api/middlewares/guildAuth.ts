import type {
  Response,
  NextFunction,
} from 'express';

import type {
  AuthenticatedRequest,
} from './auth.ts';

import { User } from '../../models/User.ts';

import { CONFIG } from '../../config/index.ts';

export interface GuildAuthenticatedRequest
  extends AuthenticatedRequest {
  guildId?: string;
}

/**
 * Vérifie que l'utilisateur peut gérer une guild.
 *
 * Hiérarchie :
 *
 * 1. Owner OMNIX
 * 2. Admin OMNIX
 * 3. Owner Discord
 * 4. Administrator Discord
 * 5. Refus
 */
export async function canManageGuild(
  req: GuildAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const guildId =
      String(
        req.params.guildId || '',
      ).trim();

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
          'Identifiant de serveur Discord invalide.',
        code:
          'INVALID_GUILD_ID',
      });

      return;
    }

    /*
     * =========================================================
     * AUTH
     * =========================================================
     */

    if (!req.user?.discordId) {
      res.status(401).json({
        success: false,
        error:
          'Authentification requise.',
        code:
          'AUTH_REQUIRED',
      });

      return;
    }

    const discordId =
      req.user.discordId;

    /*
     * =========================================================
     * OWNER OMNIX
     * =========================================================
     */

    const isOmnixOwner =
      CONFIG.OWNER_IDS.includes(
        discordId,
      );

    if (isOmnixOwner) {
      req.guildId =
        guildId;

      next();

      return;
    }

    /*
     * =========================================================
     * USER DATABASE
     * =========================================================
     */

    const user =
      await User.findOne({
        discordId,
      }).lean();

    if (!user) {
      res.status(403).json({
        success: false,
        error:
          'Utilisateur OMNIX introuvable.',
        code:
          'USER_NOT_FOUND',
      });

      return;
    }

    /*
     * =========================================================
     * ADMIN OMNIX
     * =========================================================
     */

    if (
      user.isAdmin === true
    ) {
      req.guildId =
        guildId;

      next();

      return;
    }

    /*
     * =========================================================
     * FIND GUILD
     * =========================================================
     */

    const guilds =
      Array.isArray(
        user.guilds,
      )
        ? user.guilds
        : [];

    const guild =
      guilds.find(
        (item) =>
          String(
            item?.id || '',
          ) === guildId,
      );

    if (!guild) {
      res.status(403).json({
        success: false,
        error:
          'Vous ne pouvez pas gérer ce serveur.',
        code:
          'GUILD_ACCESS_DENIED',
      });

      return;
    }

    /*
     * =========================================================
     * DISCORD OWNER
     * =========================================================
     */

    if (
      guild.owner === true
    ) {
      req.guildId =
        guildId;

      next();

      return;
    }

    /*
     * =========================================================
     * DISCORD ADMINISTRATOR
     * =========================================================
     */

    const permissions =
      String(
        guild.permissions ||
          '0',
      );

    try {
      const permissionValue =
        BigInt(
          permissions,
        );

      const ADMINISTRATOR =
        0x8n;

      const isAdministrator =
        (
          permissionValue &
          ADMINISTRATOR
        ) ===
        ADMINISTRATOR;

      if (
        isAdministrator
      ) {
        req.guildId =
          guildId;

        next();

        return;
      }
    } catch {
      // Permissions invalides → refus.
    }

    /*
     * =========================================================
     * REFUS
     * =========================================================
     */

    res.status(403).json({
      success: false,
      error:
        'Vous devez être propriétaire ou administrateur du serveur.',
      code:
        'GUILD_PERMISSION_DENIED',
    });

  } catch (error) {
    console.error(
      '[GuildAuth] ❌ Erreur :',
      error,
    );

    res.status(500).json({
      success: false,
      error:
        'Erreur lors de la vérification du serveur.',
      code:
        'GUILD_AUTH_ERROR',
    });
  }
}

export default canManageGuild;