"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditCommands = auditCommands;
const commandHandler_1 = require("./commandHandler");
async function auditCommands(client) {
    await (0, commandHandler_1.loadCommands)(client);
    const commands = (0, commandHandler_1.getCommands)(client);
    const status = client.omnixCommandLoadStatus || {};
    const missing = Array.isArray(status.missing) ? status.missing.map(String) : [];
    const names = new Map();
    const duplicates = [];
    const undeployable = [];
    for (const [name, command] of commands) {
        const key = name.toLowerCase();
        if (names.has(key))
            duplicates.push(name);
        names.set(key, name);
        if (!command?.data || typeof command.data.toJSON !== 'function')
            undeployable.push(name);
    }
    const result = {
        discovered: Number(status.discovered || 0),
        loaded: commands.size,
        deployable: commands.size - undeployable.length,
        missing,
        undeployable,
        duplicates,
    };
    console.log(`[CommandAudit] découvertes=${result.discovered} chargées=${result.loaded} déployables=${result.deployable}`);
    if (missing.length)
        console.warn(`[CommandAudit] non chargées: ${missing.join(', ')}`);
    if (undeployable.length)
        console.warn(`[CommandAudit] non déployables: ${undeployable.join(', ')}`);
    if (duplicates.length)
        console.warn(`[CommandAudit] doublons: ${duplicates.join(', ')}`);
    return result;
}
