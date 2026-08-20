import type { Request, Response } from 'express'; // 🟢 Import de type ESM
import { User } from '../../models/User.ts';         // 🟢 Import ESM (.ts)
import client from '../../bot/client.ts';           // 🟢 Import ESM (.ts) de votre client Discord

/**
 * GET /api/stats (ou /api/admin/stats selon votre montage)
 * Récupère les métriques de fonctionnement globales d'OMNIX
 */
export async function getStats(req: Request, res: Response) {
  try {
    // 🟢 CORRECTIF DE SÉCURITÉ CONFLIT (Render / Eternodes) :
    // Si le bot n'est pas démarré sur cette instance (ex: sur Render car START_BOT est à "false"),
    // l'objet "client" n'est pas prêt et "client.readyAt" est nul.
    // On applique des valeurs de secours de 0 pour éviter un plantage TypeError critique.
    const guildsCount = client && client.readyAt ? client.guilds.cache.size : 0;
    const ping = client && client.readyAt ? client.ws.ping : 0;

    // Récupération dynamique du nombre de membres inscrits en base de données MongoDB Atlas
    const totalUsers = await User.countDocuments().catch(() => 0);

    return res.json({
      success: true,
      bot: {
        guildsCount,
        ping
      },
      database: {
        totalUsers
      }
    });
  } catch (error) {
    console.error("Erreur d'interrogation de l'API de statistiques :", error);
    return res.status(500).json({ 
      success: false, 
      error: "Une erreur interne est survenue lors de la récupération des statistiques." 
    });
  }
}