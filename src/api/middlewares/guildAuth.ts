import type {
  Response,
  NextFunction,
} from 'express';

import type { AuthenticatedRequest } from './auth.ts';

import { User } from '../../models/User.ts';

export interface GuildAuthenticatedRequest
  extends AuthenticatedRequest {
  guildId?: string;
}

/**
 * Vérifie que l'utilisateur peut gérer le serveur.
 *
 * Owner OMNIX :
 * → accès complet
 *
 * Sinon :
 * → le guild doit être présent dans les guilds
 *   enregistrés pour l'utilisateur.
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

    if (!guildId) {
      res.status(400).json({
        success: false,
        error: 'Guild ID manquant.',
        code: 'GUILD_ID_REQUIRED',
      });

      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentification requise.',
        code: 'AUTH_REQUIRED',
      });

      return;
    }

    /*
     * Owner OMNIX
     *
     * Accès complet.
     */
    if (req.user.isOwner) {
      req.guildId = guildId;
      next();
      return;
    }

    const user =
      await User.findOne({
        discordId:
          req.user.discordId,
      }).lean();

    if (!user) {
      res.status(403).json({
        success: false,
        error: 'Utilisateur OMNIX introuvable.',
        code: 'USER_NOT_FOUND',
      });

      return;
    }

    const guilds =
      Array.isArray(
        (user as any).guilds,
      )
        ? (user as any).guilds
        : [];

    const guild =
      guilds.find(
        (item: any) =>
          String(item?.id) ===
          guildId,
      );

    if (!guild) {
      res.status(403).json({
        success: false,
        error:
          'Vous ne pouvez pas gérer ce serveur.',
        code: 'GUILD_ACCESS_DENIED',
      });

      return;
    }

    req.guildId = guildId;

    next();
  } catch (error) {
    console.error(
      '[GuildAuth] Erreur:',
      error,
    );

    res.status(500).json({
      success: false,
      error:
        'Erreur lors de la vérification du serveur.',
      code: 'GUILD_AUTH_ERROR',
    });
  }
}

export default canManageGuild;