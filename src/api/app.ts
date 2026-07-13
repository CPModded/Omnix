/**
 * ====================================================================
 * CONFIGURATION DE L'APPLICATION EXPRESS (OMNIX CORE)
 * ====================================================================
 */

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

const app = express();

// CORRECTIF ABSOLU POUR RENDER : Faire confiance au proxy de Render dès la création de l'application
app.set('trust proxy', 1);

// 1. Initialisation des règles de sécurité (Helmet, CORS, Rate limiting)
setupSecurity(app);

// 2. Configuration des décodeurs (Parsers)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// 3. Configuration du moteur d'affichage des templates (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../dashboard/views'));
app.use(express.static(path.join(__dirname, '../dashboard/public')));

// 4. Montage des routes de l'API et du Dashboard
app.use('/api/auth', authRoutes);
app.use('/api/guilds', guildsRoutes);
app.use('/api/guilds', guildConfigRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/admin', adminRoutes);     
app.use('/api/guilds', backupRoutes);    
app.use('/', founderRoutes);

// 5. Gestion centralisée des erreurs de l'API
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error Core]:', err.stack || err);
  res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur.' });
});

export default app;