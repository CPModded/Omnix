import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { GuildConfig } from '../../models/GuildConfig';

export async function requirePremium(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { guildId } = req.params;
  const user = req.user;

  try {
    // 1. BYPASS PREMIUM : Si l'utilisateur connecté détient le Premium personnel ou Admin, on autorise
    if (user && (user.isPremium || user.isAdmin)) {
      console.log(`[Premium Check] 💎 Accès Premium accordé via Licence Utilisateur à : ${user.username}`);
      return next();
    }

    // 2. Sinon, on vérifie si la guilde est Premium
    const config = await GuildConfig.findOne({ guildId });
    
    if (!config || !config.premium.isPremium) {
      console.warn(`[Premium Check] 🚫 Accès refusé pour la commande Premium sur le serveur gratuit : ${guildId}`);
      return res.status(403).json({ 
        error: "Fonctionnalité Premium.", 
        message: "Ce serveur ne détient pas de licence d'évaluation Premium active." 
      });
    }

    console.log(`[Premium Check] 💎 Accès Premium accordé via Licence Serveur.`);
    next();
  } catch (error) {
    return res.status(500).json({ error: "Erreur lors de la validation du statut Premium." });
  }
}