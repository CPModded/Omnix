import express, {
  type Request,
  type Response,
} from 'express';

import axios from 'axios';
import jwt from 'jsonwebtoken';

import { User } from '../../models/User.ts';
import { CONFIG } from '../../config/index.ts';

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_OAUTH_API = 'https://discord.com/api/oauth2/token';

const COOKIE_NAME = 'jwt_token';
const JWT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;


/* =========================================================
   TYPES
========================================================= */

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


/* =========================================================
   OWNER
========================================================= */

function getOwnerIds(): string[] {
  const configured = CONFIG.OWNER_IDS;

  if (Array.isArray(configured)) {
    return configured
      .map(String)
      .map(id => id.trim())
      .filter(Boolean);
  }

  return (process.env.OWNER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}


function isOwner(discordId: string): boolean {
  return getOwnerIds().includes(String(discordId));
}


/* =========================================================
   JWT
========================================================= */

function createJwt(
  user: DiscordUser,
  premium = false
): string {

  const owner = isOwner(user.id);

  return jwt.sign(
    {
      discordId: user.id,

      username:
        user.global_name ||
        user.username,

      avatar:
        user.avatar || null,

      isAdmin: owner,

      isOwner: owner,

      isPremium: premium,
    },

    CONFIG.JWT_SECRET,

    {
      expiresIn: '7d',
    }
  );
}


function verifyJwt(token: string): any | null {
  try {
    return jwt.verify(
      token,
      CONFIG.JWT_SECRET
    );
  } catch {
    return null;
  }
}


/* =========================================================
   TOKEN EXTRACTION
========================================================= */

function extractToken(
  req: Request
): string | null {

  /*
   * 1. Authorization Bearer
   */

  const authorization =
    req.headers.authorization;

  if (
    authorization &&
    authorization.startsWith('Bearer ')
  ) {
    const token =
      authorization
        .substring(7)
        .trim();

    if (token) {
      return token;
    }
  }


  /*
   * 2. Cookie principal
   */

  const cookieToken =
    req.cookies?.[COOKIE_NAME];

  if (cookieToken) {
    return cookieToken;
  }


  /*
   * 3. Ancien cookie éventuel
   *
   * Permet de récupérer les anciennes sessions.
   */

  const legacyToken =
    req.cookies?.omnix_token;

  if (legacyToken) {
    return legacyToken;
  }


  return null;
}


/* =========================================================
   COOKIE
========================================================= */

function setAuthCookie(
  res: Response,
  token: string
): void {

  res.cookie(
    COOKIE_NAME,
    token,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === 'production',

      sameSite: 'lax',

      maxAge:
        JWT_MAX_AGE,

      path: '/',
    }
  );
}


/* =========================================================
   1. LOGIN DISCORD
========================================================= */

router.get(
  '/login',
  (
    req: Request,
    res: Response
  ) => {

    const clientId =
      process.env.DISCORD_CLIENT_ID ||
      CONFIG.DISCORD.CLIENT_ID;

    const redirectUri =
      process.env.DISCORD_REDIRECT_URI ||
      CONFIG.DISCORD.REDIRECT_URI;


    if (!clientId) {
      return res.status(500).send(
        '❌ DISCORD_CLIENT_ID est manquant.'
      );
    }


    if (!redirectUri) {
      return res.status(500).send(
        '❌ DISCORD_REDIRECT_URI est manquant.'
      );
    }


    const params =
      new URLSearchParams({
        client_id: clientId,

        redirect_uri: redirectUri,

        response_type: 'code',

        scope: 'identify guilds',
      });


    return res.redirect(
      `https://discord.com/oauth2/authorize?${params.toString()}`
    );
  }
);


/* =========================================================
   2. CALLBACK DISCORD
========================================================= */

router.get(
  '/callback',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const code =
        typeof req.query.code === 'string'
          ? req.query.code
          : null;


      if (!code) {

        return res.status(400).send(
          '❌ Code OAuth Discord manquant.'
        );
      }


      const clientId =
        process.env.DISCORD_CLIENT_ID ||
        CONFIG.DISCORD.CLIENT_ID;

      const clientSecret =
        process.env.DISCORD_CLIENT_SECRET ||
        CONFIG.DISCORD.CLIENT_SECRET;

      const redirectUri =
        process.env.DISCORD_REDIRECT_URI ||
        CONFIG.DISCORD.REDIRECT_URI;


      if (
        !clientId ||
        !clientSecret ||
        !redirectUri
      ) {

        console.error(
          '[OAuth] Configuration Discord incomplète.'
        );

        return res.status(500).send(
          '❌ Configuration OAuth Discord incomplète.'
        );
      }


      /* =====================================================
         CODE → ACCESS TOKEN
      ===================================================== */

      const tokenResponse =
        await axios.post<DiscordTokenResponse>(
          DISCORD_OAUTH_API,

          new URLSearchParams({
            client_id: clientId,

            client_secret: clientSecret,

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
          }
        );


      const accessToken =
        tokenResponse.data.access_token;


      if (!accessToken) {
        throw new Error(
          'Discord n’a pas retourné d’access_token.'
        );
      }


      /* =====================================================
         PROFIL DISCORD
      ===================================================== */

      const userResponse =
        await axios.get<DiscordUser>(
          `${DISCORD_API}/users/@me`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const discordUser =
        userResponse.data;


      /* =====================================================
         SERVEURS DISCORD
      ===================================================== */

      const guildResponse =
        await axios.get<DiscordGuild[]>(
          `${DISCORD_API}/users/@me/guilds`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const guilds =
        guildResponse.data || [];


      /* =====================================================
         SERVEURS ADMINISTRABLES
      ===================================================== */

      const manageableGuilds =
        guilds.filter(
          guild => {

            if (guild.owner) {
              return true;
            }


            if (guild.permissions) {

              try {

                const permissions =
                  BigInt(
                    guild.permissions
                  );

                return (
                  (permissions & 0x8n) ===
                  0x8n
                );

              } catch {
                return false;
              }
            }


            return false;
          }
        );


      const guildData =
        manageableGuilds.map(
          guild => ({
            id: guild.id,

            name: guild.name,

            icon: guild.icon,

            owner:
              Boolean(guild.owner),

            permissions:
              guild.permissions || '0',
          })
        );


      /* =====================================================
         USER OMNIX
      ===================================================== */

      const owner =
        isOwner(discordUser.id);


      const existingUser =
        await User.findOne({
          discordId:
            discordUser.id,
        });


      const isPremium =
        Boolean(
          existingUser &&
          (
            (existingUser as any).isPremium ||
            (existingUser as any).premium
          )
        );


      /* =====================================================
         MISE À JOUR MONGO
      ===================================================== */

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
          upsert: true,

          new: true,

          setDefaultsOnInsert:
            true,
        }
      );


      /* =====================================================
         JWT
      ===================================================== */

      const token =
        createJwt(
          discordUser,
          isPremium
        );


      /* =====================================================
         COOKIE
      ===================================================== */

      setAuthCookie(
        res,
        token
      );


      /*
       * IMPORTANT :
       *
       * On ne dépend plus uniquement
       * de localStorage.
       *
       * Le cookie HTTP-only contient
       * également la session.
       */


      const dashboardUrl =
        process.env.CLIENT_URL ||
        process.env.DOMAIN ||
        '/dashboard';


      /*
       * Si CLIENT_URL vaut :
       *
       * https://omnix.fr
       *
       * on redirige vers :
       *
       * https://omnix.fr/dashboard
       */

      let destination =
        dashboardUrl;


      if (
        !destination.includes('/dashboard')
      ) {

        destination =
          destination.replace(
            /\/$/,
            ''
          ) +
          '/dashboard';
      }


      /*
       * On garde temporairement ?token
       * pour compatibilité avec ton Dashboard.
       */

      const separator =
        destination.includes('?')
          ? '&'
          : '?';


      return res.redirect(
        `${destination}${separator}token=${encodeURIComponent(token)}`
      );

    } catch (error: any) {

      console.error(
        '[OAuth Discord] Erreur :',
        error?.response?.data ||
        error?.message ||
        error
      );


      return res.status(500).send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Erreur OAuth — OMNIX</title>

<style>
body {
  background:#030712;
  color:white;
  font-family:Arial,sans-serif;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:100vh;
  text-align:center;
}

.box {
  max-width:500px;
  padding:40px;
  background:#0f172a;
  border:1px solid #1e293b;
  border-radius:18px;
}

h1 {
  color:#f87171;
}

a {
  display:inline-block;
  margin-top:20px;
  color:#38bdf8;
  text-decoration:none;
}
</style>
</head>

<body>

<div class="box">

<h1>
Connexion impossible
</h1>

<p>
Une erreur est survenue pendant
la connexion Discord.
</p>

<a href="/">
← Retour à OMNIX
</a>

</div>

</body>
</html>
`);
    }
  }
);


/* =========================================================
   3. GUILDS
========================================================= */

router.get(
  '/guilds',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const token =
        extractToken(req);


      if (!token) {

        return res.status(401).json({
          success: false,

          error:
            'Token d’authentification manquant.',
        });
      }


      const payload =
        verifyJwt(token);


      if (!payload) {

        return res.status(401).json({
          success: false,

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

        return res.status(404).json({
          success: false,

          error:
            'Utilisateur OMNIX introuvable.',
        });
      }


      return res.json(
        Array.isArray(
          (user as any).guilds
        )
          ? (user as any).guilds
          : []
      );

    } catch (error) {

      console.error(
        '[Auth /guilds]',
        error
      );


      return res.status(500).json({
        success: false,

        error:
          'Impossible de récupérer les serveurs.',
      });
    }
  }
);


/* =========================================================
   4. SESSION /ME
========================================================= */

router.get(
  '/me',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const token =
        extractToken(req);


      if (!token) {

        return res.status(401).json({
          success: false,

          error:
            'Utilisateur non connecté.',
        });
      }


      const payload =
        verifyJwt(token);


      if (!payload) {

        return res.status(401).json({
          success: false,

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

        return res.status(404).json({
          success: false,

          error:
            'Utilisateur introuvable.',
        });
      }


      const owner =
        isOwner(
          String(
            (user as any).discordId
          )
        );


      return res.json({

        success: true,

        user: {

          discordId:
            (user as any).discordId,

          username:
            (user as any).username,

          globalName:
            (user as any).globalName,

          avatar:
            (user as any).avatar,

          isAdmin:
            owner ||
            Boolean(
              (user as any).isAdmin
            ),

          isOwner:
            owner,

          isPremium:
            Boolean(
              (user as any).isPremium
            ),

          guilds:
            (user as any).guilds ||
            [],
        },
      });

    } catch (error) {

      console.error(
        '[Auth /me]',
        error
      );


      return res.status(401).json({
        success: false,

        error:
          'Session invalide.',
      });
    }
  }
);


/* =========================================================
   5. LOGOUT
========================================================= */

router.get(
  '/logout',
  (
    req: Request,
    res: Response
  ) => {

    res.clearCookie(
      COOKIE_NAME,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite: 'lax',

        path: '/',
      }
    );


    /*
     * Nettoyage ancien cookie.
     */

    res.clearCookie(
      'omnix_token',
      {
        path: '/',
      }
    );


    return res.redirect('/');
  }
);


/* =========================================================
   EXPORT
========================================================= */

export default router;