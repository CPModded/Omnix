import express from 'express';
import path from 'path';
import { setupSecurity } from './middlewares/security';
import authRoutes from './routes/auth.routes';
import guildsRoutes from './routes/guilds.routes';
import guildConfigRoutes from './routes/guildConfig.routes';
import founderRoutes from './routes/founder.routes';
import paymentRoutes from './routes/payment.routes';
import licenseRoutes from './routes/license.routes';
import adminRoutes from './routes/admin.routes';
import backupRoutes from './routes/backup.routes';
import { CONFIG } from '../config';

const app = express();

// CORRECTIF CLOUD : Ordonne à Express de faire confiance aux proxys inverses (Render / Cloudflare)
app.set('trust proxy', 1);

// 1. Initialisation des règles de sécurité (Helmet, CORS, Rate limiting)
setupSecurity(app);

// 2. CORRECTIF DE CACHE : Force les navigateurs (Safari/Chrome) à ne JAMAIS cacher vos pages HTML
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// 3. Configuration des décodeurs (Parsers)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// 4. Configuration du moteur d'affichage des templates (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../dashboard/views'));
app.use(express.static(path.join(__dirname, '../dashboard/public')));

// CORRECTIF DE SECURITE EJS : Injection de variables globales pour éviter les crashs sur n'importe quelle page
app.use((req, res, next) => {
  res.locals.clientId = CONFIG.DISCORD.CLIENT_ID;
  res.locals.redirectUri = encodeURIComponent(CONFIG.DISCORD.REDIRECT_URI);
  next();
});

// 5. Montage des routes de l'API et du Dashboard
app.use('/api/auth', authRoutes);
app.use('/api/guilds', guildsRoutes);
app.use('/api/guilds', guildConfigRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/admin', adminRoutes);     
app.use('/api/guilds', backupRoutes);    
app.use('/', founderRoutes);

// 6. Gestion centralisée des erreurs de l'API
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error Core]:', err.stack || err);
  res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur.' });
});

export default app;