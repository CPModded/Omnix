import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { GuildConfig } from '../../models/GuildConfig';

/**
 * Middleware Express bloquant l'accès aux modifications Premium (comme l'IA ou les Backups)
 */
export async function requirePremium(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { guildId } = req.params;

  try {
    const config = await GuildConfig.findOne({ guildId });

    if (!config || !config.premium.isPremium) {
      return res.status(403).json({
        error: "Accès refusé",
        message: "Cette fonctionnalité requiert un abonnement Premium actif pour ce serveur."
      });
    }

    // Le serveur est Premium, on autorise la suite de la requête
    next();
  } catch (error) {
    return res.status(500).json({ error: "Erreur lors de la validation du statut Premium." });
  }
}