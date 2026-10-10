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
exports.SupportTicket = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SupportMessageSchema = new mongoose_1.Schema({
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['user', 'support', 'moderator', 'admin', 'super_admin', 'owner'], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const SupportTicketSchema = new mongoose_1.Schema({
    ticketNumber: { type: Number, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 160 },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    messages: { type: [SupportMessageSchema], default: [] },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: null },
}, { timestamps: true, strict: true });
exports.SupportTicket = mongoose_1.default.models.SupportTicket || mongoose_1.default.model('SupportTicket', SupportTicketSchema);
exports.default = exports.SupportTicket;
