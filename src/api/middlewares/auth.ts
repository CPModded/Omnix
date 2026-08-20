import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  getRequestToken,
  verifyJwt,
  type OmnixJwtPayload,
} from '../routes/auth.routes.ts';

export interface AuthenticatedRequest
  extends Request {
  user?: OmnixJwtPayload;
}

/**
 * Vérifie la session OMNIX.
 *
 * Ordre :
 * 1. Authorization Bearer
 * 2. cookie jwt_token
 */
export function isAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token =
    getRequestToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentification requise.',
      code: 'AUTH_REQUIRED',
    });

    return;
  }

  const payload =
    verifyJwt(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Session invalide ou expirée.',
      code: 'AUTH_INVALID',
    });

    return;
  }

  req.user = payload;

  next();
}

/**
 * Version adaptée aux pages web.
 *
 * Si aucune session n'existe :
 * → /login
 *
 * Important :
 * on ne renvoie PAS du JSON sur une page HTML.
 */
export function requireWebAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token =
    getRequestToken(req);

  if (!token) {
    res.redirect('/api/auth/login');
    return;
  }

  const payload =
    verifyJwt(token);

  if (!payload) {
    res.clearCookie('jwt_token', {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        'production',
      sameSite: 'lax',
      path: '/',
    });

    res.redirect('/api/auth/login');
    return;
  }

  req.user = payload;

  next();
}

export default isAuthenticated;