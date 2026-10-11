// Eternodes injects environment variables directly. Load .env when dotenv is installed,
// but do not crash production if the panel has not installed the optional loader yet.
try { require('dotenv').config(); } catch (error) {
  console.warn('[CONFIG] dotenv indisponible ; utilisation des variables d’environnement du panel.');
}
import mongoose from 'mongoose';
import { createApp } from './api/app.js';
import { CONFIG, validateProductionConfig } from './config/index.js';
import { client } from './bot/client.js';
import { loadCommands } from './bot/handlers/commandHandler.js';
import { loadEvents } from './loaders/eventLoader.js';
import { createServer as createDevBridge } from './server.js';
import { bridgeEnabled, env as bridgeEnv } from './config/env.js';
import { ensureGuildModulesSchema } from './database/mysql.js';

async function connectMongo() {
  if (!CONFIG.MONGO_URI) {
    console.warn('[MongoDB] MONGODB_URI/MONGO_URI absent : MongoDB désactivé.');
    return;
  }
  try {
    await mongoose.connect(CONFIG.MONGO_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
    console.log(`[MongoDB] ✓ Connexion réussie. Base active : ${mongoose.connection.name || 'default'}`);
  } catch (error) {
    console.error('[MongoDB] ✗ Connexion indisponible :', error);
  }
}

async function start() {
  validateProductionConfig();
  await connectMongo();
  await ensureGuildModulesSchema().catch(error => console.warn('[MySQL] ⚠ Schéma modules indisponible :', error?.message || error));

  const app = createApp();
  app.listen(CONFIG.PORT, '0.0.0.0', () => console.log(`[Web] ✓ Omnix Dashboard/API sur le port ${CONFIG.PORT}`));

  if (CONFIG.DISCORD.TOKEN) {
    await loadCommands(client);
    await loadEvents(client);
    await client.login(CONFIG.DISCORD.TOKEN);
  } else {
    console.error('[Discord] ✗ DISCORD_TOKEN absent : bot non démarré.');
  }

  if (bridgeEnabled) {
    const bridge = createDevBridge();
    bridge.listen(bridgeEnv.port, bridgeEnv.host, () => console.log(`[DevBridge] ✓ MCP/API sur ${bridgeEnv.host}:${bridgeEnv.port}`));
  } else {
    console.warn('[DevBridge] Désactivé : MCP_API_KEY absent.');
  }
}

start().catch(error => {
  console.error('[System] ✗ Démarrage Omnix impossible :', error);
  process.exit(1);
});
