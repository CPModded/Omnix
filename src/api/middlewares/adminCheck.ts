/**
 * ====================================================================
 * MIDDLEWARE DE VERIFICATION STAFF & OWNER (OMNIX SECURITY)
 * ====================================================================
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

export async function adminCheck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // 1. Récupération des données de session injectées par le middleware isAuthenticated
  const discordId = req.user?.discordId;

  if (!discordId) {
    return res.status(401).json({ error: 'Veuillez vous connecter pour accéder à cette interface.' });
  }

  try {
    // 2. Éligibilité de Niveau 1 : Le membre est-il le fondateur du bot (défini dans .env / config) ?
    const isOwner = CONFIG.DISCORD.OWNER_IDS.includes(discordId);
    if (isOwner) {
      return next();
    }

    // 3. Éligibilité de Niveau 2 : Le membre possède-t-il le badge d'administrateur système en base de données ?
    const userDb = await User.findOne({ discordId });
    if (userDb && userDb.isAdmin) {
      return next();
    }

    // 4. Refus d'accès si aucune des conditions d'éligibilité n'est remplie
    console.warn(`[OMNIX Security] 🚨 Tentative d'accès non autorisée au panel d'administration par @${req.user?.username} (${discordId})`);
    
    return res.status(403).json({ 
      error: 'Accès restreint. Cette console est réservée uniquement au personnel autorisé.' 
    });

  } catch (error: any) {
    console.error('[Admin Middleware Error] :', error.message || error);
    return res.status(500).json({ error: 'Erreur d\'autorisation interne sur le serveur.' });
  }
}