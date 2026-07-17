import express, { Request, Response } from 'express';
import AuditLog from '../models/AuditLog';

// ⚠️ IMPORTANT : Importez vos propres middlewares pour sécuriser cette route !
// import { isAuthenticated, isStaff } from '../middlewares/auth';

const router = express.Router();

/**
 * GET /api/admin/audit-logs
 * Récupère l'historique des logs avec filtres, recherche et pagination.
 * 
 * Ajoutez vos middlewares de sécurité ici (ex: isAuthenticated, isStaff)
 */
router.get('/api/admin/audit-logs', async (req: Request, res: Response) => {
  try {
    const { 
      module, 
      severity, 
      status, 
      search, 
      startDate, 
      endDate, 
      page = '1', 
      limit = '20' 
    } = req.query;

    const query: any = {};

    // 1. Filtre par module
    if (module && module !== 'ALL') {
      query.module = module;
    }

    // 2. Filtre par sévérité
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }

    // 3. Filtre par statut (SUCCESS ou FAILURE)
    if (status && status !== 'ALL') {
      query.status = status;
    }

    // 4. Filtre par période (Dates ISO ou Timestamps)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    // 5. Recherche textuelle (Pseudo, ID Discord auteur, ID serveur ou nom d'action)
    if (search) {
      const searchString = search as string;
      query.$or = [
        { actorTag: { $regex: searchString, $options: 'i' } },
        { actorId: searchString },
        { serverId: searchString },
        { action: { $regex: searchString, $options: 'i' } }
      ];
    }

    // 6. Sécurisation et validation de la pagination
    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    // Évite les plantages ou divisions par zéro si les valeurs reçues sont incorrectes (ex: page=abc)
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 20;
    
    // Sécurité : évite qu'un utilisateur malveillant ne demande limit=1000000, ce qui saturerait la RAM de MongoDB
    if (limitNum > 100) limitNum = 100; 

    const skip = (pageNum - 1) * limitNum;

    // 7. Requêtes exécutées en parallèle (optimisation du temps de réponse)
    // .lean() convertit le résultat en objets JS simples (plus rapide à traiter que des instances de modèles Mongoose complets)
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    // 8. Réponse structurée
    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des logs d\'audit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Une erreur interne est survenue lors de la récupération des logs d\'audit.' 
    });
  }
});

export default router;