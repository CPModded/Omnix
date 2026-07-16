/**
 * ====================================================================
 * MIDDLEWARE D'AUTHENTIFICATION JWT (TRAÇAGE CONSOLE)
 * ====================================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config';

export interface AuthenticatedRequest extends Request {
  user?: {
    discordId: string;
    username: string;
    isAdmin: boolean;
    isPremium: boolean;
    discordAccessToken: string;
  };
}

export function isAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const origin = req.headers.origin || req.headers.referer || 'Inconnu';

  console.log(`[API Auth] 🔑 Tentative d'accès à une route sécurisée par l'origine : ${origin}`);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[API Auth] ⚠️ Échec : En-tête d'autorisation ou jeton 'Bearer' manquant.`);
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthenticatedRequest['user'];
    req.user = decoded;
    
    console.log(`[API Auth] ✅ Session JWT validée pour : ${decoded.username} (${decoded.discordId})`);
    next();
  } catch (error: any) {
    console.error(`[API Auth] ❌ Échec de décodage du JWT : ${error.message}`);
    return res.status(403).json({ error: 'Session invalide ou expirée.' });
  }
}