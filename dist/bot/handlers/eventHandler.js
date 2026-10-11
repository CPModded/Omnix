"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEvents = loadEvents;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
async function loadEvents(client) {
    console.log('[Bot] Initialisation du chargeur d\'événements...');
    const eventsPath = node_path_1.default.join(__dirname, '../events');
    if (!node_fs_1.default.existsSync(eventsPath)) {
        console.warn(`[Bot] Dossier events introuvable : ${eventsPath}`);
        return;
    }
    const eventFiles = node_fs_1.default
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith('.ts') ||
        file.endsWith('.js') ||
        file.endsWith('.mjs'));
    if (eventFiles.length === 0) {
        console.warn('[Bot] Aucun fichier d\'événement trouvé.');
        return;
    }
    let count = 0;
    for (const file of eventFiles) {
        const filePath = node_path_1.default.join(eventsPath, file);
        try {
            console.log(`[Bot] Chargement de l'événement : ${file}`);
            console.log(`[Bot] >>> Import : ${file}`);
            const eventModule = await Promise.resolve(`${filePath}`).then(s => __importStar(require(s)));
            const event = eventModule.default;
            if (!event ||
                !event.name ||
                typeof event.execute !== 'function') {
                console.warn(`[Bot] Événement ignoré : ${file} — structure invalide.`);
                continue;
            }
            // Un seul gestionnaire par nom d'événement dans un processus.
            // Cela évite qu'un doublon de fichier/event charge deux listeners
            // et fasse partir deux actions Discord pour le même événement.
            const loadedEvents = client.omnixLoadedEventsSet || new Set();
            client.omnixLoadedEventsSet = loadedEvents;
            const eventKey = String(event.name);
            if (loadedEvents.has(eventKey)) {
                console.warn(`[Bot] Événement ignoré : ${file} — ${eventKey} est déjà chargé.`);
                continue;
            }
            const handler = (...args) => {
                void event.execute(...args, client);
            };
            if (event.once)
                client.once(event.name, handler);
            else
                client.on(event.name, handler);
            loadedEvents.add(eventKey);
            client.omnixLoadedEvents = Array.from(loadedEvents);
            count++;
            console.log(`[Bot] ✓ Événement chargé : ${String(event.name)}`);
        }
        catch (error) {
            console.error(`[Bot] ✗ Impossible de charger ${file}`);
            console.error(error);
            /*
             * On continue le chargement des autres événements
             * afin qu'un seul fichier défectueux ne bloque
             * pas complètement OMNIX.
             */
        }
    }
    console.log(`[Bot] ${count}/${eventFiles.length} gestionnaires d'événements chargés.`);
}
