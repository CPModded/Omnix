"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = audit;
function audit(action, result, meta = {}) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'omnix-dev-bridge', action, result, ...meta }));
}
