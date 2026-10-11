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
exports.AiService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const AiServiceSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    provider: {
        type: String,
        enum: [
            'openrouter',
            'openai',
            'google',
            'anthropic',
            'custom',
        ],
        required: true,
        default: 'openrouter',
        index: true,
    },
    model: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    status: {
        type: String,
        enum: [
            'active',
            'inactive',
            'maintenance',
        ],
        default: 'active',
        index: true,
    },
    /*
     * Isolation serveur.
     */
    guildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
    },
    /*
     * Service éventuellement lié à un utilisateur.
     */
    userId: {
        type: String,
        default: null,
        index: true,
        trim: true,
    },
    temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
    },
    maxTokens: {
        type: Number,
        default: 2000,
        min: 1,
    },
    systemPrompt: {
        type: String,
        default: null,
        maxlength: 12000,
    },
    /*
     * Statistiques.
     */
    totalRequests: {
        type: Number,
        default: 0,
        min: 0,
    },
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
    lastUsedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * Recherche des services actifs d'un serveur.
 */
AiServiceSchema.index({
    guildId: 1,
    status: 1,
});
/*
 * Recherche des services d'un utilisateur.
 */
AiServiceSchema.index({
    userId: 1,
    status: 1,
});
/*
 * Recherche globale par provider/modèle.
 */
AiServiceSchema.index({
    provider: 1,
    model: 1,
});
/* =========================================================
   MODEL
========================================================= */
const AiService = mongoose_1.default.models.AiService ??
    mongoose_1.default.model('AiService', AiServiceSchema);
exports.AiService = AiService;
exports.default = AiService;
