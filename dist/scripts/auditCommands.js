"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../bot/client");
const commandAudit_1 = require("../bot/handlers/commandAudit");
(async () => {
    const result = await (0, commandAudit_1.auditCommands)(client_1.client);
    process.exitCode = result.missing.length || result.undeployable.length || result.duplicates.length ? 1 : 0;
})().catch((error) => {
    console.error('[CommandAudit] Échec :', error);
    process.exitCode = 1;
});
