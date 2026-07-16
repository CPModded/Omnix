/**
 * ====================================================================
 * MIDDLEWARE DE VERIFICATION STAFF & OWNER (OMNIX AUDIT MONITOR)
 * ====================================================================
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { User } from '../../models/User';
import { CONFIG } from '../../config';

export async function adminCheck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const discordId = req.user?.discordId;
  const isApiRequest = req.path.startsWith('/api');

  if (!discordId) {
    console.warn(`[OMNIX Security] 🚨 Refus d'accès : discordId absent dans req.user.`);
    if (isApiRequest) {
      return res.status(401).json({ error: 'Veuillez vous connecter pour accéder à cette interface.' });
    } else {
      return res.redirect('/?error=unauthorized');
    }
  }

  try {
    console.log('======================================================');
    console.log(`[OMNIX Security] 🛡️ VERIFICATION ADMIN POUR : @${req.user?.username} (${discordId})`);

    // 1. Éligibilité de Niveau 1 : Le membre est-il le fondateur du bot ?
    const isOwner = CONFIG.DISCORD.OWNER_IDS.includes(discordId);
    console.log(`[OMNIX Security] 🔍 Est Fondateur (Owner) ? :`, isOwner ? '✅ Oui' : '❌ Non');
    if (isOwner) {
      console.log(`[OMNIX Security] 🎉 Accès accordé : Propriétaire du bot.`);
      console.log('======================================================');
      return next();
    }

    // 2. Éligibilité de Niveau 2 : Le membre possède-t-il le badge d'administrateur ?
    const userDb = await User.findOne({ discordId });
    console.log(`[OMNIX Security] 🔍 Utilisateur trouvé en base de données ? :`, userDb ? '✅ Oui' : '❌ Non (Introuvable !)');
    
    if (userDb) {
      console.log(`[OMNIX Security] 🔍 Valeur de userDb.isAdmin en base ? :`, userDb.isAdmin ? '✅ True' : '❌ False');
      if (userDb.isAdmin) {
        console.log(`[OMNIX Security] 🎉 Accès accordé : Administrateur de la plateforme.`);
        console.log('======================================================');
        return next();
      }
    }

    // 3. Refus d'accès
    console.warn(`[OMNIX Security] 🚨 Accès refusé pour @${req.user?.username} (${discordId}) - Droits insuffisants.`);
    console.log('======================================================');
    
    if (isApiRequest) {
      return res.status(403).json({ 
        error: 'Accès restreint. Cette console est réservée uniquement au personnel autorisé.' 
      });
    } else {
      // Redirection propre si navigation web
      return res.redirect('/?error=forbidden');
    }

  } catch (error: any) {
    console.error('[Admin Middleware Error] :', error.message || error);
    if (isApiRequest) {
      return res.status(500).json({ error: 'Erreur d\'autorisation interne sur le serveur.' });
    } else {
      return res.redirect('/?error=server_error');
    }
  }
}