import express, {
  type Request,
  type Response,
} from 'express';

import type { Client } from 'discord.js';

import {
  getRequestToken,
  verifyJwt,
} from './auth.routes.ts';

import { User } from '../../models/User.ts';

const router = express.Router();

/* =========================================================
   OMNIX — GUILD ROUTES
========================================================= */

let discordClient: Client | null = null;

/**
 * Enregistre le client Discord principal.
 *
 * À appeler depuis index.ts une fois le client Discord créé.
 */
export function registerDiscordClient(
  client: Client
): void {
  discordClient = client;

  console.log(
    '[Guilds] ✓ Client Discord enregistré.'
  );
}

/* =========================================================
   TYPES
========================================================= */

interface StoredGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
}

interface AuthenticatedRequest
  extends Request {
  omnixUser?: {
    discordId: string;
    username?: string;
    isOwner?: boolean;
    isAdmin?: boolean;
    isPremium?: boolean;
  };
}

/* =========================================================
   AUTHENTICATION
========================================================= */

/**
 * Authentifie une requête avec :
 *
 * 1. Authorization: Bearer ...
 * 2. jwt_token cookie
 */
async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
): Promise<void> {
  try {
    const token =
      getRequestToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentification requise.',
        code: 'AUTH_REQUIRED',
      });

      return;
    }

    const payload =
      verifyJwt(token);

    if (
      !payload ||
      !payload.discordId
    ) {
      res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée.',
        code: 'AUTH_INVALID',
      });

      return;
    }

    req.omnixUser = {
      discordId:
        String(payload.discordId),

      username:
        payload.username,

      isOwner:
        Boolean(payload.isOwner),

      isAdmin:
        Boolean(payload.isAdmin),

      isPremium:
        Boolean(payload.isPremium),
    };

    next();
  } catch (error) {
    console.error(
      '[Guilds] Erreur authentification:',
      error
    );

    res.status(401).json({
      success: false,
      error: 'Session invalide.',
      code: 'AUTH_INVALID',
    });
  }
}

/* =========================================================
   DISCORD PERMISSIONS
========================================================= */

function hasAdministratorPermission(
  permissions?: string
): boolean {
  if (
    !permissions ||
    typeof permissions !== 'string'
  ) {
    return false;
  }

  try {
    const value =
      BigInt(permissions);

    const ADMINISTRATOR =
      0x8n;

    return (
      (value &
        ADMINISTRATOR) ===
      ADMINISTRATOR
    );
  } catch {
    return false;
  }
}

/* =========================================================
   USER
========================================================= */

async function getAuthenticatedUser(
  req: AuthenticatedRequest
) {
  if (!req.omnixUser?.discordId) {
    return null;
  }

  return User.findOne({
    discordId:
      req.omnixUser.discordId,
  }).lean();
}

/* =========================================================
   STORED GUILDS
========================================================= */

function normalizeGuild(
  guild: any
): StoredGuild {
  return {
    id:
      String(
        guild?.id ?? ''
      ),

    name:
      String(
        guild?.name ??
        'Serveur Discord'
      ),

    icon:
      guild?.icon ??
      null,

    owner:
      Boolean(
        guild?.owner
      ),

    permissions:
      String(
        guild?.permissions ??
        '0'
      ),
  };
}

/* =========================================================
   GET USER GUILDS
========================================================= */

/**
 * GET /api/guilds
 *
 * Retourne les serveurs Discord accessibles
 * par l'utilisateur connecté.
 */
router.get(
  '/',
  authenticate,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const discordId =
        req.omnixUser?.discordId;

      if (!discordId) {
        return res.status(401).json({
          success: false,
          error: 'Authentification requise.',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(
        `[Guilds] 📥 Récupération des serveurs Discord pour : ${req.omnixUser?.username || discordId}`
      );

      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            'Utilisateur OMNIX introuvable.',
          code: 'USER_NOT_FOUND',
        });
      }

      const storedGuilds =
        Array.isArray(
          (user as any).guilds
        )
          ? (user as any).guilds
          : [];

      const normalized =
        storedGuilds
          .map(normalizeGuild)
          .filter(
            (guild) =>
              Boolean(guild.id)
          );

      /*
       * -----------------------------------------------------
       * SI LE BOT EST DISPONIBLE
       * -----------------------------------------------------
       *
       * On enrichit les guilds avec l'état réel
       * du bot.
       */

      const guilds =
        normalized.map(
          (guild) => {
            let botPresent = false;
            let memberCount = 0;

            if (
              discordClient
            ) {
              const discordGuild =
                discordClient.guilds.cache.get(
                  guild.id
                );

              if (
                discordGuild
              ) {
                botPresent = true;

                memberCount =
                  Number(
                    discordGuild.memberCount ??
                    0
                  );
              }
            }

            return {
              ...guild,

              botPresent,

              memberCount,

              manageable:
                Boolean(
                  guild.owner
                ) ||
                hasAdministratorPermission(
                  guild.permissions
                ),
            };
          }
        );

      /*
       * -----------------------------------------------------
       * TRI
       * -----------------------------------------------------
       *
       * Les serveurs où OMNIX est installé passent
       * en premier.
       */

      guilds.sort(
        (
          a,
          b
        ) => {
          if (
            a.botPresent &&
            !b.botPresent
          ) {
            return -1;
          }

          if (
            !a.botPresent &&
            b.botPresent
          ) {
            return 1;
          }

          return a.name.localeCompare(
            b.name,
            'fr'
          );
        }
      );

      console.log(
        `[Guilds] ✓ ${guilds.length} serveur(s) retourné(s) pour ${discordId}`
      );

      return res.json({
        success: true,

        guilds,

        count:
          guilds.length,

        total:
          guilds.length,

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Guilds] Erreur GET /api/guilds:',
        error
      );

      return res.status(500).json({
        success: false,

        error:
          'Impossible de récupérer vos serveurs Discord.',

        code:
          'GUILDS_FETCH_ERROR',

        guilds: [],
      });
    }
  }
);

/* =========================================================
   GET SINGLE GUILD
========================================================= */

/**
 * GET /api/guilds/:guildId
 *
 * Retourne les informations d'un serveur.
 */
router.get(
  '/:guildId',
  authenticate,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          ''
        ).trim();

      if (!guildId) {
        return res.status(400).json({
          success: false,
          error: 'Guild ID manquant.',
          code: 'GUILD_ID_REQUIRED',
        });
      }

      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            'Utilisateur OMNIX introuvable.',
          code: 'USER_NOT_FOUND',
        });
      }

      const storedGuilds =
        Array.isArray(
          (user as any).guilds
        )
          ? (user as any).guilds
          : [];

      const storedGuild =
        storedGuilds.find(
          (guild: any) =>
            String(
              guild?.id
            ) === guildId
        );

      if (!storedGuild) {
        return res.status(403).json({
          success: false,
          error:
            'Vous ne pouvez pas gérer ce serveur.',
          code:
            'GUILD_ACCESS_DENIED',
        });
      }

      const guild =
        normalizeGuild(
          storedGuild
        );

      let botPresent = false;
      let memberCount = 0;

      if (
        discordClient
      ) {
        const discordGuild =
          discordClient.guilds.cache.get(
            guildId
          );

        if (
          discordGuild
        ) {
          botPresent = true;

          memberCount =
            Number(
              discordGuild.memberCount ??
              0
            );
        }
      }

      return res.json({
        success: true,

        guild: {
          ...guild,

          botPresent,

          memberCount,

          manageable:
            Boolean(
              guild.owner
            ) ||
            hasAdministratorPermission(
              guild.permissions
            ),
        },

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Guilds] Erreur GET /api/guilds/:guildId:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de récupérer le serveur.',
        code:
          'GUILD_FETCH_ERROR',
      });
    }
  }
);

/* =========================================================
   CHANNELS
========================================================= */

/**
 * GET /api/guilds/:guildId/channels
 */
router.get(
  '/:guildId/channels',
  authenticate,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          ''
        ).trim();

      if (!guildId) {
        return res.status(400).json({
          success: false,
          error: 'Guild ID manquant.',
          code:
            'GUILD_ID_REQUIRED',
        });
      }

      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            'Utilisateur OMNIX introuvable.',
          code:
            'USER_NOT_FOUND',
        });
      }

      const storedGuilds =
        Array.isArray(
          (user as any).guilds
        )
          ? (user as any).guilds
          : [];

      const hasAccess =
        storedGuilds.some(
          (guild: any) =>
            String(
              guild?.id
            ) === guildId
        );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error:
            'Accès refusé à ce serveur.',
          code:
            'GUILD_ACCESS_DENIED',
        });
      }

      if (!discordClient) {
        return res.status(503).json({
          success: false,
          error:
            'Le client Discord est temporairement indisponible.',
          code:
            'DISCORD_UNAVAILABLE',
          channels: [],
        });
      }

      const guild =
        discordClient.guilds.cache.get(
          guildId
        );

      if (!guild) {
        return res.status(404).json({
          success: false,
          error:
            'OMNIX n’est pas présent sur ce serveur.',
          code:
            'BOT_NOT_IN_GUILD',
          channels: [],
        });
      }

      const channels =
        guild.channels.cache
          .map(
            (channel: any) => ({
              id:
                String(
                  channel.id
                ),

              name:
                String(
                  channel.name ??
                  ''
                ),

              type:
                Number(
                  channel.type
                ),

              parentId:
                channel.parentId ??
                null,

              position:
                Number(
                  channel.position ??
                  0
                ),

              permissionOverwrites:
                channel
                  .permissionOverwrites
                  ?.cache
                  ? Array.from(
                      channel
                        .permissionOverwrites
                        .cache
                        .values()
                    ).map(
                      (
                        overwrite: any
                      ) => ({
                        id:
                          String(
                            overwrite.id
                          ),

                        type:
                          Number(
                            overwrite.type
                          ),

                        allow:
                          String(
                            overwrite.allow
                          ),

                        deny:
                          String(
                            overwrite.deny
                          ),
                      })
                    )
                  : [],
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              a.position -
              b.position
          );

      return res.json({
        success: true,

        guild: {
          id:
            guild.id,

          name:
            guild.name,
        },

        channels,

        count:
          channels.length,

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Guilds] Erreur channels:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de récupérer les salons.',
        code:
          'CHANNELS_FETCH_ERROR',
        channels: [],
      });
    }
  }
);

/* =========================================================
   ROLES
========================================================= */

/**
 * GET /api/guilds/:guildId/roles
 */
router.get(
  '/:guildId/roles',
  authenticate,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          ''
        ).trim();

      if (!guildId) {
        return res.status(400).json({
          success: false,
          error: 'Guild ID manquant.',
          code:
            'GUILD_ID_REQUIRED',
        });
      }

      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            'Utilisateur OMNIX introuvable.',
          code:
            'USER_NOT_FOUND',
        });
      }

      const storedGuilds =
        Array.isArray(
          (user as any).guilds
        )
          ? (user as any).guilds
          : [];

      const hasAccess =
        storedGuilds.some(
          (guild: any) =>
            String(
              guild?.id
            ) === guildId
        );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error:
            'Accès refusé à ce serveur.',
          code:
            'GUILD_ACCESS_DENIED',
        });
      }

      if (!discordClient) {
        return res.status(503).json({
          success: false,
          error:
            'Le client Discord est temporairement indisponible.',
          code:
            'DISCORD_UNAVAILABLE',
          roles: [],
        });
      }

      const guild =
        discordClient.guilds.cache.get(
          guildId
        );

      if (!guild) {
        return res.status(404).json({
          success: false,
          error:
            'OMNIX n’est pas présent sur ce serveur.',
          code:
            'BOT_NOT_IN_GUILD',
          roles: [],
        });
      }

      const roles =
        guild.roles.cache
          .map(
            (role) => ({
              id:
                role.id,

              name:
                role.name,

              color:
                role.hexColor,

              position:
                role.position,

              hoist:
                role.hoist,

              mentionable:
                role.mentionable,

              managed:
                role.managed,

              permissions:
                role.permissions.bitfield.toString(),
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              b.position -
              a.position
          );

      return res.json({
        success: true,

        guild: {
          id:
            guild.id,

          name:
            guild.name,
        },

        roles,

        count:
          roles.length,

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Guilds] Erreur roles:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de récupérer les rôles.',
        code:
          'ROLES_FETCH_ERROR',
        roles: [],
      });
    }
  }
);

/* =========================================================
   BOT STATUS
========================================================= */

/**
 * GET /api/guilds/:guildId/status
 */
router.get(
  '/:guildId/status',
  authenticate,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId ||
          ''
        ).trim();

      if (!guildId) {
        return res.status(400).json({
          success: false,
          error: 'Guild ID manquant.',
          code:
            'GUILD_ID_REQUIRED',
        });
      }

      if (!discordClient) {
        return res.json({
          success: true,

          connected: false,

          botPresent: false,

          guildId,

          timestamp:
            new Date().toISOString(),
        });
      }

      const guild =
        discordClient.guilds.cache.get(
          guildId
        );

      return res.json({
        success: true,

        connected:
          discordClient.isReady(),

        botPresent:
          Boolean(guild),

        guildId,

        guild: guild
          ? {
              id:
                guild.id,

              name:
                guild.name,

              memberCount:
                guild.memberCount,
            }
          : null,

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[Guilds] Erreur status:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de récupérer le statut du serveur.',
        code:
          'GUILD_STATUS_ERROR',
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;