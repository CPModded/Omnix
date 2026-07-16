/**
 * ====================================================================
 * MIDDLEWARE D'AUTHENTIFICATION JWT (SUPPORT DOCKER/COOKIES & HEADERS)
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

// Fonction d'aide pour lire un cookie manuellement (sans nécessiter la dépendance cookie-parser)
function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return value;
  }
  return null;
}

export function isAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = getCookie(req, 'jwt_token');
  const origin = req.headers.origin || req.headers.referer || 'Inconnu';

  console.log(`[API Auth] 🔑 Tentative d'accès à une route sécurisée par l'origine : ${origin}`);

  let token: string | null = null;

  // 1. Extraction depuis l'en-tête (cas classique des requêtes fetch de l'API / Dashboard)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // 2. Extraction depuis les Cookies (cas classique des navigations directes vers /founder, /admin, etc.)
  else if (cookieToken) {
    token = cookieToken;
  }

  const isApiRequest = req.path.startsWith('/api');

  if (!token) {
    console.warn(`[API Auth] ⚠️ Échec : Jeton manquant (ni dans l'en-tête Authorization, ni dans le Cookie jwt_token).`);
    
    if (isApiRequest) {
      return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
    } else {
      // Redirection propre vers l'accueil si navigation directe non autorisée
      return res.redirect('/?error=unauthorized');
    }
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthenticatedRequest['user'];
    req.user = decoded;
    
    console.log(`[API Auth] ✅ Session JWT validée pour : ${decoded.username} (${decoded.discordId})`);
    next();
  } catch (error: any) {
    console.error(`[API Auth] ❌ Échec de décodage du JWT : ${error.message}`);
    
    if (isApiRequest) {
      return res.status(403).json({ error: 'Session invalide ou expirée.' });
    } else {
      return res.redirect('/?error=session_expired');
    }
  }
}