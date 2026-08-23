import express, {
  type Request,
  type Response,
} from 'express';

import axios from 'axios';

import { User } from '../../models/User';
import GuildConfig from '../../models/GuildConfig';

import {
  getRequestToken,
  verifyJwt,
} from './auth.routes';

const router = express.Router();

const LIVE_DISCORD_CLIENT = () => (globalThis as any).omnixDiscordClient;

function getGuildIconUrl(guildId: string, icon: any): string | null {
  if (!icon) return null;
  const value = String(icon);
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.discordapp.com/icons/${guildId}/${value}.png?size=128`;
}


/*
 * =========================================================
 * OMNIX — GUILD ROUTES
 * =========================================================
 *
 * Routes :
 *
 * GET /api/guilds
 * GET /api/guilds/:guildId
 * GET /api/guilds/:guildId/channels
 * GET /api/guilds/:guildId/roles
 * GET /api/guilds/:guildId/invite
 *
 * Auth :
 *
 * jwt_token cookie
 * OU
 * Authorization: Bearer ...
 *
 * =========================================================
 */


/* =========================================================
   CONFIGURATION
========================================================= */

const DISCORD_API =
  'https://discord.com/api/v10';

const DISCORD_BOT_TOKEN =
  process.env.DISCORD_TOKEN ||
  process.env.DISCORD_BOT_TOKEN ||
  '';

const DISCORD_CLIENT_ID =
  process.env.DISCORD_CLIENT_ID ||
  (process.env as any).CLIENT_ID ||
  '';

const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  '';


/* =========================================================
   TYPES
========================================================= */

interface OmnixGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color?: number;
  position?: number;
  permissions?: string;
  managed?: boolean;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}


/* =========================================================
   HELPERS
========================================================= */

/**
 * Récupère l'utilisateur connecté depuis le JWT.
 */
async function getAuthenticatedUser(
  req: Request,
) {
  const token =
    getRequestToken(req);

  if (!token) {
    return null;
  }

  const payload =
    verifyJwt(token);

  if (
    !payload?.discordId
  ) {
    return null;
  }

  const user =
    await User.findOne({
      discordId:
        payload.discordId,
    });

  return user;
}


/**
 * Convertit un objet guild MongoDB
 * vers un format propre pour le frontend.
 */
function normalizeGuild(
  guild: any,
): OmnixGuild {
  const id = String(guild?.id || guild?.guildId || '');
  return {
    id,
    name: String(guild?.name || 'Serveur Discord'),
    icon: getGuildIconUrl(id, guild?.icon),
    owner: Boolean(guild?.owner),
    permissions: String(guild?.permissions || '0'),
    features: Array.isArray(guild?.features) ? guild.features : [],
  };
}


/**
 * Vérifie que l'utilisateur possède
 * bien accès à la guild.
 */
function userCanManageGuild(
  user: any,
  guildId: string,
): boolean {
  if (!user) {
    return false;
  }

  const guilds =
    Array.isArray(user.guilds)
      ? user.guilds
      : [];

  const guild =
    guilds.find(
      (item: any) =>
        String(
          item?.id ||
          item?.guildId ||
          '',
        ) === guildId,
    );

  if (!guild) {
    return false;
  }

  /*
   * Owner.
   */

  if (
    guild.owner === true
  ) {
    return true;
  }

  /*
   * Administrator.
   */

  const permissions =
    String(
      guild.permissions ||
      '0',
    );

  try {
    const value =
      BigInt(permissions);

    const ADMINISTRATOR =
      0x8n;

    return (
      (
        value &
        ADMINISTRATOR
      ) ===
      ADMINISTRATOR
    );
  } catch {
    return false;
  }
}


/**
 * Vérifie si OMNIX est présent
 * sur un serveur.
 */
async function isBotInGuild(
  guildId: string,
): Promise<boolean> {
  if (
    !DISCORD_BOT_TOKEN
  ) {
    return false;
  }

  try {
    await axios.get(
      `${DISCORD_API}/guilds/${guildId}`,
      {
        headers: {
          Authorization:
            `Bot ${DISCORD_BOT_TOKEN}`,
        },

        timeout: 8000,
      },
    );

    return true;
  } catch {
    return false;
  }
}


/**
 * URL d'invitation OMNIX.
 */
function getBotInviteUrl(
  guildId?: string,
): string | null {
  if (!DISCORD_CLIENT_ID) {
    return null;
  }

  const params =
    new URLSearchParams({
      client_id:
        DISCORD_CLIENT_ID,

      scope:
        'bot applications.commands',

      permissions:
        '8',
    });

  /*
   * Si Discord connaît déjà le serveur,
   * on ouvre directement le sélecteur avec
   * le serveur présélectionné.
   */
  if (guildId) {
    params.set(
      'guild_id',
      guildId,
    );
  }

  return (
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
}


/**
 * Récupère une guild précise depuis
 * la liste sauvegardée de l'utilisateur.
 */
function findUserGuild(
  user: any,
  guildId: string,
): any | null {
  const guilds =
    Array.isArray(user?.guilds)
      ? user.guilds
      : [];

  return (
    guilds.find(
      (guild: any) =>
        String(
          guild?.id ||
          guild?.guildId ||
          '',
        ) === guildId,
    ) ||
    null
  );
}


/* =========================================================
   GET /api/guilds
========================================================= */

router.get(
  '/',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      console.log(
        '[Guilds] 📥 Récupération des serveurs Discord',
      );

      const user =
        await getAuthenticatedUser(
          req,
        );

      if (!user) {
        console.warn(
          '[Guilds] ❌ Utilisateur non authentifié.',
        );

        return res.status(401).json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',

          guilds:
            [],
        });
      }

      const rawGuilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds
          : [];

      const guilds =
        rawGuilds
          .map(normalizeGuild)
          .filter(
            (guild) =>
              Boolean(
                guild.id,
              ),
          );

      console.log(
        `[Guilds] ✓ ${guilds.length} serveur(s) pour : ${
          (user as any).username
        }`,
      );

      /*
       * On vérifie uniquement les guilds
       * si nécessaire.
       *
       * Ne pas appeler Discord pour chaque guild
       * à chaque chargement du dashboard.
       */

      const result =
        await Promise.all(
          guilds.map(
            async (guild) => {
              const liveClient = LIVE_DISCORD_CLIENT();
              const liveGuild = liveClient?.guilds?.cache?.get(guild.id);
              return {
              ...guild,
              memberCount: Number(liveGuild?.memberCount ?? 0),

              inviteUrl:
                getBotInviteUrl(
                  guild.id,
                ),

              botInvite:
                getBotInviteUrl(
                  guild.id,
                ),

              botPresent:
                Boolean(liveGuild),
              };
            },
          ),
        );

      return res.json({
        success:
          true,

        guilds:
          result,

        count:
          result.length,

        total:
          result.length,
      });
    } catch (error) {
      console.error(
        '[Guilds] ❌ Erreur /api/guilds :',
        error,
      );

      return res.status(500).json({
        success:
          false,

        error:
          'Impossible de récupérer vos serveurs Discord.',

        code:
          'GUILDS_FETCH_ERROR',

        guilds:
          [],
      });
    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId
========================================================= */

router.get(
  '/:guildId',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          '',
        ).trim();

      if (
        !/^\d{17,20}$/.test(
          guildId,
        )
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            'Identifiant de serveur Discord invalide.',

          code:
            'INVALID_GUILD_ID',
        });
      }

      const user =
        await getAuthenticatedUser(
          req,
        );

      if (!user) {
        return res.status(401).json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',
        });
      }

      const userGuild =
        findUserGuild(
          user,
          guildId,
        );

      if (!userGuild) {
        return res.status(403).json({
          success:
            false,

          error:
            'Vous ne pouvez pas gérer ce serveur.',

          code:
            'GUILD_ACCESS_DENIED',
        });
      }

      const manageable =
        userCanManageGuild(
          user,
          guildId,
        );

      if (!manageable) {
        return res.status(403).json({
          success:
            false,

          error:
            'Vous devez être propriétaire ou administrateur du serveur.',

          code:
            'GUILD_PERMISSION_DENIED',
        });
      }

      /*
       * Configuration OMNIX.
       */

      let config: any = null;

      try {
        config =
          await GuildConfig.findOne({
            guildId,
          }).lean();
      } catch (error) {
        console.warn(
          `[Guilds] Configuration MongoDB indisponible pour ${guildId}:`,
          error,
        );
      }

      /*
       * Vérification de présence du bot.
       */

      const botPresent =
        await isBotInGuild(
          guildId,
        );

      const guild =
        normalizeGuild(
          userGuild,
        );

      return res.json({
        success:
          true,

        guild: {
          ...guild,

          botPresent,

          botInstalled:
            botPresent,

          inviteUrl:
            botPresent
              ? null
              : getBotInviteUrl(
                  guildId,
                ),

          botInvite:
            botPresent
              ? null
              : getBotInviteUrl(
                  guildId,
                ),
        },

        config:
          config || {
            guildId,

            exists:
              false,
          },
      });
    } catch (error) {
      console.error(
        '[Guilds] ❌ Erreur /:guildId :',
        error,
      );

      return res.status(500).json({
        success:
          false,

        error:
          'Impossible de récupérer la configuration du serveur.',

        code:
          'GUILD_FETCH_ERROR',
      });
    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId/channels
========================================================= */

router.get(
  '/:guildId/channels',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          '',
        ).trim();

      if (
        !/^\d{17,20}$/.test(
          guildId,
        )
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            'Identifiant de serveur invalide.',

          channels:
            [],
        });
      }

      const user =
        await getAuthenticatedUser(
          req,
        );

      if (!user) {
        return res.status(401).json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',

          channels:
            [],
        });
      }

      if (
        !userCanManageGuild(
          user,
          guildId,
        )
      ) {
        return res.status(403).json({
          success:
            false,

          error:
            'Accès refusé à ce serveur.',

          code:
            'GUILD_ACCESS_DENIED',

          channels:
            [],
        });
      }

      if (
        !DISCORD_BOT_TOKEN
      ) {
        return res.status(503).json({
          success:
            false,

          error:
            'Token du bot Discord non configuré.',

          code:
            'BOT_TOKEN_MISSING',

          channels:
            [],
        });
      }

      const response =
        await axios.get<
          DiscordChannel[]
        >(
          `${DISCORD_API}/guilds/${guildId}/channels`,
          {
            headers: {
              Authorization:
                `Bot ${DISCORD_BOT_TOKEN}`,
            },

            timeout:
              10000,
          },
        );

      const channels =
        Array.isArray(
          response.data,
        )
          ? response.data
          : [];

      return res.json({
        success:
          true,

        guildId,

        channels:
          channels
            .map(
              (channel) => ({
                id:
                  channel.id,

                name:
                  channel.name,

                type:
                  channel.type,

                parentId:
                  channel.parent_id ||
                  null,

                position:
                  Number(
                    channel.position ??
                    0,
                  ),
              }),
            )
            .sort(
              (a, b) =>
                a.position -
                b.position,
            ),
      });
    } catch (error: any) {
      console.error(
        '[Guilds] ❌ Channels :',
        error?.response?.data ||
          error?.message ||
          error,
      );

      return res.status(
        error?.response?.status ===
          404
          ? 404
          : 500,
      ).json({
        success:
          false,

        error:
          'Impossible de récupérer les salons Discord.',

        code:
          'CHANNELS_FETCH_ERROR',

        channels:
          [],
      });
    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId/roles
========================================================= */

router.get(
  '/:guildId/roles',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          '',
        ).trim();

      if (
        !/^\d{17,20}$/.test(
          guildId,
        )
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            'Identifiant de serveur invalide.',

          roles:
            [],
        });
      }

      const user =
        await getAuthenticatedUser(
          req,
        );

      if (!user) {
        return res.status(401).json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',

          roles:
            [],
        });
      }

      if (
        !userCanManageGuild(
          user,
          guildId,
        )
      ) {
        return res.status(403).json({
          success:
            false,

          error:
            'Accès refusé à ce serveur.',

          code:
            'GUILD_ACCESS_DENIED',

          roles:
            [],
        });
      }

      if (
        !DISCORD_BOT_TOKEN
      ) {
        return res.status(503).json({
          success:
            false,

          error:
            'Token du bot Discord non configuré.',

          code:
            'BOT_TOKEN_MISSING',

          roles:
            [],
        });
      }

      const response =
        await axios.get<
          DiscordRole[]
        >(
          `${DISCORD_API}/guilds/${guildId}/roles`,
          {
            headers: {
              Authorization:
                `Bot ${DISCORD_BOT_TOKEN}`,
            },

            timeout:
              10000,
          },
        );

      const roles =
        Array.isArray(
          response.data,
        )
          ? response.data
          : [];

      return res.json({
        success:
          true,

        guildId,

        roles:
          roles
            .map(
              (role) => ({
                id:
                  role.id,

                name:
                  role.name,

                color:
                  Number(
                    role.color ??
                    0,
                  ),

                position:
                  Number(
                    role.position ??
                    0,
                  ),

                permissions:
                  String(
                    role.permissions ||
                    '0',
                  ),

                managed:
                  Boolean(
                    role.managed,
                  ),
              }),
            )
            .sort(
              (a, b) =>
                b.position -
                a.position,
            ),
      });
    } catch (error: any) {
      console.error(
        '[Guilds] ❌ Roles :',
        error?.response?.data ||
          error?.message ||
          error,
      );

      return res.status(
        error?.response?.status ===
          404
          ? 404
          : 500,
      ).json({
        success:
          false,

        error:
          'Impossible de récupérer les rôles Discord.',

        code:
          'ROLES_FETCH_ERROR',

        roles:
          [],
      });
    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId/invite
========================================================= */

router.get(
  '/:guildId/invite',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          '',
        ).trim();

      if (
        !/^\d{17,20}$/.test(
          guildId,
        )
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            'Identifiant de serveur invalide.',

          code:
            'INVALID_GUILD_ID',
        });
      }

      const user =
        await getAuthenticatedUser(
          req,
        );

      if (!user) {
        return res.status(401).json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',
        });
      }

      if (
        !userCanManageGuild(
          user,
          guildId,
        )
      ) {
        return res.status(403).json({
          success:
            false,

          error:
            'Vous ne pouvez pas inviter OMNIX sur ce serveur.',

          code:
            'GUILD_ACCESS_DENIED',
        });
      }

      const inviteUrl =
        getBotInviteUrl(
          guildId,
        );

      if (!inviteUrl) {
        return res.status(500).json({
          success:
            false,

          error:
            'DISCORD_CLIENT_ID est manquant.',

          code:
            'DISCORD_CLIENT_ID_MISSING',
        });
      }

      return res.json({
        success:
          true,

        guildId,

        inviteUrl,

        url:
          inviteUrl,
      });
    } catch (error) {
      console.error(
        '[Guilds] ❌ Invite :',
        error,
      );

      return res.status(500).json({
        success:
          false,

        error:
          'Impossible de générer le lien d’invitation OMNIX.',

        code:
          'INVITE_ERROR',
      });
    }
  },
);


/* =========================================================
   EXPORT
========================================================= */

export default router;