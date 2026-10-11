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
import { License } from '../../models/License';
import { GuildConfig } from '../../models/GuildConfig';
import { refreshDiscordAccessToken } from '../routes/auth.routes';


/* =========================================================
   TYPES
========================================================= */


interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
}

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
  premium: boolean;
  premiumTier?: string | null;
  premiumExpiresAt?: Date | null;
}


/* =========================================================
   CACHE
========================================================= */

export function invalidateUserGuildsCache(userId: string): void {
  userGuildsCache.delete(String(userId));
}

export function invalidateAllUserGuildsCache(): void {
  userGuildsCache.clear();
}

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

    const forceRefresh = String((req as any).query?.refresh || '') === '1';

    if (!forceRefresh &&
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


      let storedGuilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds
          : [];

      // Synchronisation légère avec Discord : elle permet au Dashboard de
      // retrouver un nouveau serveur sans attendre une nouvelle connexion.
      // Le refresh token reste strictement côté serveur.
      let needsReauth = false;
      try {
        const accessToken = await refreshDiscordAccessToken(String(userId));
        if (accessToken) {
          const live = await axios.get<DiscordGuild[]>('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
          });
          if (Array.isArray(live.data)) {
            storedGuilds = live.data.map((guild: any) => ({
              id: String(guild.id),
              name: String(guild.name),
              icon: guild.icon || null,
              owner: Boolean(guild.owner),
              permissions: String(guild.permissions || '0'),
              features: Array.isArray(guild.features) ? guild.features : [],
            }));
            await User.updateOne({ discordId: String(userId) }, { $set: { guilds: storedGuilds } }).catch(() => null);
          }
        } else if ((user as any).refreshToken) {
          needsReauth = true;
        }
      } catch (syncError: any) {
        console.warn('[Guilds] Synchronisation Discord différée :', syncError?.response?.status || syncError?.message || syncError);
      }


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

      const activeLicenses = await License.find({
        buyerId: userId,
        status: { $in: ['active', 'used'] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }).sort({ createdAt: -1 }).lean().catch(() => []);
      const activatedGuildIds = new Set<string>();
      for (const license of activeLicenses as any[]) {
        if (license.activatedGuildId) activatedGuildIds.add(String(license.activatedGuildId));
        for (const id of Array.isArray(license.activatedGuildIds) ? license.activatedGuildIds : []) {
          activatedGuildIds.add(String(id));
        }
      }
      const guildIds = adminGuilds.map((guild: StoredGuild) => String(guild.id));
      const guildConfigs = await GuildConfig.find({ guildId: { $in: guildIds } })
        .select('guildId plan premium premiumExpiresAt')
        .lean()
        .catch(() => []);
      const configByGuild = new Map<string, any>((guildConfigs as any[]).map(config => [String(config.guildId), config]));

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

            const stored = configByGuild.get(String(guild.id));
            const expiresAt = stored?.premium?.expiresAt || stored?.premiumExpiresAt || null;
            const configPremium = Boolean(
              (stored?.premium?.isPremium || (stored?.plan && stored.plan !== 'free')) &&
              (!expiresAt || new Date(expiresAt).getTime() > Date.now())
            );
            const licensePremium = activatedGuildIds.has(String(guild.id));
            const premium = configPremium || licensePremium;
            const licenseForGuild = (activeLicenses as any[]).find(license =>
              String(license.activatedGuildId || '') === String(guild.id) ||
              (Array.isArray(license.activatedGuildIds) && license.activatedGuildIds.map(String).includes(String(guild.id)))
            );

            return {
              id: guild.id,
              name: guild.name,
              icon: guild.icon || null,
              owner: Boolean(guild.owner),
              permissions: guild.permissions || '0',
              manageable: true,
              botPresent,
              inviteUrl: createBotInviteUrl(guild.id),
              premium,
              // Expose the resolved plan explicitly so the dashboard can
              // render a deterministic PREMIUM/FREE badge after reconnect.
              plan: premium ? (stored?.premium?.tier || stored?.plan || licenseForGuild?.tier || 'premium') : 'free',
              premiumTier: premium ? (stored?.premium?.tier || licenseForGuild?.tier || 'premium') : null,
              premiumExpiresAt: premium ? (expiresAt || licenseForGuild?.expiresAt || null) : null,
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