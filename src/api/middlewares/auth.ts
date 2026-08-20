import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import jwt from 'jsonwebtoken';


/* =========================================================
   TYPES
========================================================= */

export interface AuthenticatedUser {
  id: string;

  username?: string;

  globalName?: string | null;

  avatar?: string | null;

  discriminator?: string;

  owner?: boolean;

  guilds?: unknown[];

  [key: string]: unknown;
}


export interface AuthenticatedRequest
  extends Request {

  user?: AuthenticatedUser;

}


/* =========================================================
   CONFIG
========================================================= */

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.DISCORD_JWT_SECRET ||
  'omnix-development-secret';


const COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ||
  'omnix_auth';


/* =========================================================
   JWT PAYLOAD
========================================================= */

interface JWTPayload {
  id?: string;

  userId?: string;

  username?: string;

  globalName?: string | null;

  avatar?: string | null;

  discriminator?: string;

  owner?: boolean;

  guilds?: unknown[];

  iat?: number;

  exp?: number;

  [key: string]: unknown;
}


/* =========================================================
   TOKEN EXTRACTION
========================================================= */

function getToken(
  req: Request
): string | null {

  /*
   * 1. Cookie principal
   */

  const cookies =
    (req as any).cookies;

  if (
    cookies &&
    typeof cookies[COOKIE_NAME] === 'string' &&
    cookies[COOKIE_NAME].trim()
  ) {

    return cookies[COOKIE_NAME].trim();

  }


  /*
   * 2. Compatibilité avec anciens cookies
   */

  const legacyCookies = [
    'token',
    'jwt',
    'auth_token',
    'access_token',
    'omnix_token',
  ];

  for (
    const name of legacyCookies
  ) {

    if (
      cookies &&
      typeof cookies[name] === 'string' &&
      cookies[name].trim()
    ) {

      return cookies[name].trim();

    }

  }


  /*
   * 3. Authorization: Bearer
   */

  const authorization =
    req.headers.authorization;

  if (
    authorization &&
    authorization
      .toLowerCase()
      .startsWith('bearer ')
  ) {

    const token =
      authorization
        .slice(7)
        .trim();

    if (token) {
      return token;
    }

  }


  return null;
}


/* =========================================================
   VERIFY TOKEN
========================================================= */

export function verifyAuthToken(
  token: string
): AuthenticatedUser | null {

  try {

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      ) as JWTPayload;


    /*
     * Discord ID.
     *
     * On accepte id ou userId
     * pour rester compatible avec
     * les anciens tokens OMNIX.
     */

    const id =
      String(
        decoded.id ??
        decoded.userId ??
        ''
      ).trim();


    if (!id) {

      return null;

    }


    return {
      ...decoded,

      id,

      username:
        typeof decoded.username === 'string'
          ? decoded.username
          : undefined,

      globalName:
        decoded.globalName ?? null,

      avatar:
        decoded.avatar ?? null,

      discriminator:
        typeof decoded.discriminator === 'string'
          ? decoded.discriminator
          : undefined,

      owner:
        Boolean(decoded.owner),

      guilds:
        Array.isArray(decoded.guilds)
          ? decoded.guilds
          : [],
    };

  } catch (error) {

    /*
     * Token expiré / invalide.
     */

    return null;

  }

}


/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
): void {

  const authenticatedRequest =
    req as AuthenticatedRequest;


  /*
   * Cherche le JWT.
   */

  const token =
    getToken(req);


  /*
   * Aucun token.
   */

  if (!token) {

    console.warn(
      `[Auth] Token absent : ${req.method} ${req.originalUrl}`
    );


    /*
     * API
     */

    if (
      req.originalUrl.startsWith('/api/')
    ) {

      res.status(401).json({
        success: false,

        error:
          'Authentification requise.',

        code:
          'AUTH_REQUIRED',
      });

      return;

    }


    /*
     * Page Web
     *
     * On renvoie vers OAuth.
     */

    res.redirect(
      '/api/auth/discord'
    );

    return;

  }


  /*
   * Vérification JWT.
   */

  const user =
    verifyAuthToken(token);


  /*
   * JWT invalide.
   */

  if (!user) {

    console.warn(
      `[Auth] Token invalide : ${req.method} ${req.originalUrl}`
    );


    /*
     * Nettoyage du cookie.
     */

    clearAuthCookie(
      res
    );


    /*
     * API
     */

    if (
      req.originalUrl.startsWith('/api/')
    ) {

      res.status(401).json({
        success: false,

        error:
          'Session invalide ou expirée.',

        code:
          'AUTH_INVALID',
      });

      return;

    }


    /*
     * Web
     */

    res.redirect(
      '/api/auth/discord'
    );

    return;

  }


  /*
   * Utilisateur authentifié.
   */

  authenticatedRequest.user =
    user;


  next();

}


/* =========================================================
   OPTIONAL AUTHENTICATION
========================================================= */

export function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
): void {

  const token =
    getToken(req);

  if (token) {

    const user =
      verifyAuthToken(token);

    if (user) {

      (
        req as AuthenticatedRequest
      ).user = user;

    }

  }

  next();

}


/* =========================================================
   SET AUTH COOKIE
========================================================= */

export function setAuthCookie(
  res: Response,
  token: string
): void {

  /*
   * Render fonctionne en HTTPS.
   *
   * secure=true en production.
   */

  const isProduction =
    process.env.NODE_ENV ===
    'production';


  res.cookie(
    COOKIE_NAME,
    token,
    {
      httpOnly: true,

      secure:
        isProduction,

      sameSite:
        isProduction
          ? 'lax'
          : 'lax',

      path: '/',

      maxAge:
        7 * 24 * 60 * 60 * 1000,
    }
  );

}


/* =========================================================
   CLEAR AUTH COOKIE
========================================================= */

export function clearAuthCookie(
  res: Response
): void {

  const isProduction =
    process.env.NODE_ENV ===
    'production';


  res.clearCookie(
    COOKIE_NAME,
    {
      httpOnly: true,

      secure:
        isProduction,

      sameSite:
        isProduction
          ? 'lax'
          : 'lax',

      path: '/',
    }
  );


  /*
   * Nettoyage des anciens cookies
   * éventuellement utilisés par une
   * ancienne version d'OMNIX.
   */

  const legacyCookies = [
    'token',
    'jwt',
    'auth_token',
    'access_token',
    'omnix_token',
  ];


  for (
    const name of legacyCookies
  ) {

    res.clearCookie(
      name,
      {
        httpOnly: true,

        secure:
          isProduction,

        sameSite:
          isProduction
            ? 'lax'
            : 'lax',

        path: '/',
      }
    );

  }

}


/* =========================================================
   GET CURRENT USER
========================================================= */

export function getAuthenticatedUser(
  req: Request
): AuthenticatedUser | null {

  return (
    (req as AuthenticatedRequest).user ??
    null
  );

}


/* =========================================================
   LOGOUT
========================================================= */

export function logout(
  req: Request,
  res: Response
): void {

  clearAuthCookie(
    res
  );


  /*
   * API
   */

  if (
    req.originalUrl.startsWith('/api/')
  ) {

    res.json({
      success: true,
      message:
        'Déconnexion réussie.',
    });

    return;

  }


  /*
   * Web
   */

  res.redirect(
    '/'
  );

}


/* =========================================================
   EXPORTS
========================================================= */

export {
  COOKIE_NAME,
  JWT_SECRET,
  getToken,
};