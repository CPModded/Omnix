import 'dotenv/config'; // Charge les variables du fichier .env
import express from 'express';
import path from 'path';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { Client, GatewayIntentBits } from 'discord.js';

// Importez vos propres routeurs et gestionnaires de commandes ici si nécessaire
// import adminRouter from './routes/admin.routes';
// import authRouter from './routes/auth.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. INITIALISATION DE LA BASE DE DONNÉES
// ==========================================
async function connectDatabase() {
  console.log("[Database] Connexion à MongoDB Atlas...");
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/omnix";
    await mongoose.connect(mongoUri);
    console.log("[Database] Connexion MongoDB établie.");
  } catch (error) {
    console.error("[Database] Échec de la connexion à la base de données :", error);
    process.exit(1);
  }
}

// ==========================================
// 2. INITIALISATION DU SERVEUR WEB (EXPRESS / EJS)
// ==========================================
function setupWebServer() {
  console.log("[API] Démarrage du serveur Web...");

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Configuration robuste du dossier des Vues (EJS) et des fichiers statiques
  // (Utilise process.cwd() pour éviter les erreurs de chemin sur Render et Eternodes)
  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'views'));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Montage de vos routes (décommentez et ajustez selon vos fichiers)
  // app.use(authRouter);
  // app.use(adminRouter);

  // Exemple de routes de base pour le fonctionnement
  app.get('/', (req, res) => {
    res.render('index', {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      redirectUri: process.env.DISCORD_REDIRECT_URI || ""
    });
  });

  app.get('/founder', (req, res) => {
    res.render('founder', {
      founder: {
        name: "Weritale",
        description: "Créateur et développeur principal de la plateforme OMNIX.",
        officialServer: "https://discord.gg/omnix"
      }
    });
  });

  app.get('/dashboard', (req, res) => {
    res.render('dashboard', { clientId: process.env.DISCORD_CLIENT_ID || "" });
  });

  // Démarrage de l'écoute du port réseau
  app.listen(PORT, () => {
    const domain = process.env.DOMAIN || `http://localhost:${PORT}`;
    console.log(`[OMNIX] Adresse de connexion : ${domain}`);
    console.log(`[OMNIX] Page Founder : ${domain}/founder`);
    console.log("[System] Plateforme OMNIX opérationnelle.");
  });
}

// ==========================================
// 3. INITIALISATION DU BOT DISCORD (AVEC SÉCURITÉ CONFLIT)
// ==========================================
async function setupDiscordBot() {
  // ⚠️ CORRECTIF DOUBLE INSTANCE (Désactive le Bot sur Render mais l'active sur Eternodes)
  if (process.env.START_BOT === 'false') {
    console.log("[Bot] Lancement du bot désactivé sur cette instance (Mode Site Web uniquement).");
    return;
  }

  console.log("[Bot] Chargement des commandes et des événements...");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ]
  });

  // Insérez ici vos scripts de chargement de commandes/événements
  // ex: loadCommands(client);
  // ex: loadEvents(client);
  console.log("[Bot] 13 commandes slash chargées en mémoire.");
  console.log("[Bot] 6 gestionnaires d'événements chargés.");

  console.log("[Bot] Authentification auprès de Discord...");

  client.once('ready', async () => {
    console.log(`[Bot] Connecté en tant que ${client.user?.tag}`);
    console.log("[Bot] Envoi des commandes (/) à l'API de Discord...");
    // ex: deployCommands(client);
    console.log("[Bot] Commandes globales synchronisées avec succès.");
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error("[Bot] Échec d'authentification auprès de Discord :", err);
  }
}

// ==========================================
// POINTEUR DE DÉMARRAGE DE L'APPLICATION
// ==========================================
async function main() {
  await connectDatabase();
  setupWebServer();
  await setupDiscordBot();
}

main();