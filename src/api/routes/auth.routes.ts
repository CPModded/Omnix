import express, {
  type Request,
  type Response,
} from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User.ts';
import { CONFIG } from '../../config/index.ts';
/*
 * =========================================================
 * OMNIX — AUTHENTICATION ROUTES
 * =========================================================
 *
 * ONE official session:
 *
 *     jwt_token
 *
 * No:
 *     omnix_token
 *     localStorage JWT
 *     ?token=...
 *
 * Authentication flow:
 *
 * Discord OAuth
 *      ↓
 * /api/auth/callback
 *      ↓
 * Discord user
 *      ↓
 * MongoDB
 *      ↓
 * JWT
 *      ↓
 * httpOnly cookie: jwt_token
 *      ↓
 * /dashboard
 *
 * =========================================================
 */
const router = express.Router();
/*
 * =========================================================
 * DISCORD API
 * =========================================================
 */
const DISCORD_API =
  'https://discord.com/api/v10';
const DISCORD_OAUTH_TOKEN_URL =
  'https://discord.com/api/oauth2/token';
/*
 * =========================================================
 * SESSION
 * =========================================================
 */
export const SESSION_COOKIE =
  'jwt_token';
const SESSION_MAX_AGE =
  7 * 24 * 60 * 60 * 1000;
/*
 * =========================================================
 * DISCORD TYPES
 * =========================================================
 */
interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}
interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
}
interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
}
/*
 * =========================================================
 * DISCORD IMAGE HELPERS
 * =========================================================
 */
function discordAvatarUrl(
  discordId: string,
  avatar: unknown,
): string | null {
  if (!avatar) {
    return null;
  }
  const value = String(avatar);
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://cdn.discordapp.com/avatars/${discordId}/${value}.png?size=128`;
}
function discordGuildIconUrl(
  guildId: string,
  icon: unknown,
): string | null {
  if (!icon) {
    return null;
  }
  const value = String(icon);
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://cdn.discordapp.com/icons/${guildId}/${value}.png?size=128`;
}
/*
 * =========================================================
 * CONFIG HELPERS
 * =========================================================
 */
function getDiscordClientId(): string | null {
  const value =
    process.env.DISCORD_CLIENT_ID ||
    (CONFIG as any).DISCORD?.CLIENT_ID;
  return value
    ? String(value).trim()
    : null;
}
function getDiscordClientSecret(): string | null {
  const value =
    process.env.DISCORD_CLIENT_SECRET ||
    (CONFIG as any).DISCORD?.CLIENT_SECRET;
  return value
    ? String(value).trim()
    : null;
}
function getDiscordRedirectUri(): string | null {
  const value =
    process.env.DISCORD_REDIRECT_URI ||
    (CONFIG as any).DISCORD?.REDIRECT_URI;
  return value
    ? String(value).trim()
    : null;
}
/*
 * =========================================================
 * OWNER IDS
 * =========================================================
 */
export function getOwnerIds(): string[] {
  const configured =
    (CONFIG as any).OWNER_IDS;
  if (Array.isArray(configured)) {
    return configured
      .map((id) => String(id).trim())
      .filter(Boolean);
  }
  return (
    process.env.OWNER_IDS || ''
  )
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
/*
 * =========================================================
 * OWNER CHECK
 * =========================================================
 */
export function isOwner(
  discordId: string,
): boolean {
  return getOwnerIds().includes(
    String(discordId).trim(),
  );
}
/*
 * =========================================================
 * JWT PAYLOAD
 * =========================================================
 */
export interface OmnixJwtPayload {
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  isPremium: boolean;
  iat?: number;
  exp?: number;
}
/*
 * =========================================================
 * CREATE JWT
 * =========================================================
 */
export function createJwt(
  user: DiscordUser,
  premium = false,
): string {
  const owner =
    isOwner(user.id);
  const payload: OmnixJwtPayload = {
    discordId: String(user.id),
    username:
      user.global_name ||
      user.username,
    avatar:
      user.avatar || null,
    isAdmin:
      owner,
    isOwner:
      owner,
    isPremium:
      premium,
  };
  return jwt.sign(
    payload,
    CONFIG.JWT_SECRET,
    {
      expiresIn: '7d',
    },
  );
}
/*
 * =========================================================
 * COOKIE SECURITY
 * =========================================================
 *
 * Render terminates HTTPS before forwarding traffic
 * to the Node application.
 *
 * Express trust proxy is configured in app.ts.
 *
 * We therefore enable Secure in production.
 *
 * SameSite=Lax is intentional:
 *
 * Discord OAuth redirects back to the same OMNIX site,
 * and Lax allows the OAuth top-level navigation.
 *
 * =========================================================
 */
export function getSessionCookieOptions() {
  const isProduction =
    process.env.NODE_ENV ===
      'production' ||
    process.env.RENDER === 'true';
  return {
    httpOnly: true,
    secure:
      isProduction,
    sameSite:
      'lax' as const,
    maxAge:
      SESSION_MAX_AGE,
    path: '/',
  };
}
/*
 * =========================================================
 * EXTRACT BEARER TOKEN
 * =========================================================
 */
export function extractBearerToken(
  req: Request,
): string | null {
  const authorization =
    req.headers.authorization;
  if (!authorization) {
    return null;
  }
  if (
    !authorization
      .toLowerCase()
      .startsWith('bearer ')
  ) {
    return null;
  }
  const token =
    authorization
      .substring(7)
      .trim();
  return token || null;
}
/*
 * =========================================================
 * GET REQUEST TOKEN
 * =========================================================
 *
 * Priority:
 *
 * 1. Authorization Bearer
 * 2. jwt_token cookie
 *
 * Never:
 *
 * - URL token
 * - localStorage token
 *
 * =========================================================
 */
export function getRequestToken(
  req: Request,
): string | null {
  const bearer =
    extractBearerToken(req);
  if (bearer) {
    return bearer;
  }
  const cookieToken =
    req.cookies?.[
      SESSION_COOKIE
    ];
  if (
    typeof cookieToken === 'string' &&
    cookieToken.trim()
  ) {
    return cookieToken.trim();
  }
  return null;
}
/*
 * =========================================================
 * VERIFY JWT
 * =========================================================
 */
export function verifyJwt(
  token: string,
): OmnixJwtPayload | null {
  try {
    const decoded =
      jwt.verify(
        token,
        CONFIG.JWT_SECRET,
      );
    if (
      typeof decoded !== 'object' ||
      decoded === null
    ) {
      return null;
    }
    const payload =
      decoded as Partial<OmnixJwtPayload>;
    if (!payload.discordId) {
      return null;
    }
    return {
      discordId:
        String(payload.discordId),
      username:
        String(payload.username || ''),
      avatar:
        payload.avatar || null,
      isAdmin:
        Boolean(payload.isAdmin),
      isOwner:
        Boolean(payload.isOwner),
      isPremium:
        Boolean(payload.isPremium),
      iat:
        payload.iat,
      exp:
        payload.exp,
    };
  } catch {
    return null;
  }
}
/*
 * =========================================================
 * DISCORD LOGIN
 * =========================================================
 *
 * GET:
 *
 * /api/auth/login
 *
 * =========================================================
 */
router.get(
  '/login',
  (
    req: Request,
    res: Response,
  ) => {
    const clientId =
      getDiscordClientId();
    const redirectUri =
      getDiscordRedirectUri();
    if (!clientId) {
      console.error(
        '[OAuth] DISCORD_CLIENT_ID manquant.',
      );
      return res
        .status(500)
        .send(
          'DISCORD_CLIENT_ID est manquant.',
        );
    }
    if (!redirectUri) {
      console.error(
        '[OAuth] DISCORD_REDIRECT_URI manquant.',
      );
      return res
        .status(500)
        .send(
          'DISCORD_REDIRECT_URI est manquant.',
        );
    }
    const params =
      new URLSearchParams({
        client_id:
          clientId,
        redirect_uri:
          redirectUri,
        response_type:
          'code',
        scope:
          'identify guilds',
      });
    const discordUrl =
      `https://discord.com/oauth2/authorize?${params.toString()}`;
    console.log(
      `[OAuth] Redirection Discord → redirect_uri=${redirectUri}`,
    );
    return res.redirect(
      discordUrl,
    );
  },
);
/*
 * =========================================================
 * DISCORD CALLBACK
 * =========================================================
 *
 * GET:
 *
 * /api/auth/callback
 *
 * =========================================================
 */
router.get(
  '/callback',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      /*
       * -----------------------------------------------------
       * OAUTH CODE
       * -----------------------------------------------------
       */
      const code =
        typeof req.query.code ===
        'string'
          ? req.query.code.trim()
          : '';
      if (!code) {
        console.error(
          '[OAuth] Code OAuth Discord manquant.',
          {
            query:
              req.query,
          },
        );
        return res
          .status(400)
          .send(
            'Code OAuth Discord manquant.',
          );
      }
      /*
       * -----------------------------------------------------
       * DISCORD CONFIGURATION
       * -----------------------------------------------------
       */
      const clientId =
        getDiscordClientId();
      const clientSecret =
        getDiscordClientSecret();
      const redirectUri =
        getDiscordRedirectUri();
      if (
        !clientId ||
        !clientSecret ||
        !redirectUri
      ) {
        console.error(
          '[OAuth] Configuration Discord incomplète.',
          {
            clientId:
              Boolean(clientId),
            clientSecret:
              Boolean(clientSecret),
            redirectUri:
              Boolean(redirectUri),
          },
        );
        return res
          .status(500)
          .send(
            'Configuration OAuth Discord incomplète.',
          );
      }
      /*
       * -----------------------------------------------------
       * CODE → ACCESS TOKEN
       * -----------------------------------------------------
       */
      let tokenResponse;
      try {
        tokenResponse =
          await axios.post<DiscordTokenResponse>(
            DISCORD_OAUTH_TOKEN_URL,
            new URLSearchParams({
              client_id:
                clientId,
              client_secret:
                clientSecret,
              grant_type:
                'authorization_code',
              code,
              redirect_uri:
                redirectUri,
            }).toString(),
            {
              headers: {
                'Content-Type':
                  'application/x-www-form-urlencoded',
              },
              timeout:
                15000,
            },
          );
      } catch (error: any) {
        console.error(
          '[OAuth] Échec échange code → token Discord.',
          {
            status:
              error?.response?.status,
            data:
              error?.response?.data,
            message:
              error?.message,
          },
        );
        throw new Error(
          'Échange du code OAuth Discord impossible.',
        );
      }
      const accessToken =
        tokenResponse.data
          ?.access_token;
      if (!accessToken) {
        throw new Error(
          'Discord n’a pas retourné d’access_token.',
        );
      }
      /*
       * -----------------------------------------------------
       * GET DISCORD USER
       * -----------------------------------------------------
       */
      let userResponse;
      try {
        userResponse =
          await axios.get<DiscordUser>(
            `${DISCORD_API}/users/@me`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
              timeout:
                15000,
            },
          );
      } catch (error: any) {
        console.error(
          '[OAuth] Impossible de récupérer /users/@me.',
          {
            status:
              error?.response?.status,
            data:
              error?.response?.data,
            message:
              error?.message,
          },
        );
        throw new Error(
          'Impossible de récupérer le compte Discord.',
        );
      }
      const discordUser =
        userResponse.data;
      if (!discordUser?.id) {
        throw new Error(
          'Discord a retourné un utilisateur invalide.',
        );
      }
      /*
       * -----------------------------------------------------
       * GET DISCORD GUILDS
       * -----------------------------------------------------
       */
      let guilds: DiscordGuild[] = [];
      try {
        const guildResponse =
          await axios.get<
            DiscordGuild[]
          >(
            `${DISCORD_API}/users/@me/guilds`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
              timeout:
                15000,
            },
          );
        guilds =
          Array.isArray(
            guildResponse.data,
          )
            ? guildResponse.data
            : [];
      } catch (error: any) {
        /*
         * Guilds are useful but should not
         * prevent authentication if Discord
         * temporarily refuses this endpoint.
         */
        console.error(
          '[OAuth] Impossible de récupérer les guilds Discord.',
          {
            status:
              error?.response?.status,
            data:
              error?.response?.data,
            message:
              error?.message,
          },
        );
        guilds = [];
      }
      /*
       * -----------------------------------------------------
       * MANAGEABLE GUILDS
       * -----------------------------------------------------
       */
      const manageableGuilds =
        guilds.filter(
          (guild) => {
            if (guild.owner) {
              return true;
            }
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
              const ADMINISTRATOR =
                0x8n;
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
          },
        );
      /*
       * -----------------------------------------------------
       * NORMALIZED GUILDS
       * -----------------------------------------------------
       */
      const guildData =
        manageableGuilds.map(
          (guild) => ({
            id:
              guild.id,
            name:
              guild.name,
            icon:
              guild.icon,
            owner:
              Boolean(
                guild.owner,
              ),
            permissions:
              guild.permissions ||
              '0',
          }),
        );
      /*
       * -----------------------------------------------------
       * OWNER
       * -----------------------------------------------------
       */
      const owner =
        isOwner(
          discordUser.id,
        );
      /*
       * -----------------------------------------------------
       * EXISTING USER
       * -----------------------------------------------------
       */
      const existingUser =
        await User.findOne({
          discordId:
            discordUser.id,
        });
      /*
       * -----------------------------------------------------
       * PREMIUM
       * -----------------------------------------------------
       *
       * We keep the existing subscription state.
       *
       * Support both historical fields:
       *
       * isPremium
       * premium
       *
       * -----------------------------------------------------
       */
      const isPremium =
        Boolean(
          existingUser &&
          (
            (existingUser as any)
              .isPremium === true ||
            (existingUser as any)
              .premium === true
          ),
        );
      /*
       * -----------------------------------------------------
       * UPSERT USER
       * -----------------------------------------------------
       */
      await User.findOneAndUpdate(
        {
          discordId:
            discordUser.id,
        },
        {
          $set: {
            discordId:
              discordUser.id,
            username:
              discordUser.username,
            globalName:
              discordUser.global_name ||
              discordUser.username,
            avatar:
              discordUser.avatar ||
              null,
            guilds:
              guildData,
            isPremium,
            isAdmin:
              owner,
            lastLogin:
              new Date(),
          },
        },
        {
          upsert:
            true,
          new:
            true,
          setDefaultsOnInsert:
            true,
        },
      );
      /*
       * -----------------------------------------------------
       * CREATE JWT
       * -----------------------------------------------------
       */
      const token =
        createJwt(
          discordUser,
          isPremium,
        );
      /*
       * -----------------------------------------------------
       * SET SESSION COOKIE
       * -----------------------------------------------------
       */
      const cookieOptions =
        getSessionCookieOptions();
      res.cookie(
        SESSION_COOKIE,
        token,
        cookieOptions,
      );
      /*
       * -----------------------------------------------------
       * AUTH LOG
       * -----------------------------------------------------
       */
      console.log(
        '[OAuth] Connexion Discord réussie.',
        {
          discordId:
            discordUser.id,
          username:
            discordUser.username,
          owner,
          premium:
            isPremium,
          guilds:
            guildData.length,
          secureCookie:
            cookieOptions.secure,
          sameSite:
            cookieOptions.sameSite,
          path:
            cookieOptions.path,
          maxAge:
            cookieOptions.maxAge,
        },
      );
      /*
       * -----------------------------------------------------
       * REDIRECT
       * -----------------------------------------------------
       *
       * JWT is ONLY in the cookie.
       *
       * Never:
       *
       * /dashboard?token=...
       *
       * -----------------------------------------------------
       */
      return res.redirect(
        '/dashboard',
      );
    } catch (error: any) {
      console.error(
        '[OAuth Discord] ÉCHEC COMPLET.',
        {
          message:
            error?.message,
          status:
            error?.response?.status,
          discord:
            error?.response?.data,
        },
      );
      return res
        .status(500)
        .send(`
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            >
            <title>
              Erreur OAuth — OMNIX
            </title>
          </head>
          <body
            style="
              background:#030712;
              color:white;
              font-family:Arial,sans-serif;
              display:flex;
              justify-content:center;
              align-items:center;
              min-height:100vh;
              margin:0;
            "
          >
            <div
              style="
                background:#0f172a;
                padding:40px;
                border-radius:18px;
                max-width:500px;
                width:90%;
                text-align:center;
              "
            >
              <h1>
                Connexion impossible
              </h1>
              <p>
                Une erreur est survenue
                pendant la connexion Discord.
              </p>
              <a
                href="/"
                style="
                  color:#60a5fa;
                  text-decoration:none;
                "
              >
                Retour à OMNIX
              </a>
            </div>
          </body>
          </html>
        `);
    }
  },
);
/*
 * =========================================================
 * CURRENT USER GUILDS
 * =========================================================
 *
 * GET:
 *
 * /api/auth/guilds
 *
 * =========================================================
 */
router.get(
  '/guilds',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token =
        getRequestToken(req);
      if (!token) {
        return res
          .status(401)
          .json({
            success:
              false,
            error:
              'Session inexistante.',
          });
      }
      const payload =
        verifyJwt(token);
      if (!payload?.discordId) {
        return res
          .status(401)
          .json({
            success:
              false,
            error:
              'Session invalide ou expirée.',
          });
      }
      const user =
        await User.findOne({
          discordId:
            payload.discordId,
        }).lean();
      if (!user) {
        return res
          .status(404)
          .json({
            success:
              false,
            error:
              'Utilisateur OMNIX introuvable.',
          });
      }
      return res.json({
        success:
          true,
        guilds:
          Array.isArray(
            (user as any).guilds,
          )
            ? (user as any).guilds
            : [],
      });
    } catch (error) {
      console.error(
        '[Auth /guilds]',
        error,
      );
      return res
        .status(500)
        .json({
          success:
            false,
          error:
            'Impossible de récupérer les serveurs.',
        });
    }
  },
);
/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 *
 * GET:
 *
 * /api/auth/me
 *
 * =========================================================
 */
router.get(
  '/me',
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token =
        getRequestToken(req);
      if (!token) {
        return res
          .status(401)
          .json({
            success:
              false,
            error:
              'Utilisateur non connecté.',
          });
      }
      const payload =
        verifyJwt(token);
      if (!payload?.discordId) {
        return res
          .status(401)
          .json({
            success:
              false,
            error:
              'Session expirée.',
          });
      }
      const user =
        await User.findOne({
          discordId:
            payload.discordId,
        }).lean();
      if (!user) {
        return res
          .status(404)
          .json({
            success:
              false,
            error:
              'Utilisateur introuvable.',
          });
      }
      const owner =
        isOwner(
          String(
            (user as any).discordId,
          ),
        );
      return res.json({
        success:
          true,
        user: {
          discordId:
            (user as any).discordId,
          username:
            (user as any).username,
          globalName:
            (user as any).globalName,
          avatar:
            discordAvatarUrl(
              String(
                (user as any)
                  .discordId,
              ),
              (user as any)
                .avatar,
            ),
          isAdmin:
            owner ||
            Boolean(
              (user as any)
                .isAdmin,
            ),
          isOwner:
            owner,
          isPremium:
            Boolean(
              (user as any)
                .isPremium,
            ),
          guilds:
            Array.isArray(
              (user as any).guilds,
            )
              ? (user as any).guilds.map(
                  (guild: any) => ({
                    ...guild,
                    icon:
                      discordGuildIconUrl(
                        String(
                          guild?.id ||
                          '',
                        ),
                        guild?.icon,
                      ),
                  }),
                )
              : [],
        },
      });
    } catch (error) {
      console.error(
        '[Auth /me]',
        error,
      );
      return res
        .status(401)
        .json({
          success:
            false,
          error:
            'Session invalide.',
        });
    }
  },
);
/*
 * =========================================================
 * LOGOUT
 * =========================================================
 */
router.get(
  '/logout',
  (
    req: Request,
    res: Response,
  ) => {
    const isProduction =
      process.env.NODE_ENV ===
        'production' ||
      process.env.RENDER === 'true';
    res.clearCookie(
      SESSION_COOKIE,
      {
        httpOnly:
          true,
        secure:
          isProduction,
        sameSite:
          'lax',
        path:
          '/',
      },
    );
    return res.redirect(
      '/',
    );
  },
);
/*
 * =========================================================
 * EXPORT
 * =========================================================
 */
export default router;