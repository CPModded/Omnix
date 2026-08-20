import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// ============================================================
// PATHS
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(
  __dirname,
  '../..'
);
// ============================================================
// EXPRESS
// ============================================================
const app = express();
// ============================================================
// PROXY
// ============================================================
//
// Render fonctionne derrière un proxy.
// Cela permet notamment à Express de gérer correctement
// les IP et les cookies sécurisés.
//
app.set('trust proxy', 1);
// ============================================================
// VIEWS
// ============================================================
app.set(
  'view engine',
  'ejs'
);
app.set(
  'views',
  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'views'
  )
);
// ============================================================
// SECURITY
// ============================================================
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
// ============================================================
// BODY PARSER
// ============================================================
app.use(
  express.json({
    limit: '2mb',
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb',
  })
);
// ============================================================
// CACHE HEADERS
// ============================================================
app.use(
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );
    next();
  }
);
// ============================================================
// RATE LIMIT
// ============================================================
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes. Veuillez patienter.',
  },
});
app.use(
  '/api',
  apiLimiter
);
// ============================================================
// STATIC FILES
// ============================================================
const publicPath = path.join(
  PROJECT_ROOT,
  'src',
  'dashboard',
  'public'
);
app.use(
  express.static(publicPath, {
    maxAge:
      process.env.NODE_ENV === 'production'
        ? '1h'
        : 0,
  })
);
// ============================================================
// HEALTH CHECK
// ============================================================
//
// IMPORTANT POUR RENDER
//
// Cette route permet à Render et aux systèmes externes
// de vérifier que le serveur HTTP répond correctement.
//
app.get(
  '/health',
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'OMNIX',
      timestamp: new Date().toISOString(),
    });
  }
);
// ============================================================
// ROOT
// ============================================================
app.get(
  '/',
  (_req: Request, res: Response) => {
    try {
      return res.render('index');
    } catch (error) {
      console.error(
        '[Web] Erreur affichage / :',
        error
      );
      return res.status(500).send(
        'OMNIX est démarré, mais la page d’accueil est indisponible.'
      );
    }
  }
);
// ============================================================
// ROUTES API
// ============================================================
//
// Les imports sont effectués ici pour conserver une architecture
// claire et éviter de démarrer plusieurs serveurs HTTP.
//
import authRoutes from './routes/auth.routes.ts';
import guildRoutes from './routes/guild.routes.ts';
app.use(
  '/api/auth',
  authRoutes
);
app.use(
  '/api/guilds',
  guildRoutes
);
// ============================================================
// 404 API
// ============================================================
app.use(
  '/api',
  (
    req: Request,
    res: Response
  ) => {
    return res.status(404).json({
      error: 'Route API introuvable.',
      path: req.path,
    });
  }
);
// ============================================================
// 404 WEB
// ============================================================
app.use(
  (
    req: Request,
    res: Response
  ) => {
    return res.status(404).send(
      'Page introuvable.'
    );
  }
);
// ============================================================
// ERROR HANDLER
// ============================================================
app.use(
  (
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(
      '[Web] Erreur Express :',
      error
    );
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({
      error:
        'Une erreur interne est survenue.',
    });
  }
);
// ============================================================
// EXPORT
// ============================================================
//
// IMPORTANT :
// Aucun app.listen() ici.
//
// Le serveur HTTP est lancé par src/index.ts avec :
//
// http.createServer(app).listen(PORT, '0.0.0.0')
//
// Cela permet à Render de détecter correctement le port.
//
export default app;