import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

export async function adminCheck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // L'utilisateur authentifié possède déjà ses données chargées dans req.user par le middleware auth
  const discordId = req.user?.discordId;

  if (!discordId) {
    return res.status(401).render('index', { error: 'Veuillez vous connecter pour accéder à cette page.' });
  }

  try {
    // 1. Autorisation si configuré en tant que Propriétaire (Owner) dans le fichier .env
    const isOwner = CONFIG.DISCORD.OWNER_IDS.includes(discordId);
    if (isOwner) {
      return next();
    }

    // 2. Autorisation si l'utilisateur possède l'état Administrateur (Badge Admin) en base de données
    const userDb = await User.findOne({ discordId });
    if (userDb && userDb.isAdmin) {
      return next();
    }

    // Refus d'accès si aucune des conditions n'est valide
    return res.status(403).render('index', { 
      error: 'Accès refusé. Cette console est strictement réservée au Staff d\'OMNIX.' 
    });
  } catch (error: any) {
    console.error('[Admin Middleware Error] :', error.message);
    return res.status(500).render('index', { error: 'Erreur d\'autorisation interne.' });
  }
}