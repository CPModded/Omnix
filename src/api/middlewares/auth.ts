/**
 * ====================================================================
 * MIDDLEWARE D'AUTHENTIFICATION JWT (AUDIT TRAÇAGE SERVEUR EXTRÊME)
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
  const path = req.path;
  const method = req.method;

  // ==========================================
  // BLOC D'AUDIT TECHNIQUE VISIBLE SUR RENDER/PTERODACTYL
  // ==========================================
  console.log('======================================================');
  console.log(`[OMNIX AUTH MONITOR] 🛡️ TRAÇAGE D'ACCÈS REQUIS`);
  console.log(`[OMNIX AUTH MONITOR] 📡 Chemin : ${method} ${path}`);
  console.log(`[OMNIX AUTH MONITOR] 🔐 Authorization Header :`, authHeader || '❌ Aucun');
  console.log(`[OMNIX AUTH MONITOR] 🍪 Cookie brut :`, req.headers.cookie || '❌ Aucun');
  console.log(`[OMNIX AUTH MONITOR] 🍪 Cookie "jwt_token" extrait :`, cookieToken ? `${cookieToken.substring(0, 24)}...` : '❌ Aucun');
  console.log(`[OMNIX AUTH MONITOR] 🔍 Query Token (?token=) :`, queryToken ? `${queryToken.substring(0, 24)}...` : '❌ Aucun');
  console.log('[OMNIX AUTH MONITOR] 🗺️ Referer/Origin :', req.headers.referer || req.headers.origin || '❌ Aucun');

  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    console.log(`[OMNIX AUTH MONITOR] ✅ Jeton extrait depuis l'en-tête Authorization.`);
  } else if (queryToken) {
    token = queryToken;
    console.log(`[OMNIX AUTH MONITOR] ✅ Jeton extrait depuis les paramètres d'URL (Query).`);
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `jwt_token=${token}; Path=/; Max-Age=604800; SameSite=Lax${isSecure ? '; Secure' : ''}`);
    console.log(`[OMNIX AUTH MONITOR] ✍️ Enregistrement du cookie de session (Set-Cookie) envoyé au navigateur.`);
  } else if (cookieToken) {
    token = cookieToken;
    console.log(`[OMNIX AUTH MONITOR] ✅ Jeton extrait depuis les Cookies.`);
  }

  const isApiRequest = req.path.startsWith('/api');

  if (!token) {
    console.warn(`[OMNIX AUTH MONITOR] ❌ Échec d'accès : Aucun jeton de session n'a pu être trouvé.`);
    console.log('======================================================');
    
    if (isApiRequest) {
      return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
    } else {
      return res.redirect('/?error=unauthorized');
    }
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthenticatedRequest['user'];
    req.user = decoded;
    
    console.log(`[OMNIX AUTH MONITOR] 🎉 Session JWT validée avec succès pour : @${decoded.username} (${decoded.discordId})`);
    console.log('======================================================');
    next();
  } catch (error: any) {
    console.error(`[OMNIX AUTH MONITOR] ❌ Échec critique de décodage JWT : ${error.message}`);
    console.log('======================================================');
    
    if (isApiRequest) {
      return res.status(403).json({ error: 'Session invalide ou expirée.' });
    } else {
      return res.redirect('/?error=session_expired');
    }
  }
}