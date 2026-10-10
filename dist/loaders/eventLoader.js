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
exports.loadBotEvents = void 0;
exports.loadEvents = loadEvents;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
/* =========================================================
   RÉCUPÉRATION RÉCURSIVE DES FICHIERS
========================================================= */
function getEventFiles(directory) {
    const files = [];
    if (!node_fs_1.default.existsSync(directory)) {
        return files;
    }
    const entries = node_fs_1.default.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = node_path_1.default.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...getEventFiles(fullPath));
            continue;
        }
        if (!entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.js') &&
            !entry.name.endsWith('.mjs')) {
            continue;
        }
        /*
         * Fichiers à ignorer
         */
        if (entry.name.endsWith('.d') ||
            entry.name.endsWith('.test') ||
            entry.name.endsWith('.spec')) {
            continue;
        }
        files.push(fullPath);
    }
    return files;
}
/* =========================================================
   NORMALISATION DE L'ÉVÉNEMENT
========================================================= */
function normalizeEvent(module) {
    const event = module?.default ??
        module?.event ??
        module;
    if (!event) {
        return null;
    }
    if (typeof event.name !== 'string') {
        return null;
    }
    if (typeof event.execute !== 'function') {
        return null;
    }
    return event;
}
async function loadModule(file) {
    // Production build is CommonJS: absolute .js paths are directly require-able.
    // Falling back to import(file://...) breaks because Node's CommonJS resolver
    // does not accept a file URL passed to require().
    if (file.endsWith('.js') || file.endsWith('.cjs'))
        return require(file);
    try {
        return require(file);
    }
    catch (error) {
        const url = (0, node_url_1.pathToFileURL)(file).href;
        return Promise.resolve(`${url}`).then(s => __importStar(require(s))).catch(() => { throw error; });
    }
}
/* =========================================================
   CHARGEMENT DES ÉVÉNEMENTS
========================================================= */
async function loadEvents(client, eventsPath) {
    // Idempotence : un même Client ne doit jamais enregistrer deux fois ses
    // listeners, même si le bootstrap est relancé par un script de reload.
    const clientState = client;
    const directory = eventsPath ?? (() => {
        const dist = node_path_1.default.join(process.cwd(), 'dist', 'bot', 'events');
        return node_fs_1.default.existsSync(dist) ? dist : node_path_1.default.join(process.cwd(), 'src', 'bot', 'events');
    })();
    const currentPath = node_path_1.default.resolve(directory);
    if (clientState.__omnixEventsLoaded && clientState.__omnixEventsLoadedPath === currentPath) {
        console.warn('[Bot] Événements déjà chargés sur ce client — second chargement ignoré.');
        return;
    }
    console.log(`[Bot] Recherche des événements dans : ${directory}`);
    if (!node_fs_1.default.existsSync(directory)) {
        console.warn(`[Bot] Dossier événements introuvable : ${directory}`);
        return;
    }
    const files = getEventFiles(directory);
    console.log(`[Bot] ${files.length} fichier(s) d'événements trouvé(s).`);
    /*
     * =========================================================
     * PROTECTION CONTRE LES DOUBLONS
     * =========================================================
     */
    const loadedEvents = new Set();
    /*
     * =========================================================
     * CHARGEMENT
     * =========================================================
     */
    for (const file of files) {
        try {
            const module = await loadModule(file);
            const event = normalizeEvent(module);
            if (!event) {
                console.warn(`[Bot] ${node_path_1.default.basename(file)} ignoré : événement invalide.`);
                continue;
            }
            /*
             * =======================================================
             * DÉTECTION DU NOM
             * =======================================================
             */
            const eventName = event.name.trim();
            const normalizedEventName = eventName.toLowerCase();
            if (!eventName) {
                console.warn(`[Bot] ${node_path_1.default.basename(file)} ignoré : nom vide.`);
                continue;
            }
            /*
             * =======================================================
             * DOUBLON
             * =======================================================
             */
            if (Array.from(loadedEvents).some((loadedName) => loadedName.toLowerCase() === normalizedEventName)) {
                console.warn(`[Bot] ⚠️ Événement "${eventName}" déjà chargé.`);
                console.warn(`[Bot] Fichier ignoré : ${file}`);
                continue;
            }
            /*
             * =======================================================
             * ENREGISTREMENT
             * =======================================================
             */
            if (event.once) {
                client.once(eventName, (...args) => event.execute(...args));
            }
            else {
                client.on(eventName, (...args) => event.execute(...args));
            }
            loadedEvents.add(eventName);
            console.log(`[Bot] ✓ Événement chargé : ${node_path_1.default.basename(file)}`);
        }
        catch (error) {
            console.error(`[Bot] Erreur lors du chargement de ${file}:`, error);
        }
    }
    console.log(`[Bot] ${loadedEvents.size}/${files.length} gestionnaire(s) d'événements chargé(s).`);
    client.omnixLoadedEvents = [...loadedEvents];
    client.omnixEventLoadStatus = { loaded: loadedEvents.size, discovered: files.length, degraded: loadedEvents.size < files.length };
    clientState.__omnixEventsLoaded = true;
    clientState.__omnixEventsLoadedPath = currentPath;
}
/* =========================================================
   ALIAS
========================================================= */
exports.loadBotEvents = loadEvents;
exports.default = loadEvents;
