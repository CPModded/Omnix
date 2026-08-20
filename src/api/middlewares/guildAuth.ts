import type {
  Response,
  NextFunction,
} from 'express';
import type {
  AuthenticatedRequest,
} from './auth.ts';
import { Client } from 'discord.js';
/* =========================================================
   DISCORD CLIENT
========================================================= */
let discordClient: Client | null = null;
/**
 * Enregistre le vrai client Discord.
 *
 * À appeler depuis src/index.ts après création
 * du client Discord.
 */
export function registerGuildAuthClient(
  client: Client
): void {
  discordClient = client;
  console.log(
    '[GuildAuth] Client Discord enregistré.'
  );
}
/* =========================================================
   GET GUILD
========================================================= */
function getGuild(
  guildId: string
) {
  if (!discordClient) {
    return null;
  }
  return discordClient.guilds.cache.get(
    guildId
  ) ?? null;
}
/* =========================================================
   GET USER ID
========================================================= */
function getUserId(
  req: AuthenticatedRequest
): string | null {
  const user =
    req.user;
  if (!user) {
    return null;
  }
  return String(
    user.id ??
    user.discordId ??
    user.userId ??
    ''
  ) || null;
}
/* =========================================================
   CAN MANAGE GUILD
========================================================= */
/**
 * Vérifie :
 *
 * 1. que l'utilisateur est authentifié
 * 2. que le client Discord est disponible
 * 3. que le serveur existe
 * 4. que l'utilisateur possède les permissions
 *    nécessaires sur ce serveur
 */
export function canManageGuild(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    /* =====================================================
       AUTH
    ===================================================== */
    const userId =
      getUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    /* =====================================================
       GUILD ID
    ===================================================== */
    const guildId =
      String(
        req.params.guildId || ''
      ).trim();
    if (!guildId) {
      res.status(400).json({
        success: false,
        error: 'Identifiant du serveur manquant.',
        code: 'GUILD_ID_REQUIRED',
      });
      return;
    }
    /* =====================================================
       DISCORD CLIENT
    ===================================================== */
    if (!discordClient) {
      res.status(503).json({
        success: false,
        error: 'Le client Discord est temporairement indisponible.',
        code: 'DISCORD_UNAVAILABLE',
      });
      return;
    }
    /* =====================================================
       GUILD
    ===================================================== */
    const guild =
      getGuild(
        guildId
      );
    if (!guild) {
      res.status(404).json({
        success: false,
        error: 'Serveur Discord introuvable.',
        code: 'GUILD_NOT_FOUND',
      });
      return;
    }
    /* =====================================================
       MEMBER
    ===================================================== */
    const member =
      guild.members.cache.get(
        userId
      );
    /*
     * Le membre peut ne pas être dans le cache.
     *
     * On tente une récupération Discord.
     */
    if (!member) {
      guild.members
        .fetch(userId)
        .then(
          fetchedMember => {
            const permissions =
              fetchedMember.permissions;
            const manageable =
              fetchedMember.id ===
                guild.ownerId ||
              permissions.has(
                'Administrator'
              ) ||
              permissions.has(
                'ManageGuild'
              );
            if (!manageable) {
              res.status(403).json({
                success: false,
                error:
                  'Vous ne possédez pas les permissions nécessaires sur ce serveur.',
                code:
                  'GUILD_PERMISSION_DENIED',
              });
              return;
            }
            /*
             * On conserve le serveur et le membre
             * pour les contrôleurs suivants.
             */
            (
              req as AuthenticatedRequest & {
                guild?: typeof guild;
                guildMember?: typeof fetchedMember;
              }
            ).guild =
              guild;
            (
              req as AuthenticatedRequest & {
                guild?: typeof guild;
                guildMember?: typeof fetchedMember;
              }
            ).guildMember =
              fetchedMember;
            next();
          }
        )
        .catch(
          error => {
            console.warn(
              '[GuildAuth] Impossible de récupérer le membre :',
              error
            );
            res.status(403).json({
              success: false,
              error:
                'Impossible de vérifier vos permissions sur ce serveur.',
              code:
                'GUILD_MEMBER_UNAVAILABLE',
            });
          }
        );
      return;
    }
    /* =====================================================
       PERMISSIONS
    ===================================================== */
    const permissions =
      member.permissions;
    const manageable =
      member.id ===
        guild.ownerId ||
      permissions.has(
        'Administrator'
      ) ||
      permissions.has(
        'ManageGuild'
      );
    if (!manageable) {
      res.status(403).json({
        success: false,
        error:
          'Vous ne possédez pas les permissions nécessaires sur ce serveur.',
        code:
          'GUILD_PERMISSION_DENIED',
      });
      return;
    }
    /* =====================================================
       STORE CONTEXT
    ===================================================== */
    (
      req as AuthenticatedRequest & {
        guild?: typeof guild;
        guildMember?: typeof member;
      }
    ).guild =
      guild;
    (
      req as AuthenticatedRequest & {
        guild?: typeof guild;
        guildMember?: typeof member;
      }
    ).guildMember =
      member;
    next();
  } catch (error) {
    console.error(
      '[GuildAuth] Erreur :',
      error
    );
    res.status(500).json({
      success: false,
      error:
        'Erreur lors de la vérification des permissions.',
      code:
        'GUILD_AUTH_ERROR',
    });
  }
}
/* =========================================================
   EXPORT DEFAULT
========================================================= */
export default {
  registerGuildAuthClient,
  canManageGuild,
};