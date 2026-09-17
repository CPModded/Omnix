import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  getRequestToken,
  verifyJwt,
  type OmnixJwtPayload,
} from '../routes/auth.routes';

/*
 * =========================================================
 * OMNIX — AUTHENTICATION MIDDLEWARE
 * =========================================================
 *
 * SESSION UNIQUE :
 *
 *     jwt_token
 *
 * Priorité :
 *
 *     1. Authorization: Bearer <token>
 *     2. Cookie httpOnly jwt_token
 *
 * Aucun localStorage.
 * Aucun ?token=...
 *
 * =========================================================
 */

export interface AuthenticatedRequest
  extends Request {
  user?: OmnixJwtPayload;
}

/*
 * =========================================================
 * API AUTHENTICATION
 * =========================================================
 *
 * Utilisé pour :
 *
 *     /api/ai-dev/*
 *     autres API protégées
 *
 * Réponse :
 *
 *     401 JSON
 *
 * et NON une redirection HTML.
 *
 * =========================================================
 */

export async function isAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /*
     * -------------------------------------------------------
     * Récupération de la session
     * -------------------------------------------------------
     */

    const token =
      getRequestToken(req);

    if (!token) {
      console.warn(
        `[Auth API] Session absente : ${req.method} ${req.originalUrl}`,
      );

      res
        .status(401)
        .json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',
        });

      return;
    }

    /*
     * -------------------------------------------------------
     * Vérification JWT
     * -------------------------------------------------------
     */

    const payload =
      verifyJwt(token);

    if (!payload) {
      console.warn(
        `[Auth API] Session invalide : ${req.method} ${req.originalUrl}`,
      );

      /*
       * Le JWT est invalide ou expiré.
       *
       * On supprime le cookie afin d'éviter
       * que le navigateur continue à envoyer
       * une ancienne session.
       */

      res.clearCookie(
        'jwt_token',
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

      res
        .status(401)
        .json({
          success:
            false,

          error:
            'Session invalide ou expirée.',

          code:
            'AUTH_INVALID',
        });

      return;
    }

    /*
     * -------------------------------------------------------
     * Utilisateur authentifié
     * -------------------------------------------------------
     */

    const { User } = await import('../../models/User');
    const dbUser = await User.findOne({ discordId: payload.discordId }).select('isBlacklisted').lean();
    if (dbUser?.isBlacklisted) {
      res.clearCookie('jwt_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true', sameSite: 'lax', path: '/' });
      return res.status(403).json({ success: false, error: 'Compte OMNIX suspendu.', code: 'ACCOUNT_BLACKLISTED' });
    }

    req.user = payload;

    /*
     * -------------------------------------------------------
     * Log léger
     * -------------------------------------------------------
     */

    console.log(
      `[Auth API] ✓ ${payload.discordId} → ${req.method} ${req.originalUrl}`,
    );

    next();
  } catch (error) {
    console.error(
      '[Auth API] Erreur middleware :',
      error,
    );

    res
      .status(401)
      .json({
        success:
          false,

        error:
          'Impossible de vérifier la session.',

        code:
          'AUTH_ERROR',
      });
  }
}

/*
 * =========================================================
 * WEB AUTHENTICATION
 * =========================================================
 *
 * Utilisé uniquement pour les pages HTML.
 *
 * Exemple :
 *
 *     /dashboard
 *     /dashboard/:guildId
 *     /ai-dev
 *     /admin
 *     /mon-espace
 *
 * Si l'utilisateur n'est pas connecté :
 *
 *     → Discord OAuth
 *
 * Si le JWT est invalide :
 *
 *     → suppression du cookie
 *     → Discord OAuth
 *
 * IMPORTANT :
 *
 * On ne retourne JAMAIS du JSON pour une page HTML.
 *
 * =========================================================
 */

export function requireWebAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    /*
     * -------------------------------------------------------
     * Récupération session
     * -------------------------------------------------------
     */

    const token =
      getRequestToken(req);

    if (!token) {
      console.warn(
        `[Auth WEB] Session absente : ${req.method} ${req.originalUrl}`,
      );

      res.redirect(
        '/api/auth/login',
      );

      return;
    }

    /*
     * -------------------------------------------------------
     * Vérification JWT
     * -------------------------------------------------------
     */

    const payload =
      verifyJwt(token);

    if (!payload) {
      console.warn(
        `[Auth WEB] Session invalide : ${req.method} ${req.originalUrl}`,
      );

      res.clearCookie(
        'jwt_token',
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

      res.redirect(
        '/api/auth/login',
      );

      return;
    }

    /*
     * -------------------------------------------------------
     * Utilisateur authentifié
     * -------------------------------------------------------
     */

    req.user =
      payload;

    console.log(
      `[Auth WEB] ✓ ${payload.discordId} → ${req.method} ${req.originalUrl}`,
    );

    next();
  } catch (error) {
    console.error(
      '[Auth WEB] Erreur middleware :',
      error,
    );

    res.clearCookie(
      'jwt_token',
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

    res.redirect(
      '/api/auth/login',
    );
  }
}

/*
 * =========================================================
 * OPTIONAL AUTHENTICATION
 * =========================================================
 *
 * Utile pour les pages qui peuvent fonctionner
 * connectées OU non connectées.
 *
 * Exemple :
 *
 *     /
 *     /pricing
 *     /premium
 *
 * Si une session existe :
 *
 *     req.user = payload
 *
 * Sinon :
 *
 *     req.user reste undefined
 *
 * Aucune redirection.
 *
 * =========================================================
 */

export function optionalAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    const token =
      getRequestToken(req);

    if (!token) {
      next();
      return;
    }

    const payload =
      verifyJwt(token);

    if (!payload) {
      /*
       * Session invalide :
       * on la nettoie mais on ne bloque pas
       * la page publique.
       */

      res.clearCookie(
        'jwt_token',
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

      next();
      return;
    }

    req.user =
      payload;

    next();
  } catch (error) {
    console.error(
      '[Auth OPTIONAL] Erreur :',
      error,
    );

    next();
  }
}

/*
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 *
 * Compatibilité avec :
 *
 * import isAuthenticated from ...
 *
 * =========================================================
 */

export default isAuthenticated;