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
 * Responsibilities:
 *
 * - Discord OAuth2 login
 * - Discord OAuth2 callback
 * - JWT creation
 * - JWT verification
 * - httpOnly session cookie
 * - current user (/me)
 * - user guilds (/guilds)
 * - logout
 *
 * IMPORTANT:
 *
 * OMNIX uses ONE official session cookie:
 *
 *     jwt_token
 *
 * We do NOT use:
 *
 *     omnix_token
 *     localStorage
 *     ?token=...
 *
 * The JWT stays inside the httpOnly cookie.
 *
 * =========================================================
 */

const router = express.Router();


function discordAvatarUrl(discordId: string, avatar: any): string | null {
  if (!avatar) return null;
  const value = String(avatar);
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.discordapp.com/avatars/${discordId}/${value}.png?size=128`;
}

function discordGuildIconUrl(guildId: string, icon: any): string | null {
  if (!icon) return null;
  const value = String(icon);
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.discordapp.com/icons/${guildId}/${value}.png?size=128`;
}

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
 * SESSION CONFIGURATION
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
 * OWNER IDS
 * =========================================================
 *
 * We support both:
 *
 * CONFIG.OWNER_IDS
 *
 * and:
 *
 * process.env.OWNER_IDS
 *
 * Environment variables are especially important on Render.
 */

export function getOwnerIds(): string[] {
  const configured =
    (CONFIG as any).OWNER_IDS;

  /*
   * CONFIG.OWNER_IDS is already an array.
   */

  if (Array.isArray(configured)) {
    return configured
      .map((id) => String(id))
      .map((id) => id.trim())
      .filter(Boolean);
  }

  /*
   * Fallback to environment variable.
   */

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
    discordId:
      String(user.id),

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
 * COOKIE OPTIONS
 * =========================================================
 */

export function getSessionCookieOptions() {
  return {
    httpOnly: true,

    /*
     * Render production = HTTPS.
     *
     * Local development = HTTP.
     */

    secure:
      process.env.NODE_ENV ===
      'production',

    /*
     * The dashboard and OAuth callback are
     * on the same site.
     */

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
 *
 * Bearer is kept for API compatibility.
 *
 * The browser itself should normally use
 * the httpOnly cookie.
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
 * 1. Authorization: Bearer ...
 * 2. jwt_token cookie
 *
 * IMPORTANT:
 *
 * We do NOT read:
 *
 * ?token=...
 *
 * =========================================================
 */

export function getRequestToken(
  req: Request,
): string | null {
  /*
   * 1. Bearer
   */

  const bearer =
    extractBearerToken(req);

  if (bearer) {
    return bearer;
  }

  /*
   * 2. Official OMNIX cookie
   */

  const cookieToken =
    req.cookies?.[
      SESSION_COOKIE
    ];

  if (
    typeof cookieToken ===
      'string' &&
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
      typeof decoded !==
      'object' ||
      decoded === null
    ) {
      return null;
    }

    const payload =
      decoded as Partial<OmnixJwtPayload>;

    if (
      !payload.discordId
    ) {
      return null;
    }

    return {
      discordId:
        String(
          payload.discordId,
        ),

      username:
        String(
          payload.username ||
          '',
        ),

      avatar:
        payload.avatar ||
        null,

      isAdmin:
        Boolean(
          payload.isAdmin,
        ),

      isOwner:
        Boolean(
          payload.isOwner,
        ),

      isPremium:
        Boolean(
          payload.isPremium,
        ),

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
 * Redirects the user to Discord.
 */

router.get(
  '/login',
  (
    req: Request,
    res: Response,
  ) => {
    const clientId =
      process.env.DISCORD_CLIENT_ID ||
      (CONFIG as any).DISCORD
        ?.CLIENT_ID;

    const redirectUri =
      process.env.DISCORD_REDIRECT_URI ||
      (CONFIG as any).DISCORD
        ?.REDIRECT_URI;

    /*
     * Configuration validation.
     */

    if (!clientId) {
      return res
        .status(500)
        .send(
          'DISCORD_CLIENT_ID est manquant.',
        );
    }

    if (!redirectUri) {
      return res
        .status(500)
        .send(
          'DISCORD_REDIRECT_URI est manquant.',
        );
    }

    /*
     * Discord OAuth parameters.
     */

    const params =
      new URLSearchParams({
        client_id:
          clientId,

        redirect_uri:
          redirectUri,

        response_type:
          'code',

        /*
         * identify:
         * user information
         *
         * guilds:
         * servers the user belongs to
         */

        scope:
          'identify guilds',
      });

    const discordUrl =
      `https://discord.com/oauth2/authorize?${params.toString()}`;

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
 * Flow:
 *
 * Discord
 *    ↓
 * OAuth code
 *    ↓
 * Discord token
 *    ↓
 * Discord user
 *    ↓
 * Discord guilds
 *    ↓
 * MongoDB
 *    ↓
 * JWT
 *    ↓
 * jwt_token httpOnly cookie
 *    ↓
 * /dashboard
 *
 * IMPORTANT:
 *
 * The JWT is NEVER placed in the URL.
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
          ? req.query.code
          : null;

      if (!code) {
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
        process.env.DISCORD_CLIENT_ID ||
        (CONFIG as any).DISCORD
          ?.CLIENT_ID;

      const clientSecret =
        process.env.DISCORD_CLIENT_SECRET ||
        (CONFIG as any).DISCORD
          ?.CLIENT_SECRET;

      const redirectUri =
        process.env.DISCORD_REDIRECT_URI ||
        (CONFIG as any).DISCORD
          ?.REDIRECT_URI;

      if (
        !clientId ||
        !clientSecret ||
        !redirectUri
      ) {
        console.error(
          '[OAuth] Configuration Discord incomplète.',
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

      const tokenResponse =
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

            timeout: 10000,
          },
        );

      const accessToken =
        tokenResponse.data
          .access_token;

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

      const userResponse =
        await axios.get<DiscordUser>(
          `${DISCORD_API}/users/@me`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            timeout: 10000,
          },
        );

      const discordUser =
        userResponse.data;

      if (
        !discordUser?.id
      ) {
        throw new Error(
          'Discord a retourné un utilisateur invalide.',
        );
      }

      /*
       * -----------------------------------------------------
       * GET DISCORD GUILDS
       * -----------------------------------------------------
       */

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

            timeout: 10000,
          },
        );

      const guilds =
        guildResponse.data || [];

      /*
       * -----------------------------------------------------
       * SERVERS MANAGEABLE BY USER
       * -----------------------------------------------------
       *
       * Owner = true
       *
       * OR
       *
       * Administrator permission.
       */

      const manageableGuilds =
        guilds.filter(
          (guild) => {
            /*
             * Server owner
             */

            if (guild.owner) {
              return true;
            }

            /*
             * Administrator permission
             */

            if (
              typeof guild.permissions ===
              'string'
            ) {
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
            }

            return false;
          },
        );

      /*
       * -----------------------------------------------------
       * NORMALIZED GUILD DATA
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
       * OWNER STATUS
       * -----------------------------------------------------
       */

      const owner =
        isOwner(
          discordUser.id,
        );

      /*
       * -----------------------------------------------------
       * EXISTING OMNIX USER
       * -----------------------------------------------------
       */

      const existingUser =
        await User.findOne({
          discordId:
            discordUser.id,
        });

      /*
       * Keep an existing premium subscription.
       */

      const isPremium =
        Boolean(
          existingUser &&
          (
            (existingUser as any)
              .isPremium ||

            (existingUser as any)
              .premium
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
       * CREATE OMNIX JWT
       * -----------------------------------------------------
       */

      const token =
        createJwt(
          discordUser,
          isPremium,
        );

      /*
       * -----------------------------------------------------
       * CREATE SESSION COOKIE
       * -----------------------------------------------------
       *
       * IMPORTANT:
       *
       * httpOnly = JavaScript cannot read it.
       *
       * This is intentional.
       *
       * The frontend does NOT need to know
       * the JWT.
       */

      res.cookie(
        SESSION_COOKIE,
        token,
        getSessionCookieOptions(),
      );

      /*
       * -----------------------------------------------------
       * LOG
       * -----------------------------------------------------
       */

      console.log(
        `[OAuth] Connexion réussie : ${discordUser.id} | owner=${owner} | guilds=${guildData.length}`,
      );

      /*
       * -----------------------------------------------------
       * REDIRECT
       * -----------------------------------------------------
       *
       * NO:
       *
       * /dashboard?token=...
       *
       * YES:
       *
       * /dashboard
       */

      return res.redirect(
        '/dashboard',
      );
    } catch (error: any) {
      console.error(
        '[OAuth Discord] Erreur :',
        error?.response?.data ||
          error?.message ||
          error,
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
 * GET USER GUILDS
 * =========================================================
 *
 * GET:
 *
 * /api/auth/guilds
 *
 * Authentication:
 *
 * - jwt_token cookie
 * OR
 * - Authorization Bearer token
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
      /*
       * Get session token.
       */

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

      /*
       * Verify JWT.
       */

      const payload =
        verifyJwt(token);

      if (
        !payload?.discordId
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              'Session invalide ou expirée.',
          });
      }

      /*
       * Get OMNIX user.
       */

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

      /*
       * Return guilds.
       */

      return res.json({
        success:
          true,

        guilds:
          (user as any)
            .guilds || [],
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
 * This is the main endpoint used by the frontend
 * to determine whether the visitor is connected.
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
      /*
       * Get session.
       */

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

      /*
       * Verify session.
       */

      const payload =
        verifyJwt(token);

      if (
        !payload?.discordId
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              'Session expirée.',
          });
      }

      /*
       * Get current user from MongoDB.
       */

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

      /*
       * Recalculate owner status.
       *
       * We deliberately do NOT rely only on the JWT.
       *
       * This means changing OWNER_IDS on Render
       * can immediately affect the authorization
       * after the next request.
       */

      const owner =
        isOwner(
          String(
            (user as any)
              .discordId,
          ),
        );

      /*
       * Return safe public user information.
       *
       * NEVER return:
       *
       * - JWT
       * - Discord OAuth access token
       * - Discord OAuth refresh token
       */

      return res.json({
        success:
          true,

        user: {
          discordId:
            (user as any)
              .discordId,

          username:
            (user as any)
              .username,

          globalName:
            (user as any)
              .globalName,

          avatar:
            discordAvatarUrl(
              String((user as any).discordId),
              (user as any).avatar,
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
            Array.isArray((user as any).guilds)
              ? (user as any).guilds.map((guild: any) => ({
                  ...guild,
                  icon: discordGuildIconUrl(
                    String(guild?.id || ''),
                    guild?.icon,
                  ),
                }))
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
 *
 * GET:
 *
 * /api/auth/logout
 *
 * Deletes the official OMNIX session cookie.
 *
 * =========================================================
 */

router.get(
  '/logout',
  (
    req: Request,
    res: Response,
  ) => {
    res.clearCookie(
      SESSION_COOKIE,
      {
        httpOnly:
          true,

        secure:
          process.env.NODE_ENV ===
          'production',

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