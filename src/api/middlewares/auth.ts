import type {
  NextFunction,
  Request,
  Response,
} from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config/index.ts';
import { User } from '../../models/User.ts';
/* =========================================================
   TYPES
========================================================= */
export interface AuthenticatedRequest
  extends Request {
  user?: OmnixJwtPayload;
}
/* =========================================================
   JWT PAYLOAD
========================================================= */
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
/* =========================================================
   SESSION COOKIE
========================================================= */
export const SESSION_COOKIE =
  'jwt_token';
const SESSION_MAX_AGE =
  7 * 24 * 60 * 60 * 1000;
/* =========================================================
   OWNER IDS
========================================================= */
export function getOwnerIds(): string[] {
  const configured =
    (CONFIG as any)?.OWNER_IDS;
  if (Array.isArray(configured)) {
    return configured
      .map((id) => String(id).trim())
      .filter(Boolean);
  }
  return String(
    process.env.OWNER_IDS || '',
  )
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
/* =========================================================
   OWNER CHECK
========================================================= */
export function isOwner(
  discordId: string,
): boolean {
  return getOwnerIds().includes(
    String(discordId).trim(),
  );
}
/* =========================================================
   COOKIE OPTIONS
========================================================= */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      'production',
    sameSite:
      'lax' as const,
    maxAge:
      SESSION_MAX_AGE,
    path: '/',
  };
}
/* =========================================================
   BEARER TOKEN
========================================================= */
export function extractBearerToken(
  req: Request,
): string | null {
  const authorization =
    req.headers.authorization;
  if (
    !authorization ||
    !authorization
      .toLowerCase()
      .startsWith('bearer ')
  ) {
    return null;
  }
  const token =
    authorization
      .slice(7)
      .trim();
  return token || null;
}
/* =========================================================
   REQUEST TOKEN
========================================================= */
export function getRequestToken(
  req: Request,
): string | null {
  /*
   * 1. Authorization header
   */
  const bearer =
    extractBearerToken(req);
  if (bearer) {
    return bearer;
  }
  /*
   * 2. JWT cookie
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
/* =========================================================
   VERIFY JWT
========================================================= */
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
/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */
/**
 * Vérifie que l'utilisateur possède
 * une session OMNIX valide.
 *
 * Compatible avec :
 *
 * - cookie jwt_token
 * - Authorization Bearer
 *
 * Puis ajoute :
 *
 * req.user
 */
export async function isAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token =
      getRequestToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error:
          'Authentification requise.',
        code:
          'AUTH_REQUIRED',
      });
      return;
    }
    const payload =
      verifyJwt(token);
    if (!payload) {
      /*
       * JWT invalide ou expiré.
       */
      res
        .clearCookie(
          SESSION_COOKIE,
          getSessionCookieOptions(),
        );
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
     * Vérification MongoDB.
     *
     * Cela évite qu'un ancien JWT continue
     * à fonctionner si l'utilisateur n'existe
     * plus dans OMNIX.
     */
    const user =
      await User.findOne({
        discordId:
          payload.discordId,
      }).lean();
    if (!user) {
      res
        .clearCookie(
          SESSION_COOKIE,
          getSessionCookieOptions(),
        );
      res.status(401).json({
        success: false,
        error:
          'Utilisateur OMNIX introuvable.',
        code:
          'USER_NOT_FOUND',
      });
      return;
    }
    /*
     * Owner recalculé depuis la configuration.
     */
    const owner =
      isOwner(
        payload.discordId,
      );
    /*
     * On reconstruit req.user
     * avec les informations actuelles.
     */
    req.user = {
      discordId:
        String(
          (user as any)
            .discordId ||
          payload.discordId,
        ),
      username:
        String(
          (user as any)
            .username ||
          payload.username ||
          '',
        ),
      avatar:
        (user as any)
          .avatar ||
        payload.avatar ||
        null,
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
      iat:
        payload.iat,
      exp:
        payload.exp,
    };
    next();
  } catch (error) {
    console.error(
      '[Auth] Middleware error:',
      error,
    );
    res.status(500).json({
      success: false,
      error:
        'Erreur interne d’authentification.',
      code:
        'AUTH_INTERNAL_ERROR',
    });
  }
}
/* =========================================================
   OPTIONAL AUTHENTICATION
========================================================= */
/**
 * Auth facultative.
 *
 * Utile pour les pages publiques qui veulent
 * savoir si l'utilisateur est connecté sans
 * bloquer les visiteurs.
 */
export async function optionalAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
      next();
      return;
    }
    req.user =
      payload;
    next();
  } catch {
    next();
  }
}
/* =========================================================
   REQUIRE OWNER
========================================================= */
export async function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  /*
   * On passe d'abord par l'authentification.
   */
  const token =
    getRequestToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error:
        'Authentification requise.',
      code:
        'AUTH_REQUIRED',
    });
    return;
  }
  const payload =
    verifyJwt(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error:
        'Session invalide ou expirée.',
      code:
        'AUTH_INVALID',
    });
    return;
  }
  const owner =
    isOwner(
      payload.discordId,
    );
  if (!owner) {
    res.status(403).json({
      success: false,
      error:
        'Accès réservé au propriétaire d’OMNIX.',
      code:
        'OWNER_REQUIRED',
    });
    return;
  }
  req.user = {
    ...payload,
    isOwner: true,
    isAdmin: true,
  };
  next();
}