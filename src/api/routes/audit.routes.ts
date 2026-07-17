import express from 'express';
import AuditLog from '../models/AuditLog'; // Si Mongoose

const router = express.Router();

router.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const { module, severity, search, page = '1', limit = '20' } = req.query;

    const query: any = {};

    // 1. Filtre par module
    if (module && module !== 'ALL') {
      query.module = module;
    }

    // 2. Filtre par sévérité
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }

    // 3. Recherche (Pseudo de l'auteur, ID Discord de l'auteur, ID de serveur ou nom d'action)
    if (search) {
      query.$or = [
        { actorTag: { $regex: search, $options: 'i' } },
        { actorId: search },
        { serverId: search },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Récupération des logs triés du plus récent au plus ancien
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Nombre total de documents pour gérer la pagination côté frontend
    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des logs d\'audit:', error);
    res.status(500).json({ error: 'Une erreur interne est survenue.' });
  }
});

export default router;