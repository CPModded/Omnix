/**
 * ====================================================================
 * MIDDLEWARE D'AUTHENTIFICATION JWT (SUPPORT SECURE COOKIES SUR IOS)
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

// Décodeur de cookie robuste prévenant le bug du signe "="
function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';');
  for (let cookie of cookies) {
    cookie = cookie.trim();
    const eqIndex = cookie.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = cookie.substring(0, eqIndex).trim();
    const value = cookie.substring(eqIndex + 1).trim();
    
    if (key === name) return value;
  }
  return null;
}

export function isAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = getCookie(req, 'jwt_token');
  const queryToken = req.query.token as string | undefined;
  const origin = req.headers.origin || req.headers.referer || 'Inconnu';

  console.log(`[API Auth] 🔑 Tentative d'accès à une route sécurisée par l'origine : ${origin}`);

  let token: string | null = null;

  // 1. Extraction depuis l'en-tête (cas classique des requêtes fetch d'API)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // 2. Extraction depuis les paramètres d'URL (redirection de connexion)
  else if (queryToken) {
    token = queryToken;
    
    // Détection HTTPS pour l'attribut Secure requis par iOS / Safari
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `jwt_token=${token}; Path=/; Max-Age=604800; SameSite=Lax${isSecure ? '; Secure' : ''}`);
  }
  // 3. Extraction depuis les Cookies (cas classique de navigation)
  else if (cookieToken) {
    token = cookieToken;
  }

  const isApiRequest = req.path.startsWith('/api');

  if (!token) {
    console.warn(`[API Auth] ⚠️ Échec : Jeton de session absent.`);
    
    if (isApiRequest) {
      return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
    } else {
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