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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMemory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   MESSAGE SCHEMA
========================================================= */
const AIMemoryMessageSchema = new mongoose_1.Schema({
    role: {
        type: String,
        enum: [
            'user',
            'assistant',
            'system',
        ],
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, {
    _id: false,
});
/* =========================================================
   MEMORY SCHEMA
========================================================= */
const AIMemorySchema = new mongoose_1.Schema({
    /*
     * Discord server.
     *
     * Important:
     * La mémoire est isolée par serveur.
     */
    guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Discord channel.
     *
     * Permet d'avoir une mémoire différente
     * pour chaque salon.
     */
    channelId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Discord user.
     *
     * Permet de distinguer les utilisateurs
     * utilisant l'IA dans le même salon.
     */
    userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Historique IA.
     */
    messages: {
        type: [
            AIMemoryMessageSchema,
        ],
        default: [],
    },
}, {
    timestamps: true,
    versionKey: false,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * Une seule mémoire par :
 *
 * guild + channel + user
 *
 * Cela évite la création de plusieurs documents
 * contenant plusieurs historiques pour la même personne.
 */
AIMemorySchema.index({
    guildId: 1,
    channelId: 1,
    userId: 1,
}, {
    unique: true,
});
/*
 * Recherche rapide de toutes les mémoires
 * d'un salon.
 */
AIMemorySchema.index({
    guildId: 1,
    channelId: 1,
    updatedAt: -1,
});
/*
 * Recherche rapide des mémoires d'un utilisateur
 * sur un serveur.
 */
AIMemorySchema.index({
    guildId: 1,
    userId: 1,
    updatedAt: -1,
});
/* =========================================================
   MODEL
========================================================= */
const AIMemory = mongoose_1.default.models.AIMemory ??
    mongoose_1.default.model('AIMemory', AIMemorySchema);
exports.AIMemory = AIMemory;
exports.default = AIMemory;
