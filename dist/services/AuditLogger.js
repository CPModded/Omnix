"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
/**
 * Enregistre une action dans l'Audit Center.
 *
 * Important :
 * Une erreur de logging ne doit jamais empêcher
 * l'exécution de l'action principale.
 */
async function logAuditEvent(options) {
    try {
        const logData = {
            createdAt: new Date(),
            actorId: options.actorId,
            actorTag: options.actorTag ?? null,
            ipAddress: options.ipAddress ?? null,
            module: options.module,
            action: options.action,
            severity: options.severity ?? 'INFO',
            serverId: options.serverId ?? null,
            status: options.status,
            errorMessage: options.errorMessage ?? null,
            details: options.details ?? null,
        };
        const log = new AuditLog_1.default(logData);
        await log.save();
        return log;
    }
    catch (error) {
        console.error('[AuditLogger] Impossible de sauvegarder le log :', error);
        return null;
    }
}
exports.default = logAuditEvent;
