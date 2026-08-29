import express, {
  type Request,
  type Response,
} from 'express';

import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { User } from '../../models/User';
import { License } from '../../models/License';
import { CONFIG } from '../../config/index';
import { recordPlatformEvent } from '../../services/platformEvents';

/*
 * =========================================================
 * OMNIX — AUTH ROUTES
 * =========================================================
 *
 * AUTHENTICATION FLOW
 *
 * Discord
 *   ↓
 * /api/auth/login
 *   ↓
 * Discord OAuth
 *   ↓
 * /api/auth/callback
 *   ↓
 * Discord user
 *   ↓
 * MongoDB
 *   ↓
 * JWT
 *   ↓
 * httpOnly cookie : jwt_token
 *   ↓
 * /dashboard
 *   ↓
 * /api/auth/me
 *
 * IMPORTANT :
 *
 * - Aucun JWT dans l'URL.
 * - Aucun localStorage JWT.
 * - Une seule session officielle :
 *
 *      jwt_token
 *
 * =========================================================
 */

const router = express.Router();

/*
 * =========================================================
 * CONSTANTES
 * =========================================================
 */

const DISCORD_API =
  'https://discord.com/api/v10';

const DISCORD_OAUTH_AUTHORIZE_URL =
  'https://discord.com/oauth2/authorize';

const DISCORD_OAUTH_TOKEN_URL =
  'https://discord.com/api/oauth2/token';

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_STATE_COOKIE = 'omnix_google_oauth_state';

export const SESSION_COOKIE =
  'jwt_token';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_COOKIE = 'omnix_oauth_state';
const OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;

/*
 * =========================================================
 * TYPES DISCORD
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
  email?: string | null;
  verified?: boolean;
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
 * JWT
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
 * CONFIGURATION DISCORD
 * =========================================================
 */

function getDiscordClientId(): string | null {
  const value =
    process.env.DISCORD_CLIENT_ID ||
    (CONFIG as any)?.DISCORD?.CLIENT_ID;

  if (!value) {
    return null;
  }

  return String(value).trim() || null;
}

function getDiscordClientSecret(): string | null {
  const value =
    process.env.DISCORD_CLIENT_SECRET ||
    (CONFIG as any)?.DISCORD?.CLIENT_SECRET;

  if (!value) {
    return null;
  }

  return String(value).trim() || null;
}

function getDiscordRedirectUri(): string | null {
  const value =
    process.env.DISCORD_REDIRECT_URI ||
    (CONFIG as any)?.DISCORD?.REDIRECT_URI;

  if (!value) {
    return null;
  }

  return String(value).trim() || null;
}

/*
 * =========================================================
 * OWNER IDS
 * =========================================================
 */

export function getOwnerIds(): string[] {
  const configOwnerIds =
    (CONFIG as any)?.OWNER_IDS;

  if (Array.isArray(configOwnerIds)) {
    return configOwnerIds
      .map((id) => String(id).trim())
      .filter(Boolean);
  }

  const environmentOwnerIds =
    process.env.OWNER_IDS ||
    process.env.OWNER_ID ||
    '';

  return environmentOwnerIds
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
  const normalizedId =
    String(discordId).trim();

  if (!normalizedId) {
    return false;
  }

  return getOwnerIds().includes(
    normalizedId,
  );
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

  const value =
    String(avatar).trim();

  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return (
    `https://cdn.discordapp.com/avatars/` +
    `${discordId}/${value}.png?size=128`
  );
}

function discordGuildIconUrl(
  guildId: string,
  icon: unknown,
): string | null {
  if (!icon) {
    return null;
  }

  const value =
    String(icon).trim();

  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return (
    `https://cdn.discordapp.com/icons/` +
    `${guildId}/${value}.png?size=128`
  );
}

/*
 * =========================================================
 * JWT SECRET
 * =========================================================
 */

function getJwtSecret(): string {
  const secret =
    CONFIG.JWT_SECRET ||
    process.env.JWT_SECRET;

  if (
    !secret ||
    String(secret).trim().length < 16
  ) {
    throw new Error(
      'JWT_SECRET est manquant ou trop court.',
    );
  }

  return String(secret).trim();
}

/*
 * =========================================================
 * CREATE JWT
 * =========================================================
 */

export function createJwt(
  user: DiscordUser,
  premium = false,
  admin = false,
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
      owner || Boolean(admin),

    isOwner:
      owner,

    isPremium:
      Boolean(premium),
  };

  return jwt.sign(
    payload,
    getJwtSecret(),
    {
      expiresIn: '7d',
      issuer: 'OMNIX',
      subject: String(user.id),
    },
  );
}

/*
 * =========================================================
 * VERIFY JWT
 * =========================================================
 */

export function verifyJwt(
  token: string,
): OmnixJwtPayload | null {
  if (
    !token ||
    typeof token !== 'string'
  ) {
    return null;
  }

  try {
    const decoded =
      jwt.verify(
        token,
        getJwtSecret(),
        {
          issuer: 'OMNIX',
        },
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
        String(
          payload.username || '',
        ),

      avatar:
        payload.avatar
          ? String(payload.avatar)
          : null,

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
  } catch (error) {
    console.warn(
      '[AUTH] JWT invalide ou expiré.',
      error instanceof Error
        ? error.message
        : error,
    );

    return null;
  }
}

/*
 * =========================================================
 * COOKIE OPTIONS
 * =========================================================
 */

export function getSessionCookieOptions() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
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

export function getOAuthStateCookieOptions() {
  const production = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  return { httpOnly: true, secure: production, sameSite: 'lax' as const, maxAge: OAUTH_STATE_MAX_AGE, path: '/api/auth' };
}

/*
 * =========================================================
 * TOKEN EXTRACTION
 * =========================================================
 *
 * PRIORITY :
 *
 * 1. Authorization Bearer
 * 2. jwt_token cookie
 *
 * Aucun token URL.
 *
 * =========================================================
 */

export function extractBearerToken(
  req: Request,
): string | null {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    typeof authorization !== 'string'
  ) {
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

export function getRequestToken(
  req: Request,
): string | null {
  const bearer =
    extractBearerToken(req);

  if (bearer) {
    return bearer;
  }

  const cookieToken =
    req.cookies?.[SESSION_COOKIE];

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
 * AUTHENTICATED PAYLOAD
 * =========================================================
 */

function getAuthenticatedPayload(
  req: Request,
): OmnixJwtPayload | null {
  const token =
    getRequestToken(req);

  if (!token) {
    return null;
  }

  return verifyJwt(token);
}

/*
 * =========================================================
 * DISCORD LOGIN
 * =========================================================
 *
 * GET /api/auth/login
 *
 * =========================================================
 */

router.get('/google', (req: Request, res: Response) => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || (CONFIG as any)?.GOOGLE?.CLIENT_ID || '').trim();
  const redirectUri = String(process.env.GOOGLE_REDIRECT_URI || (CONFIG as any)?.GOOGLE?.REDIRECT_URI || '').trim();
  if (!clientId || !redirectUri) return res.status(500).send('Configuration Google OAuth incomplète.');
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie(GOOGLE_STATE_COOKIE, state, getOAuthStateCookieOptions());
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, access_type: 'offline', prompt: 'select_account' });
  return res.redirect(`${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const returnedState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const expectedState = typeof req.cookies?.[GOOGLE_STATE_COOKIE] === 'string' ? req.cookies[GOOGLE_STATE_COOKIE].trim() : '';
    res.clearCookie(GOOGLE_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });
    if (!code || !returnedState || !expectedState || returnedState.length !== expectedState.length || !crypto.timingSafeEqual(Buffer.from(returnedState), Buffer.from(expectedState))) return res.status(400).send('Session Google OAuth invalide ou expirée.');
    const clientId = String(process.env.GOOGLE_CLIENT_ID || (CONFIG as any)?.GOOGLE?.CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || (CONFIG as any)?.GOOGLE?.CLIENT_SECRET || '').trim();
    const redirectUri = String(process.env.GOOGLE_REDIRECT_URI || (CONFIG as any)?.GOOGLE?.REDIRECT_URI || '').trim();
    if (!clientId || !clientSecret || !redirectUri) return res.status(500).send('Configuration Google OAuth incomplète.');
    const token = await axios.post(GOOGLE_OAUTH_TOKEN_URL, new URLSearchParams({code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code'}), {headers:{'Content-Type':'application/x-www-form-urlencoded'}, timeout:15000});
    const accessToken = String(token.data?.access_token || '');
    if (!accessToken) return res.status(502).send('Google n’a pas retourné de jeton de connexion.');
    const info = await axios.get(GOOGLE_USERINFO_URL, {headers:{Authorization:`Bearer ${accessToken}`}, timeout:15000});
    const googleUser = info.data || {};
    if (!googleUser.sub || !googleUser.email) return res.status(400).send('Compte Google incomplet.');
    let user = await User.findOne({ $or: [{ googleId: String(googleUser.sub) }, { email: String(googleUser.email).toLowerCase() }] });
    if (user && user.isBlacklisted) return res.status(403).send('Ce compte OMNIX est suspendu.');
    if (!user) {
      user = await User.create({ discordId:`google:${String(googleUser.sub)}`, googleId:String(googleUser.sub), authProvider:'google', username:String(googleUser.name || googleUser.email.split('@')[0]), globalName:String(googleUser.name || googleUser.email.split('@')[0]), avatar:googleUser.picture || null, email:String(googleUser.email).toLowerCase(), emailVerified:Boolean(googleUser.email_verified), guilds:[], isAdmin:false, role:'user', isPremium:false, isBlacklisted:false, lastLogin:new Date() });
    } else {
      user.googleId = String(googleUser.sub); user.authProvider = user.discordId.startsWith('google:') ? 'google' : 'both'; user.email = String(googleUser.email).toLowerCase(); user.emailVerified = Boolean(googleUser.email_verified); user.avatar = googleUser.picture || user.avatar; user.lastLogin = new Date(); await user.save();
    }
    const premium = Boolean(user.isPremium) || Boolean(await License.exists({buyerId:String(user.discordId), status:'active', $or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]}));
    const jwtUser:any = { id:String(user.discordId), username:user.globalName || user.username, global_name:user.globalName || user.username, avatar:null };
    const jwtToken = createJwt(jwtUser, premium, Boolean(user.isAdmin));
    res.cookie(SESSION_COOKIE, jwtToken, getSessionCookieOptions());
    await recordPlatformEvent('user_login', {userId:String(user.discordId), metadata:{provider:'google'}});
    return res.redirect('/dashboard');
  } catch (error:any) {
    console.error('[OAuth Google] ÉCHEC:', error?.response?.data || error?.message || error);
    return res.status(502).send('Impossible de terminer la connexion Google.');
  }
});

router.get(
  '/login',
  (
    _req: Request,
    res: Response,
  ) => {
    try {
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

      const state = crypto.randomBytes(32).toString('hex');
      res.cookie(OAUTH_STATE_COOKIE, state, getOAuthStateCookieOptions());
      const params =
        new URLSearchParams({
          client_id:
            clientId,

          redirect_uri:
            redirectUri,

          response_type:
            'code',

          scope:
            'identify email guilds',
          state,
        });

      const discordUrl =
        `${DISCORD_OAUTH_AUTHORIZE_URL}?${params.toString()}`;

      console.log(
        '[OAuth] Démarrage connexion Discord.',
      );

      console.log(
        '[OAuth] Redirect URI:',
        redirectUri,
      );

      return res.redirect(
        discordUrl,
      );
    } catch (error) {
      console.error(
        '[OAuth] Erreur /login:',
        error,
      );

      return res
        .status(500)
        .send(
          'Impossible de démarrer la connexion Discord.',
        );
    }
  },
);

/*
 * =========================================================
 * DISCORD CALLBACK
 * =========================================================
 *
 * GET /api/auth/callback
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
      console.log(
        '[OAuth] Callback Discord reçu.',
      );

      /*
       * -----------------------------------------------------
       * OAUTH CODE
       * -----------------------------------------------------
       */

      const code =
        typeof req.query.code === 'string'
          ? req.query.code.trim()
          : '';

      const oauthError =
        typeof req.query.error === 'string'
          ? req.query.error
          : '';
      const returnedState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
      const expectedState = typeof req.cookies?.[OAUTH_STATE_COOKIE] === 'string' ? req.cookies[OAUTH_STATE_COOKIE].trim() : '';
      if (!returnedState || !expectedState || returnedState.length !== expectedState.length || !crypto.timingSafeEqual(Buffer.from(returnedState), Buffer.from(expectedState))) {
        res.clearCookie(OAUTH_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });
        return res.status(400).send('Session OAuth invalide ou expirée.');
      }
      res.clearCookie(OAUTH_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });

      if (oauthError) {
        console.error(
          '[OAuth] Discord a refusé la connexion:',
          oauthError,
        );

        return res
          .status(400)
          .send(
            `Connexion Discord refusée : ${oauthError}`,
          );
      }

      if (!code) {
        console.error(
          '[OAuth] Aucun code OAuth reçu.',
          {
            queryKeys:
              Object.keys(req.query),
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
       * CONFIGURATION
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

      console.log(
        '[OAuth] Configuration Discord OK.',
      );

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
          '[OAuth] Échec échange code → token.',
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
        tokenResponse.data?.access_token;

      if (!accessToken) {
        throw new Error(
          'Discord n’a pas retourné d’access_token.',
        );
      }

      console.log(
        '[OAuth] Access token Discord obtenu.',
      );

      /*
       * -----------------------------------------------------
       * DISCORD USER
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

      console.log(
        '[OAuth] Utilisateur Discord:',
        {
          id:
            discordUser.id,

          username:
            discordUser.username,
        },
      );

      /*
       * -----------------------------------------------------
       * DISCORD GUILDS
       * -----------------------------------------------------
       */

      let guilds: DiscordGuild[] = [];

      try {
        const guildResponse =
          await axios.get<DiscordGuild[]>(
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

        console.log(
          `[OAuth] ${guilds.length} serveur(s) Discord récupéré(s).`,
        );
      } catch (error: any) {
        console.error(
          '[OAuth] Impossible de récupérer les guilds.',
          {
            status:
              error?.response?.status,

            data:
              error?.response?.data,

            message:
              error?.message,
          },
        );

        /*
         * Ne bloque pas l'authentification.
         */
        guilds = [];
      }

      /*
       * -----------------------------------------------------
       * SERVEURS ADMINISTRABLES
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
       * NORMALISATION GUILDS
       * -----------------------------------------------------
       */

      const guildData =
        manageableGuilds.map(
          (guild) => ({
            id:
              String(guild.id),

            name:
              String(guild.name),

            icon:
              guild.icon || null,

            owner:
              Boolean(guild.owner),

            permissions:
              guild.permissions ||
              '0',
            memberCount:
              Number((globalThis as any).omnixDiscordClient?.guilds?.cache?.get?.(guild.id)?.memberCount ?? 0),
            features:
              Array.isArray(guild.features) ? guild.features : [],
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

      console.log(
        '[OAuth] Permissions OMNIX:',
        {
          discordId:
            discordUser.id,

          owner,

          manageableGuilds:
            guildData.length,

          configuredOwners:
            getOwnerIds().length,
        },
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
       */

      if (existingUser && (existingUser as any).isBlacklisted === true) {
        return res.status(403).send('Ce compte OMNIX est suspendu.');
      }

      const personalLicense = await License.findOne({ buyerId: discordUser.id, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).lean();
      const isPremium = Boolean(existingUser && (existingUser as any).isPremium === true) || Boolean(personalLicense);

      /*
       * -----------------------------------------------------
       * DATABASE UPSERT
       * -----------------------------------------------------
       */

      const updatedUser =
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

              email:
                discordUser.email || null,

              emailVerified:
                Boolean(discordUser.verified),

              // Le token OAuth reste côté serveur (select:false) afin de
              // pouvoir rafraîchir la liste des serveurs sans exposer le token.
              accessToken,
              refreshToken: tokenResponse.data?.refresh_token || undefined,
              tokenExpiresAt: tokenResponse.data?.expires_in
                ? new Date(Date.now() + Number(tokenResponse.data.expires_in) * 1000)
                : undefined,

              guilds:
                guildData,

              isPremium,

              isAdmin:
                owner || Boolean(existingUser && (existingUser as any).isAdmin),

              role:
                owner ? 'owner' : (existingUser as any)?.role || (existingUser?.isAdmin ? 'admin' : 'user'),

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

      if (!updatedUser) {
        throw new Error(
          'Impossible d’enregistrer l’utilisateur OMNIX.',
        );
      }

      await recordPlatformEvent(existingUser ? 'user_login' : 'user_registered', { userId: discordUser.id });

      console.log(
        '[OAuth] Utilisateur MongoDB synchronisé.',
        {
          discordId:
            discordUser.id,
        },
      );

      /*
       * -----------------------------------------------------
       * JWT
       * -----------------------------------------------------
       */

      const token =
        createJwt(
          discordUser,
          isPremium,
          Boolean(existingUser && (existingUser as any).isAdmin),
        );

      console.log(
        '[OAuth] JWT OMNIX généré.',
      );

      /*
       * -----------------------------------------------------
       * COOKIE
       * -----------------------------------------------------
       */

      const cookieOptions =
        getSessionCookieOptions();

      res.cookie(
        SESSION_COOKIE,
        token,
        cookieOptions,
      );

      console.log(
        '[OAuth] Cookie de session créé.',
        {
          cookie:
            SESSION_COOKIE,

          httpOnly:
            cookieOptions.httpOnly,

          secure:
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
       * IMPORTANT :
       *
       * Aucun JWT dans l'URL.
       *
       * /dashboard
       *
       * uniquement.
       *
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
        },
      );

      console.log(
        '[OAuth] Redirection vers /dashboard.',
      );

      return res.redirect(
        302,
        '/dashboard',
      );
    } catch (error: any) {
      console.error(
        '[OAuth Discord] ÉCHEC COMPLET.',
        {
          message:
            error?.message,

          stack:
            error?.stack,

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
 * CURRENT USER
 * =========================================================
 *
 * GET /api/auth/me
 *
 * C'EST CETTE ROUTE QUE LE DASHBOARD UTILISE
 * POUR SAVOIR SI LA SESSION EXISTE.
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
      console.log(
        '[AUTH /me] Vérification session.',
      );

      const token =
        getRequestToken(req);

      console.log(
        '[AUTH /me] Cookie jwt_token:',
        token
          ? 'PRÉSENT'
          : 'ABSENT',
      );

      if (!token) {
        console.warn(
          '[AUTH /me] Aucune session.',
        );

        return res
          .status(401)
          .json({
            success:
              false,

            authenticated:
              false,

            error:
              'Utilisateur non connecté.',
          });
      }

      const payload =
        verifyJwt(token);

      if (!payload) {
        console.warn(
          '[AUTH /me] JWT invalide ou expiré.',
        );

        /*
         * Nettoyage du cookie invalide.
         */

        res.clearCookie(
          SESSION_COOKIE,
          {
            ...getSessionCookieOptions(),
            maxAge:
              undefined,
          },
        );

        return res
          .status(401)
          .json({
            success:
              false,

            authenticated:
              false,

            error:
              'Session invalide ou expirée.',
          });
      }

      console.log(
        '[AUTH /me] JWT valide.',
        {
          discordId:
            payload.discordId,

          username:
            payload.username,

          owner:
            payload.isOwner,
        },
      );

      let user =
        await User.findOne({
          discordId:
            payload.discordId,
        }).lean();

      /*
       * Session JWT valide mais compte MongoDB absent :
       * on répare automatiquement le compte minimal depuis
       * les informations non sensibles déjà présentes dans le JWT.
       * Cela évite le 404/401 en cascade sur Dashboard et AI DEV
       * après une restauration ou un nettoyage de base.
       */
      if (!user) {
        const owner = isOwner(String(payload.discordId));
        const repaired = await User.findOneAndUpdate(
          { discordId: String(payload.discordId) },
          {
            $setOnInsert: {
              discordId: String(payload.discordId),
              username: String(payload.username || 'Utilisateur Discord'),
              globalName: String(payload.username || 'Utilisateur Discord'),
              avatar: null,
              guilds: [],
              isPremium: false,
              isAdmin: owner,
              role: owner ? 'owner' : 'user',
              permissions: [],
            },
            $set: { lastLogin: new Date() },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ).lean();
        user = repaired;
        console.warn('[AUTH /me] Compte MongoDB réparé automatiquement.', { discordId: payload.discordId });
      }

      if ((user as any).isBlacklisted === true) {
        res.clearCookie(SESSION_COOKIE, { ...getSessionCookieOptions(), maxAge: undefined });
        return res.status(403).json({ success: false, authenticated: false, error: 'Compte OMNIX suspendu.', code: 'ACCOUNT_BLACKLISTED' });
      }

      /*
       * -----------------------------------------------------
       * OWNER RECALCULÉ
       * -----------------------------------------------------
       *
       * On ne fait pas confiance uniquement
       * à la valeur du JWT.
       *
       * OWNER_IDS reste la source actuelle.
       *
       * -----------------------------------------------------
       */

      const owner =
        isOwner(
          String(
            (user as any).discordId,
          ),
        );

      const guilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds.map(
              (guild: any) => ({
                id:
                  String(
                    guild?.id || '',
                  ),

                name:
                  String(
                    guild?.name || '',
                  ),

                icon:
                  discordGuildIconUrl(
                    String(
                      guild?.id || '',
                    ),
                    guild?.icon,
                  ),

                owner:
                  Boolean(
                    guild?.owner,
                  ),

                permissions:
                  String(
                    guild?.permissions ||
                    '0',
                  ),
              }),
            )
          : [];

      const responseUser = {
        discordId:
          String(
            (user as any).discordId,
          ),

        username:
          String(
            (user as any).username ||
            payload.username ||
            '',
          ),

        email:
          (user as any).email || null,

        emailVerified:
          Boolean((user as any).emailVerified),

        globalName:
          String(
            (user as any).globalName ||
            (user as any).username ||
            payload.username ||
            '',
          ),

        avatar:
          discordAvatarUrl(
            String(
              (user as any).discordId,
            ),
            (user as any).avatar,
          ),

        isAdmin:
          owner ||
          Boolean(
            (user as any).isAdmin,
          ),

        isOwner:
          owner,

        isPremium:
          Boolean((user as any).isPremium) || Boolean(await License.exists({ buyerId: String((user as any).discordId), status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })),

        plan:
          (Boolean((user as any).isPremium) || Boolean(await License.exists({ buyerId: String((user as any).discordId), status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }))) ? 'premium' : 'free',

        role:
          owner ? 'owner' : String((user as any).role || ((user as any).isAdmin ? 'admin' : 'user')),

        permissions:
          Array.isArray((user as any).permissions) ? (user as any).permissions : [],

        guilds,
      };

      console.log(
        '[AUTH /me] Session active.',
        {
          discordId:
            responseUser.discordId,

          username:
            responseUser.username,

          owner:
            responseUser.isOwner,

          premium:
            responseUser.isPremium,

          guilds:
            responseUser.guilds.length,
        },
      );

      return res.json({
        success:
          true,

        authenticated:
          true,

        user:
          responseUser,
      });
    } catch (error) {
      console.error(
        '[AUTH /me] Erreur interne:',
        error,
      );

      return res
        .status(500)
        .json({
          success:
            false,

          authenticated:
            false,

          error:
            'Erreur lors de la vérification de la session.',
        });
    }
  },
);

/*
 * =========================================================
 * CURRENT USER GUILDS
 * =========================================================
 *
 * GET /api/auth/guilds
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
      const payload =
        getAuthenticatedPayload(req);

      if (!payload) {
        return res
          .status(401)
          .json({
            success:
              false,

            authenticated:
              false,

            error:
              'Session inexistante ou invalide.',
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

      const guilds =
        Array.isArray(
          (user as any).guilds,
        )
          ? (user as any).guilds.map(
              (guild: any) => ({
                id:
                  String(
                    guild?.id || '',
                  ),

                name:
                  String(
                    guild?.name || '',
                  ),

                icon:
                  discordGuildIconUrl(
                    String(
                      guild?.id || '',
                    ),
                    guild?.icon,
                  ),

                owner:
                  Boolean(
                    guild?.owner,
                  ),

                permissions:
                  String(
                    guild?.permissions ||
                    '0',
                  ),
              }),
            )
          : [];

      return res.json({
        success:
          true,

        guilds,
      });
    } catch (error) {
      console.error(
        '[AUTH /guilds]',
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
 * SESSION DEBUG
 * =========================================================
 *
 * GET /api/auth/session
 *
 * Route de diagnostic.
 *
 * Elle ne retourne JAMAIS le JWT.
 *
 * Très utile pour Render/Eternodes.
 *
 * =========================================================
 */

router.get(
  '/session',
  (
    req: Request,
    res: Response,
  ) => {
    try {
      const token =
        getRequestToken(req);

      if (!token) {
        console.log(
          '[AUTH /session] Cookie absent.',
        );

        return res.json({
          success:
            true,

          authenticated:
            false,

          cookie:
            false,
        });
      }

      const payload =
        verifyJwt(token);

      if (!payload) {
        console.warn(
          '[AUTH /session] Cookie présent mais JWT invalide.',
        );

        return res.json({
          success:
            true,

          authenticated:
            false,

          cookie:
            true,

          valid:
            false,
        });
      }

      return res.json({
        success:
          true,

        authenticated:
          true,

        cookie:
          true,

        valid:
          true,

        user: {
          discordId:
            payload.discordId,

          username:
            payload.username,

          isOwner:
            payload.isOwner,

          isAdmin:
            payload.isAdmin,

          isPremium:
            payload.isPremium,
        },
      });
    } catch (error) {
      console.error(
        '[AUTH /session]',
        error,
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            'Impossible de diagnostiquer la session.',
        });
    }
  },
);

/*
 * =========================================================
 * LOGOUT
 * =========================================================
 *
 * GET /api/auth/logout
 *
 * =========================================================
 */

router.get(
  '/logout',
  (
    _req: Request,
    res: Response,
  ) => {
    try {
      const cookieOptions =
        getSessionCookieOptions();

      res.clearCookie(
        SESSION_COOKIE,
        {
          httpOnly:
            cookieOptions.httpOnly,

          secure:
            cookieOptions.secure,

          sameSite:
            cookieOptions.sameSite,

          path:
            cookieOptions.path,
        },
      );

      console.log(
        '[AUTH] Déconnexion OMNIX.',
      );

      return res.redirect(
        '/',
      );
    } catch (error) {
      console.error(
        '[AUTH /logout]',
        error,
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            'Impossible de fermer la session.',
        });
    }
  },
);

/*
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;