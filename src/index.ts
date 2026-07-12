/**
 * ====================================================================
 * POINT D'ENTRÉE OMNIX (BOT + API + REAL-TIME SOCKETS)
 * Coordonne et démarre tous les services avec support Socket.IO.
 * ====================================================================
 */

import { CONFIG } from './config'; 
import mongoose from 'mongoose';
import app from './api/app';
import { client as botClient } from './bot/client';
import { loadCommands } from './bot/handlers/commandHandler';
import { loadEvents } from './bot/handlers/eventHandler';
import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer(app);

// Initialisation globale de Socket.IO
export const io = new Server(httpServer, {
  cors: {
    origin: CONFIG.CLIENT_URL,
    credentials: true
  }
});

// Écoute des connexions Socket.IO pour le temps réel du Dashboard
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Nouveau client connecté : ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client déconnecté : ${socket.id}`);
  });
});

async function bootstrap() {
  console.log('======================================================');
  console.log('         DÉMARRAGE DE LA PLATEFORME OMNIX             ');
  console.log('======================================================');

  try {
    // 1. Connexion à la base de données MongoDB (Atlas/Kermit)
    console.log('[Database] Connexion à MongoDB...');
    if (!CONFIG.MONGO_URI) {
      throw new Error("La variable MONGO_URI est manquante.");
    }
    await mongoose.connect(CONFIG.MONGO_URI);
    console.log('[Database] Connexion MongoDB établie.');

    // 2. Chargement du Bot Discord
    console.log('[Bot] Chargement des commandes et des événements...');
    await loadCommands(botClient);
    await loadEvents(botClient);
    
    console.log('[Bot] Authentification auprès de Discord...');
    if (!CONFIG.DISCORD.BOT_TOKEN) {
      throw new Error("La variable DISCORD_BOT_TOKEN est manquante.");
    }
    await botClient.login(CONFIG.DISCORD.BOT_TOKEN);

    // 3. Démarrage du Serveur Web HTTP & Socket.IO
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