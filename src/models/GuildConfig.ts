import type {
  Response,
  NextFunction,
} from 'express';
import type {
  AuthenticatedRequest,
} from './auth.ts';
import { User } from './User.ts';
/* =========================================================
   OMNIX — GUILD AUTHENTICATION
========================================================= */
export interface GuildAuthenticatedRequest
  extends AuthenticatedRequest {
  guildId?: string;
}
/* =========================================================
   DISCORD PERMISSION
========================================================= */
function hasAdministratorPermission(
  permissions?: string,
): boolean {
  if (!permissions) {
    return false;
  }
  try {
    const value = BigInt(
      String(permissions),
    );
    return (
      (value & 0x8n) ===
      0x8n
    );
  } catch {
    return false;
  }
}
/* =========================================================
   GUILD ACCESS
========================================================= */
/**
 * Vérifie que l'utilisateur peut gérer le serveur.
 *
 * Autorisation :
 *
 * 1. Owner OMNIX
 * 2. Propriétaire Discord du serveur
 * 3. Administrateur Discord du serveur
 *
 * La simple présence du serveur dans `user.guilds`
 * ne suffit PAS.
 */
export async function canManageGuild(
  req: GuildAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /* -----------------------------------------------------
       AUTHENTICATION
    ----------------------------------------------------- */
    if (!req.user?.discordId) {
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
       OMNIX OWNER
       
       Owner du bot = accès complet.
    ----------------------------------------------------- */
    if (req.user.isOwner) {
      req.guildId = guildId;
      next();
      return;
    }
    /* -----------------------------------------------------
       GET USER
    ----------------------------------------------------- */
    const user =
      await User.findOne({
        discordId:
          req.user.discordId,
      }).lean();
    if (!user) {
      res.status(403).json({
        success: false,
        error:
          'Utilisateur OMNIX introuvable.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }
    /* -----------------------------------------------------
       FIND GUILD
    ----------------------------------------------------- */
    const guilds =
      Array.isArray(user.guilds)
        ? user.guilds
        : [];
    const guild =
      guilds.find(
        (item) =>
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
    /* -----------------------------------------------------
       DISCORD OWNER
    ----------------------------------------------------- */
    if (guild.owner === true) {
      req.guildId = guildId;
      next();
      return;
    }
    /* -----------------------------------------------------
       DISCORD ADMINISTRATOR
    ----------------------------------------------------- */
    if (
      hasAdministratorPermission(
        guild.permissions,
      )
    ) {
      req.guildId = guildId;
      next();
      return;
    }
    /* -----------------------------------------------------
       ACCESS DENIED
    ----------------------------------------------------- */
    console.warn(
      `[GuildAuth] 🚫 Accès refusé : ${req.user.discordId} → ${guildId}`,
    );
    res.status(403).json({
      success: false,
      error:
        'Vous devez être propriétaire ou administrateur de ce serveur.',
      code: 'GUILD_MANAGE_REQUIRED',
    });
  } catch (error) {
    console.error(
      '[GuildAuth] Erreur :',
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