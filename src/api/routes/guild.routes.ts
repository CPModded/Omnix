import express, {
  type Request,
  type Response,
} from 'express';

import type { Client } from 'discord.js';

import { User } from '../../models/User.ts';

import {
  getRequestToken,
  verifyJwt,
  isOwner,
} from './auth.routes.ts';


/* =========================================================
   OMNIX — GUILD ROUTES
========================================================= */

const router = express.Router();


/* =========================================================
   DISCORD CLIENT
========================================================= */

let discordClient: Client | null = null;


/**
 * Enregistre le client Discord principal.
 *
 * Cette fonction doit être appelée depuis index.ts
 * une fois que le bot Discord est créé.
 */
export function registerDiscordClient(
  client: Client,
): void {
  discordClient = client;

  console.log(
    '[Guilds] ✓ Client Discord enregistré.',
  );
}


/* =========================================================
   AUTHENTICATION
========================================================= */

/**
 * Récupère l'utilisateur connecté
 * à partir du JWT OMNIX.
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

  if (!payload?.discordId) {
    return null;
  }

  const user =
    await User.findOne({
      discordId:
        payload.discordId,
    });

  return user;
}


/* =========================================================
   DISCORD PERMISSIONS
========================================================= */

const ADMINISTRATOR =
  0x8n;


/**
 * Vérifie si l'utilisateur possède
 * les permissions nécessaires sur un serveur.
 */
function canManageGuild(
  guild: any,
): boolean {

  /*
   * Propriétaire du serveur.
   */
  if (
    guild.owner === true
  ) {
    return true;
  }

  /*
   * Permissions Discord.
   */
  if (
    typeof guild.permissions !==
    'string'
  ) {
    return false;
  }

  try {

    const permissions =
      BigInt(
        guild.permissions,
      );

    return (
      (
        permissions &
        ADMINISTRATOR
      ) ===
      ADMINISTRATOR
    );

  } catch {

    return false;

  }
}


/* =========================================================
   BOT PERMISSION CHECK
========================================================= */

/**
 * Vérifie si OMNIX est présent sur le serveur.
 */
function isBotInGuild(
  guildId: string,
): boolean {

  if (!discordClient) {
    return false;
  }

  return discordClient.guilds.cache.has(
    guildId,
  );
}


/* =========================================================
   BOT INVITE URL
========================================================= */

function getBotInviteUrl(
  guildId?: string,
): string | null {

  const clientId =
    process.env.DISCORD_CLIENT_ID ||
    process.env.DISCORD_BOT_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  const params =
    new URLSearchParams({
      client_id:
        clientId,

      scope:
        'bot applications.commands',

      permissions:
        '8',
    });

  if (guildId) {
    params.set(
      'guild_id',
      guildId,
    );

    /*
     * Empêche Discord de demander
     * à l'utilisateur de choisir un serveur.
     */
    params.set(
      'disable_guild_select',
      'true',
    );
  }

  return (
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
}


/* =========================================================
   GET /api/guilds
========================================================= */

/**
 * Retourne les serveurs Discord accessibles
 * par l'utilisateur connecté.
 *
 * GET /api/guilds
 */
router.get(
  '/',
  async (
    req: Request,
    res: Response,
  ) => {

    try {

      const user =
        await getAuthenticatedUser(
          req,
        );

      if (!user) {

        return res
          .status(401)
          .json({
            success:
              false,

            error:
              'Authentification requise.',

            code:
              'AUTH_REQUIRED',
          });

      }


      console.log(
        `[Guilds] 📥 Récupération des serveurs Discord pour : ${user.username}`,
      );


      const storedGuilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds
          : [];


      /*
       * Owner OMNIX :
       *
       * L'owner peut voir tous les serveurs
       * présents dans son compte.
       */
      const owner =
        isOwner(
          String(
            (user as any).discordId,
          ),
        );


      const guilds =
        storedGuilds
          .filter(
            (guild: any) =>
              owner ||
              canManageGuild(guild),
          )
          .map(
            (guild: any) => {

              const id =
                String(
                  guild.id,
                );

              const installed =
                isBotInGuild(
                  id,
                );

              return {

                id,

                name:
                  String(
                    guild.name ||
                    'Serveur sans nom',
                  ),

                icon:
                  guild.icon ||
                  null,

                owner:
                  Boolean(
                    guild.owner,
                  ),

                permissions:
                  String(
                    guild.permissions ||
                    '0',
                  ),

                manageable:
                  true,

                botInstalled:
                  installed,

                configured:
                  installed,

                dashboardUrl:
                  `/dashboard/${encodeURIComponent(id)}`,

                inviteUrl:
                  installed
                    ? null
                    : getBotInviteUrl(id),
              };
            },
          );


      /*
       * Tri :
       *
       * 1. Serveurs avec OMNIX
       * 2. Serveurs sans OMNIX
       * 3. Nom alphabétique
       */
      guilds.sort(
        (
          a: any,
          b: any,
        ) => {

          if (
            a.botInstalled !==
            b.botInstalled
          ) {
            return a.botInstalled
              ? -1
              : 1;
          }

          return a.name.localeCompare(
            b.name,
            'fr',
            {
              sensitivity:
                'base',
            },
          );
        },
      );


      return res.json({

        success:
          true,

        guilds,

        total:
          guilds.length,

        installed:
          guilds.filter(
            (guild: any) =>
              guild.botInstalled,
          ).length,

        notInstalled:
          guilds.filter(
            (guild: any) =>
              !guild.botInstalled,
          ).length,

        timestamp:
          new Date().toISOString(),

      });

    } catch (error) {

      console.error(
        '[Guilds] ❌ Erreur /api/guilds :',
        error,
      );

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            'Impossible de récupérer vos serveurs Discord.',

          code:
            'GUILDS_FETCH_ERROR',

        });

    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId
========================================================= */

/**
 * Retourne les informations détaillées
 * d'un serveur.
 */
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


      if (!guildId) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              'Identifiant du serveur manquant.',

            code:
              'GUILD_ID_REQUIRED',

          });

      }


      const user =
        await getAuthenticatedUser(
          req,
        );


      if (!user) {

        return res
          .status(401)
          .json({

            success:
              false,

            error:
              'Authentification requise.',

            code:
              'AUTH_REQUIRED',

          });

      }


      const storedGuilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds
          : [];


      const guild =
        storedGuilds.find(
          (item: any) =>
            String(item.id) ===
            guildId,
        );


      if (!guild) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              'Vous ne pouvez pas gérer ce serveur.',

            code:
              'GUILD_ACCESS_DENIED',

          });

      }


      if (
        !canManageGuild(guild) &&
        !isOwner(
          String(
            (user as any).discordId,
          ),
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              'Vous devez être propriétaire ou administrateur de ce serveur.',

            code:
              'GUILD_MANAGE_DENIED',

          });

      }


      const installed =
        isBotInGuild(
          guildId,
        );


      let botGuild: any = null;


      /*
       * Si OMNIX est présent,
       * on récupère les informations
       * directement depuis Discord.
       */
      if (
        installed &&
        discordClient
      ) {

        const discordGuild =
          discordClient.guilds.cache.get(
            guildId,
          );

        if (discordGuild) {

          botGuild = {

            id:
              discordGuild.id,

            name:
              discordGuild.name,

            icon:
              discordGuild.iconURL({
                size: 256,
              }),

            memberCount:
              discordGuild.memberCount,

          };

        }

      }


      return res.json({

        success:
          true,

        guild: {

          id:
            guildId,

          name:
            guild.name,

          icon:
            guild.icon ||
            botGuild?.icon ||
            null,

          owner:
            Boolean(
              guild.owner,
            ),

          permissions:
            String(
              guild.permissions ||
              '0',
            ),

          manageable:
            true,

          botInstalled:
            installed,

          configured:
            installed,

          memberCount:
            botGuild?.memberCount ??
            null,

        },

        inviteUrl:
          installed
            ? null
            : getBotInviteUrl(
                guildId,
              ),

        dashboardUrl:
          `/dashboard/${encodeURIComponent(guildId)}`,

      });

    } catch (error) {

      console.error(
        '[Guilds] ❌ Erreur /:guildId :',
        error,
      );

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            'Impossible de récupérer les informations du serveur.',

          code:
            'GUILD_FETCH_ERROR',

        });

    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId/channels
========================================================= */

/**
 * Retourne les salons du serveur.
 */
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


      const user =
        await getAuthenticatedUser(
          req,
        );


      if (!user) {

        return res
          .status(401)
          .json({

            success:
              false,

            error:
              'Authentification requise.',

            code:
              'AUTH_REQUIRED',

          });

      }


      const storedGuild =
        (
          (user as any).guilds ||
          []
        ).find(
          (guild: any) =>
            String(guild.id) ===
            guildId,
        );


      if (
        !storedGuild ||
        !canManageGuild(storedGuild)
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              'Accès refusé à ce serveur.',

            code:
              'GUILD_ACCESS_DENIED',

          });

      }


      if (!discordClient) {

        return res
          .status(503)
          .json({

            success:
              false,

            error:
              'Le client Discord n’est pas encore disponible.',

            code:
              'DISCORD_NOT_READY',

          });

      }


      const discordGuild =
        discordClient.guilds.cache.get(
          guildId,
        );


      if (!discordGuild) {

        return res
          .status(404)
          .json({

            success:
              false,

            error:
              'OMNIX n’est pas présent sur ce serveur.',

            code:
              'BOT_NOT_IN_GUILD',

            inviteUrl:
              getBotInviteUrl(
                guildId,
              ),

          });

      }


      const channels =
        discordGuild.channels.cache
          .map(
            (channel: any) => ({

              id:
                channel.id,

              name:
                channel.name,

              type:
                channel.type,

              parentId:
                channel.parentId ||
                null,

              position:
                channel.position ??
                0,

            }),
          )
          .sort(
            (
              a: any,
              b: any,
            ) =>
              a.position -
              b.position,
          );


      return res.json({

        success:
          true,

        guildId,

        channels,

      });

    } catch (error) {

      console.error(
        '[Guilds] ❌ Erreur channels :',
        error,
      );

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            'Impossible de récupérer les salons.',

        });

    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId/roles
========================================================= */

/**
 * Retourne les rôles du serveur.
 */
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


      const user =
        await getAuthenticatedUser(
          req,
        );


      if (!user) {

        return res
          .status(401)
          .json({

            success:
              false,

            error:
              'Authentification requise.',

            code:
              'AUTH_REQUIRED',

          });

      }


      const storedGuild =
        (
          (user as any).guilds ||
          []
        ).find(
          (guild: any) =>
            String(guild.id) ===
            guildId,
        );


      if (
        !storedGuild ||
        !canManageGuild(storedGuild)
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              'Accès refusé à ce serveur.',

            code:
              'GUILD_ACCESS_DENIED',

          });

      }


      if (!discordClient) {

        return res
          .status(503)
          .json({

            success:
              false,

            error:
              'Le client Discord n’est pas encore disponible.',

            code:
              'DISCORD_NOT_READY',

          });

      }


      const discordGuild =
        discordClient.guilds.cache.get(
          guildId,
        );


      if (!discordGuild) {

        return res
          .status(404)
          .json({

            success:
              false,

            error:
              'OMNIX n’est pas présent sur ce serveur.',

            code:
              'BOT_NOT_IN_GUILD',

            inviteUrl:
              getBotInviteUrl(
                guildId,
              ),

          });

      }


      const roles =
        discordGuild.roles.cache
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

              managed:
                role.managed,

              mentionable:
                role.mentionable,

            }),
          )
          .sort(
            (
              a,
              b,
            ) =>
              b.position -
              a.position,
          );


      return res.json({

        success:
          true,

        guildId,

        roles,

      });

    } catch (error) {

      console.error(
        '[Guilds] ❌ Erreur roles :',
        error,
      );

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            'Impossible de récupérer les rôles.',

        });

    }
  },
);


/* =========================================================
   GET /api/guilds/:guildId/invite
========================================================= */

/**
 * Génère l'URL d'invitation OMNIX.
 */
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


      if (!guildId) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              'Identifiant du serveur manquant.',

          });

      }


      const user =
        await getAuthenticatedUser(
          req,
        );


      if (!user) {

        return res
          .status(401)
          .json({

            success:
              false,

            error:
              'Authentification requise.',

            code:
              'AUTH_REQUIRED',

          });

      }


      const guild =
        (
          (user as any).guilds ||
          []
        ).find(
          (item: any) =>
            String(item.id) ===
            guildId,
        );


      if (!guild) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              'Vous ne pouvez pas inviter OMNIX sur ce serveur.',

            code:
              'GUILD_ACCESS_DENIED',

          });

      }


      if (
        isBotInGuild(
          guildId,
        )
      ) {

        return res.json({

          success:
            true,

          installed:
            true,

          inviteUrl:
            null,

          message:
            'OMNIX est déjà présent sur ce serveur.',

        });

      }


      const inviteUrl =
        getBotInviteUrl(
          guildId,
        );


      if (!inviteUrl) {

        return res
          .status(500)
          .json({

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

        installed:
          false,

        inviteUrl,

        guildId,

      });

    } catch (error) {

      console.error(
        '[Guilds] ❌ Erreur invite :',
        error,
      );

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            'Impossible de générer le lien d’invitation.',

        });

    }
  },
);


/* =========================================================
   EXPORT
========================================================= */

export default router;