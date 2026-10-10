"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Eternodes injects environment variables directly. Load .env when dotenv is installed,
// but do not crash production if the panel has not installed the optional loader yet.
try {
    require('dotenv').config();
}
catch (error) {
    console.warn('[CONFIG] dotenv indisponible ; utilisation des variables d’environnement du panel.');
}
const mongoose_1 = __importDefault(require("mongoose"));
const app_js_1 = require("./api/app.js");
const index_js_1 = require("./config/index.js");
const client_js_1 = require("./bot/client.js");
const commandHandler_js_1 = require("./bot/handlers/commandHandler.js");
const eventLoader_js_1 = require("./loaders/eventLoader.js");
const server_js_1 = require("./server.js");
const env_js_1 = require("./config/env.js");
const mysql_js_1 = require("./database/mysql.js");
async function connectMongo() {
    if (!index_js_1.CONFIG.MONGO_URI) {
        console.warn('[MongoDB] MONGODB_URI/MONGO_URI absent : MongoDB désactivé.');
        return;
    }
    try {
        await mongoose_1.default.connect(index_js_1.CONFIG.MONGO_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
        console.log(`[MongoDB] ✓ Connexion réussie. Base active : ${mongoose_1.default.connection.name || 'default'}`);
    }
    catch (error) {
        console.error('[MongoDB] ✗ Connexion indisponible :', error);
    }
}
async function start() {
    (0, index_js_1.validateProductionConfig)();
    await connectMongo();
    await (0, mysql_js_1.ensureGuildModulesSchema)().catch(error => console.warn('[MySQL] ⚠ Schéma modules indisponible :', error?.message || error));
    const app = (0, app_js_1.createApp)();
    app.listen(index_js_1.CONFIG.PORT, '0.0.0.0', () => console.log(`[Web] ✓ Omnix Dashboard/API sur le port ${index_js_1.CONFIG.PORT}`));
    if (index_js_1.CONFIG.DISCORD.TOKEN) {
        await (0, commandHandler_js_1.loadCommands)(client_js_1.client);
        await (0, eventLoader_js_1.loadEvents)(client_js_1.client);
        await client_js_1.client.login(index_js_1.CONFIG.DISCORD.TOKEN);
    }
    else {
        console.error('[Discord] ✗ DISCORD_TOKEN absent : bot non démarré.');
    }
    if (env_js_1.bridgeEnabled) {
        const bridge = (0, server_js_1.createServer)();
        bridge.listen(env_js_1.env.port, env_js_1.env.host, () => console.log(`[DevBridge] ✓ MCP/API sur ${env_js_1.env.host}:${env_js_1.env.port}`));
    }
    else {
        console.warn('[DevBridge] Désactivé : MCP_API_KEY absent.');
    }
}
start().catch(error => {
    console.error('[System] ✗ Démarrage Omnix impossible :', error);
    process.exit(1);
});
