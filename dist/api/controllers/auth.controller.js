"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordCallback = discordCallback;
async function discordCallback(_req, res) {
    return res.status(410).json({ success: false, error: 'Endpoint OAuth obsolète. Utilisez /api/auth/callback.', code: 'AUTH_CONTROLLER_DEPRECATED' });
}
