import 'dotenv/config'; // Charge les variables du fichier .env
import express from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { pathToFileURL } from 'url'; // Utile pour convertir les chemins de fichiers en URLs valides pour ESM
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';

// ENREGISTREMENT ET MONTAGE DES ROUTEURS SÉCURISÉS ESM (.ts)
import authRouter from './api/routes/auth.routes.ts'; 
import adminRouter from './api/routes/admin.routes.ts'; 

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONNEXION À LA BASE DE DONNÉES
// ==========================================
async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  
  if (!mongoUri) {
    console.error("[Database] ❌ ERREUR : Aucune adresse de connexion MongoDB trouvée.");
    console.error("[Database] Veuillez configurer MONGODB_URI ou MONGO_URI dans votre fichier .env.");
    process.exit(1);
  }

  if (mongoUri.includes('mongodb+srv')) {
    console.log("[Database] Connexion à MongoDB Atlas...");
  } else {
    console.log("[Database] Connexion à MongoDB local...");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("[Database] Connexion MongoDB établie.");
  } catch (error) {
    console.error("[Database] Échec de la connexion à la base de données :", error);
    process.exit(1);
  }
}

// ==========================================
// 2. CONFIGURATION DU SERVEUR WEB (EXPRESS)
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

  // 🟢 MONTAGE DE VOS ROUTEURS ALIGNÉS AVEC VOTRE STRATÉGIE D'API
  // auth.routes.ts gère "/callback", monté sur "/api/auth" -> devient "/api/auth/callback"
  app.use('/api/auth', authRouter);
  
  // admin.routes.ts déclare déjà ses routes avec "/api/admin/..." et "/api/stats",
  // on le monte donc à la racine sans doublon de préfixe pour que les requêtes fonctionnent.
  app.use(adminRouter); 

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

  app.listen(PORT, () => {
    const domain = process.env.DOMAIN || `http://localhost:${PORT}`;
    console.log(`[OMNIX] Adresse de connexion : ${domain}`);
    console.log(`[OMNIX] Page Founder : ${domain}/founder`);
    console.log("[System] Plateforme OMNIX opérationnelle.");
  });
}

// ==========================================
// 3. CHARGEMENT ET ENREGISTREMENT DU BOT
// ==========================================
async function setupDiscordBot() {
  // SÉCURITÉ CONFLIT DOUBLE INSTANCE
  if (process.env.START_BOT === 'false') {
    console.log("[Bot] Lancement du bot désactivé sur cette instance (Mode Site Web uniquement).");
    return;
  }

  // Détection intelligente : cherche sous les 3 noms les plus courants du développement
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;

  if (!token) {
    console.error("[Bot] ❌ ERREUR : Aucun token Discord trouvé.");
    console.error("[Bot] Veuillez vérifier que votre fichier .env contient la variable DISCORD_BOT_TOKEN ou DISCORD_TOKEN.");
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
  }) as any;

  client.commands = new Collection();

  // CHARGEUR DYNAMIQUE COMPATIBLE ESM (Scan src/bot/commands)
  const commandsPath = path.join(process.cwd(), 'src/bot/commands');
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      // Convertit le chemin local en URL valide pour l'import ESM
      const fileUrl = pathToFileURL(filePath).href;
      const commandModule = await import(fileUrl);
      
      // Supporte à la fois "export const data" et "export default { data }"
      const command = commandModule.default || commandModule;

      if (command && 'data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`[Bot] ⚠️ La commande dans le fichier ${file} n'a pas pu être chargée (propriétés requises manquantes).`);
      }
    }
    console.log(`[Bot] ${client.commands.size} commandes slash chargées en mémoire.`);
  }

  // CHARGEUR DYNAMIQUE COMPATIBLE ESM (Scan src/bot/events)
  const eventsPath = path.join(process.cwd(), 'src/bot/events');
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const fileUrl = pathToFileURL(filePath).href;
      const eventModule = await import(fileUrl);
      
      // Supporte à la fois les exports par défaut et nommés pour les événements
      const event = eventModule.default || eventModule;

      if (event && event.name) {
        if (event.once) {
          client.once(event.name, (...args: any[]) => event.execute(...args));
        } else {
          client.on(event.name, (...args: any[]) => event.execute(...args));
        }
      }
    }
    console.log(`[Bot] ${eventFiles.length} gestionnaires d'événements chargés.`);
  }

  console.log("[Bot] Authentification auprès de Discord...");

  client.once('ready', async () => {
    console.log(`[Bot] Connecté en tant que ${client.user?.tag}`);
    
    // Enregistrement et synchronisation automatique des commandes auprès de Discord
    const commandsJson = Array.from(client.commands.values()).map((cmd: any) => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      console.log("[Bot] Envoi des commandes (/) à l'API de Discord...");
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commandsJson }
      );
      console.log("[Bot] Commandes globales synchronisées avec succès.");
    } catch (error) {
      console.error("[Bot] Erreur lors de l'enregistrement des commandes slash :", error);
    }
  });

  // Intercepteur pour exécuter les commandes Slash
  client.on('interactionCreate', async (interaction: any) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true });
    }
  });

  try {
    await client.login(token);
  } catch (err) {
    console.error("[Bot] Échec d'authentification auprès de Discord :", err);
  }
}

// Lancement général
async function main() {
  await connectDatabase();
  setupWebServer();
  await setupDiscordBot();
}

main();