import { CONFIG } from './config'; // Doit être importé sur la toute première ligne pour éviter la TDZ

import mongoose from 'mongoose';
import app from './api/app';
import { client as botClient } from './bot/client';
import { loadCommands } from './bot/handlers/commandHandler';
import { loadEvents } from './bot/handlers/eventHandler';
import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: CONFIG.CLIENT_URL,
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Nouveau client connecté : ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client déconnecté : ${socket.id}`);
  });
});

async function bootstrap() {
  console.log('======================================================');
  try {
    console.log('[Database] Connexion à MongoDB Atlas...');
    if (!CONFIG.MONGO_URI) {
      throw new Error("La variable MONGO_URI est manquante.");
    }
    await mongoose.connect(CONFIG.MONGO_URI);
    console.log('[Database] Connexion MongoDB établie.');

    console.log('[Bot] Chargement des commandes et des événements...');
    await loadCommands(botClient);
    await loadEvents(botClient);
    
    console.log('[Bot] Authentification auprès de Discord...');
    if (!CONFIG.DISCORD.BOT_TOKEN) {
      throw new Error("La variable DISCORD_BOT_TOKEN est manquante.");
    }
    await botClient.login(CONFIG.DISCORD.BOT_TOKEN);

    console.log('[API] Démarrage du serveur Web...');
    const serverPort = CONFIG.PORT || 3000;
    
    httpServer.listen(serverPort, () => {
      console.log('======================================================');
      console.log(`[OMNIX] Adresse de connexion : ${CONFIG.CLIENT_URL}`);
      console.log(`[OMNIX] Page Founder : ${CONFIG.CLIENT_URL}/founder`);
      console.log('======================================================');
      console.log('[System] Plateforme OMNIX opérationnelle.');
    });

  } catch (error: any) {
    console.error('======================================================');
    console.error('[Critical Error] Échec de l\'initialisation !');
    console.error('[Détails] :', error.message || error);
    console.error('======================================================');
    process.exit(1);
  }
}

bootstrap();