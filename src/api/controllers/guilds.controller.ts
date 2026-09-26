import type { Response } from 'express';
import axios from 'axios';
import {
  ChannelType,
} from 'discord.js';

import type {
  AuthenticatedRequest,
} from '../middlewares/auth';

import {
  client as botClient,
} from '../../bot/client';

import {
  User,
} from '../../models/User';


/* =========================================================
   TYPES
========================================================= */

interface StoredGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}

interface GuildResponse extends StoredGuild {
  botPresent: boolean;
  manageable: boolean;
  inviteUrl: string;
}


/* =========================================================
   CACHE
========================================================= */

const userGuildsCache =
  new Map<
    string,
    {
      guilds: GuildResponse[];
      expiresAt: number;
    }
  >();


const CACHE_DURATION =
  60 * 1000;


/* =========================================================
   HELPERS
========================================================= */

function isAdministrator(
  permissions: unknown,
): boolean {

  if (
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
      (value & ADMINISTRATOR) ===
      ADMINISTRATOR
    );

  } catch {

    return false;

  }
}


/* =========================================================
   INVITE URL
========================================================= */

function createBotInviteUrl(
  guildId: string,
): string {

  const clientId =
    process.env.DISCORD_CLIENT_ID ||
    process.env.DISCORD_APPLICATION_ID;

  if (!clientId) {
    return '#';
  }

  const params =
    new URLSearchParams({
      client_id:
        clientId,

      scope:
        'bot applications.commands',

      permissions:
        '8',

      guild_id:
        guildId,
    });

  return (
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
}


/* =========================================================
   CONTROLLER
========================================================= */

export class GuildsController {


  /* =======================================================
     GET USER GUILDS
     
     GET /api/guilds
  ======================================================= */

  static async getUserGuilds(
    req: AuthenticatedRequest,
    res: Response,
  ) {

    const userId =
      req.user?.discordId;

    const username =
      req.user?.username ||
      'unknown';

    console.log(
      `[Guilds] 📥 Récupération des serveurs Discord pour : ${username}`,
    );


    if (!userId) {

      return res
        .status(401)
        .json({
          success: false,
          error:
            'Authentification requise.',
          code:
            'AUTH_REQUIRED',
        });

    }


    /* =====================================================
       CACHE
    ===================================================== */

    const cached =
      userGuildsCache.get(
        userId,
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {

      return res.json({
        success: true,
        guilds:
          cached.guilds,
      });

    }


    try {

      /* ===================================================
         GET USER FROM MONGODB
      =================================================== */

      const user =
        await User.findOne({
          discordId:
            userId,
        }).lean();


      if (!user) {

        return res
          .status(404)
          .json({
            success: false,
            error:
              'Utilisateur OMNIX introuvable.',
            code:
              'USER_NOT_FOUND',
          });

      }


      const storedGuilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds
          : [];


      /* ===================================================
         ONLY ADMINISTRABLE SERVERS
      =================================================== */

      const adminGuilds =
        storedGuilds.filter(
          (guild: StoredGuild) => {

            if (
              guild.owner === true
            ) {
              return true;
            }

            return isAdministrator(
              guild.permissions,
            );

          },
        );


      /* ===================================================
         BUILD DASHBOARD DATA
      =================================================== */

      const result: GuildResponse[] =
        adminGuilds.map(
          (
            guild: StoredGuild,
          ) => {

            const botGuild =
              botClient.guilds.cache.get(
                guild.id,
              );

            const botPresent =
              Boolean(
                botGuild,
              );

            return {
              id:
                guild.id,

              name:
                guild.name,

              icon:
                guild.icon ||
                null,

              owner:
                Boolean(
                  guild.owner,
                ),

              permissions:
                guild.permissions ||
                '0',

              manageable:
                true,

              botPresent,

              inviteUrl:
                createBotInviteUrl(
                  guild.id,
                ),
            };

          },
        );


      /* ===================================================
         ACCESS CACHE
      =================================================== */




      /* ===================================================
         RESULT CACHE
      =================================================== */

      userGuildsCache.set(
        userId,
        {
          guilds:
            result,

          expiresAt:
            Date.now() +
            CACHE_DURATION,
        },
      );


      console.log(
        `[Guilds] ✓ ${result.length} serveur(s) administrable(s) trouvé(s) pour ${username}`,
      );


      return res.json({
        success: true,

        guilds:
          result,

        total:
          result.length,
      });


    } catch (error) {

      console.error(
        '[Guilds] ❌ Erreur récupération serveurs :',
        error,
      );


      if (cached) {

        return res.json({
          success: true,
          guilds:
            cached.guilds,
          cached: true,
        });

      }


      return res
        .status(500)
        .json({
          success: false,

          error:
            'Impossible de récupérer vos serveurs Discord.',

          code:
            'GUILDS_FETCH_FAILED',
        });

    }

  }


  /* =======================================================
     GET CHANNELS
     
     GET /api/guilds/:guildId/channels
  ======================================================= */

  static async getGuildChannels(
    req: AuthenticatedRequest,
    res: Response,
  ) {

    const {
      guildId,
    } = req.params;


    try {

      const guild =
        await botClient.guilds.fetch(
          guildId,
        ).catch(
          () => null,
        );


      if (!guild) {

        return res
          .status(404)
          .json({
            success: false,

            error:
              'OMNIX n’est pas présent sur ce serveur.',

            code:
              'BOT_NOT_IN_GUILD',
          });

      }


      const channels =
        await guild.channels.fetch();


      const formatted =
        channels
          .filter(
            (channel) =>
              channel !== null &&
              (
                channel.type ===
                  ChannelType.GuildText ||

                channel.type ===
                  ChannelType.GuildCategory ||

                channel.type ===
                  ChannelType.GuildAnnouncement
              ),
          )
          .map(
            (channel) => ({
              id:
                channel!.id,

              name:
                channel!.name,

              type:
                channel!.type,

              parentId:
                channel!.parentId ||
                null,
            }),
          );


      return res.json({
        success: true,

        guildId,

        channels:
          formatted,
      });


    } catch (error) {

      console.error(
        `[Guilds] ❌ Channels ${guildId}:`,
        error,
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            'Impossible de récupérer les salons.',
        });

    }

  }


  /* =======================================================
     GET ROLES
     
     GET /api/guilds/:guildId/roles
  ======================================================= */

  static async getGuildRoles(
    req: AuthenticatedRequest,
    res: Response,
  ) {

    const {
      guildId,
    } = req.params;


    try {

      const guild =
        await botClient.guilds.fetch(
          guildId,
        ).catch(
          () => null,
        );


      if (!guild) {

        return res
          .status(404)
          .json({
            success: false,

            error:
              'OMNIX n’est pas présent sur ce serveur.',
          });

      }


      const roles =
        await guild.roles.fetch();


      const formatted =
        roles
          .filter(
            (role) =>
              role !== null &&
              role.id !==
                guild.id,
          )
          .sort(
            (a, b) =>
              b!.position -
              a!.position,
          )
          .map(
            (role) => ({
              id:
                role!.id,

              name:
                role!.name,

              color:
                role!.hexColor,

              position:
                role!.position,

              managed:
                role!.managed,
            }),
          );


      return res.json({
        success: true,

        guildId,

        roles:
          formatted,
      });


    } catch (error) {

      console.error(
        `[Guilds] ❌ Roles ${guildId}:`,
        error,
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            'Impossible de récupérer les rôles.',
        });

    }

  }

}