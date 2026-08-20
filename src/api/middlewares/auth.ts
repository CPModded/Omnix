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
  global_name?: string;
  avatar?: string;
  avatarURL?: string;
  email?: string;
  owner?: boolean;
  premium?: boolean;
  plan?: string;
  [key: string]: unknown;
}


export interface AuthenticatedRequest
  extends Request {

  user?: AuthenticatedUser;

}


/* =========================================================
   JWT SECRET
========================================================= */

function getJwtSecret(): string {

  const secret =
    process.env.JWT_SECRET;

  if (
    !secret ||
    secret.trim().length < 16
  ) {

    throw new Error(
      '[AUTH] JWT_SECRET est absent ou trop court.'
    );

  }

  return secret;

}


/* =========================================================
   GET TOKEN
========================================================= */

function getToken(
  req: Request
): string | null {

  /*
   * 1. Cookie HTTP-only
   */

  const cookieToken =
    (req as Request & {
      cookies?: Record<string, string>;
    }).cookies?.omnix_token;

  if (cookieToken) {
    return cookieToken;
  }


  /*
   * 2. Authorization Bearer
   */

  const authorization =
    req.headers.authorization;

  if (
    authorization &&
    authorization.startsWith(
      'Bearer '
    )
  ) {

    const token =
      authorization.slice(
        7
      ).trim();

    if (token) {
      return token;
    }

  }


  /*
   * 3. Query token
   *
   * Utilisé uniquement pour permettre
   * au callback OAuth de transmettre
   * temporairement le token.
   */

  const queryToken =
    typeof req.query.token ===
    'string'
      ? req.query.token
      : null;

  if (queryToken) {
    return queryToken;
  }


  return null;

}


/* =========================================================
   VERIFY TOKEN
========================================================= */

export function verifyToken(
  token: string
): AuthenticatedUser | null {

  try {

    const decoded =
      jwt.verify(
        token,
        getJwtSecret()
      );

    if (
      typeof decoded !==
      'object' ||
      decoded === null
    ) {

      return null;

    }

    const payload =
      decoded as Record<
        string,
        unknown
      >;

    const id =
      payload.id ??
      payload.userId ??
      payload.sub;

    if (!id) {
      return null;
    }

    return {
      ...payload,
      id: String(id),
    } as AuthenticatedUser;

  } catch (error) {

    console.warn(
      '[AUTH] JWT invalide ou expiré.'
    );

    return null;

  }

}


/* =========================================================
   AUTHENTICATED MIDDLEWARE
========================================================= */

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {

  try {

    const token =
      getToken(req);

    if (!token) {

      return res.status(
        401
      ).json({
        success: false,
        error: 'Authentification requise.',
        code: 'AUTH_REQUIRED',
      });

    }

    const user =
      verifyToken(token);

    if (!user) {

      return res.status(
        401
      ).json({
        success: false,
        error: 'Session expirée.',
        code: 'SESSION_EXPIRED',
      });

    }

    (
      req as AuthenticatedRequest
    ).user =
      user;

    return next();

  } catch (error) {

    console.error(
      '[AUTH] Erreur middleware :',
      error
    );

    return res.status(
      401
    ).json({
      success: false,
      error: 'Session invalide.',
      code: 'INVALID_SESSION',
    });

  }

}


/* =========================================================
   OPTIONAL AUTH
========================================================= */

export function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
) {

  try {

    const token =
      getToken(req);

    if (!token) {
      return next();
    }

    const user =
      verifyToken(token);

    if (user) {

      (
        req as AuthenticatedRequest
      ).user =
        user;

    }

    return next();

  } catch {

    return next();

  }

}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default isAuthenticated;