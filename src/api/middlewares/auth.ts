import type {
  Request,
  Response,
  NextFunction,
} from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config/index.ts';
/* =========================================================
   TYPES
========================================================= */
export interface AuthenticatedRequest
  extends Request {
  user?: any;
  token?: string;
}
/* =========================================================
   JWT SECRET
========================================================= */
function getJwtSecret(): string {
  const secret =
    CONFIG.JWT_SECRET ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[Auth] JWT_SECRET / CONFIG.JWT_SECRET est manquant.'
    );
  }
  return secret;
}
/* =========================================================
   TOKEN EXTRACTION
========================================================= */
function extractToken(
  req: Request
): string | null {
  /*
   * Authorization: Bearer <token>
   */
  const authorization =
    req.headers.authorization;
  if (
    authorization &&
    authorization.startsWith('Bearer ')
  ) {
    return authorization
      .slice(7)
      .trim();
  }
  /*
   * Cookie éventuel.
   *
   * Cela permet à OMNIX de fonctionner aussi
   * avec une authentification par cookie.
   */
  const cookies =
    (req as Request & {
      cookies?: Record<string, string>;
    }).cookies;
  if (cookies) {
    const cookieToken =
      cookies.omnix_token ||
      cookies.token ||
      cookies.access_token;
    if (cookieToken) {
      return cookieToken;
    }
  }
  /*
   * Query token.
   *
   * Utile notamment pour certains retours OAuth.
   */
  const queryToken =
    req.query?.token;
  if (
    typeof queryToken === 'string' &&
    queryToken.trim()
  ) {
    return queryToken.trim();
  }
  return null;
}
/* =========================================================
   VERIFY JWT
========================================================= */
export function verifyToken(
  token: string
): any | null {
  try {
    return jwt.verify(
      token,
      getJwtSecret()
    );
  } catch {
    return null;
  }
}
/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */
export function isAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token =
      extractToken(req);
    /*
     * Aucun token.
     */
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentification requise.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    /*
     * Vérification JWT.
     */
    const payload =
      verifyToken(token);
    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée.',
        code: 'INVALID_TOKEN',
      });
      return;
    }
    /*
     * Stockage du token et de l'utilisateur
     * dans la requête.
     */
    req.token =
      token;
    req.user =
      payload;
    next();
  } catch (error) {
    console.error(
      '[Auth] Erreur middleware :',
      error
    );
    res.status(401).json({
      success: false,
      error: 'Authentification invalide.',
      code: 'AUTH_ERROR',
    });
  }
}
/* =========================================================
   OPTIONAL AUTHENTICATION
========================================================= */
/**
 * Même fonctionnement que isAuthenticated,
 * mais ne bloque pas la requête si aucun token
 * n'est présent.
 *
 * Utile pour les pages publiques pouvant afficher
 * des informations différentes selon la connexion.
 */
export function optionalAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token =
      extractToken(req);
    if (!token) {
      next();
      return;
    }
    const payload =
      verifyToken(token);
    if (payload) {
      req.token =
        token;
      req.user =
        payload;
    }
    next();
  } catch (error) {
    console.warn(
      '[Auth] Authentification optionnelle échouée :',
      error
    );
    next();
  }
}
/* =========================================================
   REQUIRE USER
========================================================= */
/**
 * Vérifie qu'un utilisateur authentifié existe
 * réellement dans la requête.
 */
export function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Utilisateur non authentifié.',
      code: 'USER_REQUIRED',
    });
    return;
  }
  next();
}
/* =========================================================
   EXPORT DEFAULT
========================================================= */
export default {
  isAuthenticated,
  optionalAuthentication,
  requireUser,
  verifyToken,
};