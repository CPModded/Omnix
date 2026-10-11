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
exports.Backup = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const BackupSchema = new mongoose_1.Schema({
    /*
     * =====================================================
     * GUILD
     * =====================================================
     *
     * Une sauvegarde appartient TOUJOURS à un serveur.
     *
     * C'est essentiel pour empêcher une sauvegarde
     * d'un serveur A d'être récupérée depuis le serveur B.
     */
    guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Identifiant interne de la sauvegarde.
     *
     * Exemple :
     *
     * BCK-8F42A1
     */
    backupId: {
        type: String,
        required: true,
        trim: true,
    },
    /*
     * Nom lisible dans le Dashboard.
     */
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    /*
     * Origine de la sauvegarde.
     */
    type: {
        type: String,
        enum: [
            'manual',
            'automatic',
            'scheduled',
        ],
        default: 'manual',
        index: true,
    },
    /*
     * État de la sauvegarde.
     */
    status: {
        type: String,
        enum: [
            'pending',
            'completed',
            'failed',
            'deleted',
        ],
        default: 'pending',
        index: true,
    },
    /*
     * Discord ID de la personne ayant
     * créé la sauvegarde.
     */
    createdBy: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Description facultative.
     */
    description: {
        type: String,
        default: null,
        trim: true,
        maxlength: 500,
    },
    /*
     * CONTENU DE LA SAUVEGARDE
     *
     * Mixed permet de sauvegarder différents modules :
     *
     * moderation
     * roles
     * channels
     * permissions
     * automod
     * tickets
     * welcome
     * etc.
     */
    data: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
        default: {},
    },
    /*
     * Taille de la sauvegarde.
     */
    size: {
        type: Number,
        default: 0,
        min: 0,
    },
    /*
     * Nombre d'éléments contenus.
     */
    itemCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    /*
     * Message d'erreur si la sauvegarde échoue.
     */
    errorMessage: {
        type: String,
        default: null,
    },
    /*
     * Date de fin de création.
     */
    completedAt: {
        type: Date,
        default: null,
    },
    /*
     * Date d'expiration éventuelle.
     *
     * null = sauvegarde permanente.
     */
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
}, {
    collection: 'backups',
    timestamps: true,
    versionKey: false,
    minimize: false,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * Un backupId doit être unique DANS un serveur.
 *
 * Serveur A :
 *   BCK-001
 *
 * Serveur B :
 *   BCK-001
 *
 * Autorisé.
 */
BackupSchema.index({
    guildId: 1,
    backupId: 1,
}, {
    unique: true,
});
/*
 * Liste des sauvegardes d'un serveur.
 */
BackupSchema.index({
    guildId: 1,
    createdAt: -1,
});
/*
 * Recherche par statut.
 */
BackupSchema.index({
    guildId: 1,
    status: 1,
    createdAt: -1,
});
/*
 * Recherche des sauvegardes automatiques.
 */
BackupSchema.index({
    guildId: 1,
    type: 1,
    createdAt: -1,
});
/*
 * Permet au système de nettoyage de retrouver
 * rapidement les sauvegardes expirées.
 */
BackupSchema.index({
    expiresAt: 1,
    status: 1,
});
/* =========================================================
   MODEL
========================================================= */
const Backup = mongoose_1.default.models.Backup ??
    mongoose_1.default.model('Backup', BackupSchema);
exports.Backup = Backup;
exports.default = Backup;
