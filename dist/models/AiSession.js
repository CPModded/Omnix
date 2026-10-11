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
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   MESSAGE SCHEMA
========================================================= */
const AiMessageSchema = new mongoose_1.Schema({
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
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    _id: false,
});
/* =========================================================
   SESSION SCHEMA
========================================================= */
const AiSessionSchema = new mongoose_1.Schema({
    /*
     * Discord user.
     */
    userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Discord guild.
     *
     * Null = session globale.
     */
    guildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
    },
    /*
     * Titre facultatif.
     */
    title: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
    },
    /*
     * Historique de session.
     *
     * La mémoire conversationnelle Discord
     * détaillée est gérée par AIMemory.
     */
    messages: {
        type: [
            AiMessageSchema,
        ],
        default: [],
    },
    /*
     * Statistiques OpenRouter / IA.
     */
    totalPromptTokens: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalCompletionTokens: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalTokens: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalRequests: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
    versionKey: false,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * Une session principale par utilisateur + serveur.
 *
 * ATTENTION :
 *
 * guildId peut être null.
 *
 * MongoDB considère les valeurs nulles comme identiques
 * pour un index unique.
 *
 * On utilise donc un index partiel afin de ne pas
 * bloquer plusieurs sessions globales éventuelles.
 */
AiSessionSchema.index({
    userId: 1,
    guildId: 1,
}, {
    unique: true,
    partialFilterExpression: {
        guildId: {
            $type: 'string',
        },
    },
});
/*
 * Recherche rapide des sessions d'un utilisateur.
 */
AiSessionSchema.index({
    userId: 1,
    updatedAt: -1,
});
/*
 * Recherche des sessions d'un serveur.
 */
AiSessionSchema.index({
    guildId: 1,
    updatedAt: -1,
});
/* =========================================================
   MODEL
========================================================= */
const AiSession = mongoose_1.default.models.AiSession ??
    mongoose_1.default.model('AiSession', AiSessionSchema);
/* =========================================================
   EXPORT
========================================================= */
exports.default = AiSession;
