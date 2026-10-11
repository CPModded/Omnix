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
exports.EmailMessage = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const attachment = new mongoose_1.Schema({ name: String, contentType: String, size: Number, url: String }, { _id: false });
const schema = new mongoose_1.Schema({
    threadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'EmailThread', required: true, index: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    from: { type: String, required: true },
    to: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    subject: { type: String, required: true, maxlength: 500 },
    text: { type: String, default: '', maxlength: 200000 },
    html: { type: String, maxlength: 500000 },
    attachments: { type: [attachment], default: [] },
    providerId: { type: String, index: true, sparse: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
schema.index({ threadId: 1, createdAt: 1 });
exports.EmailMessage = mongoose_1.default.models.EmailMessage || mongoose_1.default.model('EmailMessage', schema);
exports.default = exports.EmailMessage;
