"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installFileLogger = installFileLogger;
const fs = require("node:fs");
const path = require("node:path");
const MAX_BYTES = 2 * 1024 * 1024;
const LOG_NAME = 'omnix-runtime.log';
const installedKey = Symbol.for('omnix.fileLogger.installed');
function redact(value) {
    return value
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]')
        .replace(/((?:MAMMOUTH_API_KEY|OPENROUTER_API_KEY|DISCORD_TOKEN|DISCORD_BOT_TOKEN|BOT_TOKEN|DISCORD_CLIENT_SECRET|PTERO_API_TOKEN|MCP_API_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|JWT_SECRET|SMTP_PASSWORD|MYSQL_PASSWORD|SFTP_PASSWORD|SFTP_PRIVATE_KEY|MONGODB_URI|MONGO_URI|DATABASE_URL|MYSQL_URL)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]')
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[JETON GITHUB MASQUÉ]')
        .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT MASQUÉ]')
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[CLÉ API MASQUÉE]');
}
function printable(value) {
    if (value instanceof Error)
        return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
    if (typeof value === 'string')
        return value;
    try { return JSON.stringify(value); }
    catch { return String(value); }
}
function appendLine(line) {
    try {
        const root = path.resolve(process.env.OMNIX_ROOT?.trim() || process.cwd());
        const dir = path.join(root, 'logs');
        const file = path.join(dir, LOG_NAME);
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        try {
            if (fs.existsSync(file) && fs.statSync(file).size >= MAX_BYTES) {
                const previous = `${file}.1`;
                try { fs.rmSync(previous, { force: true }); }
                catch { /* optional rotation */ }
                try { fs.renameSync(file, previous); }
                catch { /* keep logging to current file if rotation is unavailable */ }
            }
        }
        catch { /* logging must never crash the bot */ }
        fs.appendFileSync(file, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
    }
    catch { /* read-only hosts still retain their normal console output */ }
}
function installFileLogger() {
    const globalState = globalThis;
    if (globalState[installedKey])
        return;
    globalState[installedKey] = true;
    const levels = ['log', 'info', 'warn', 'error', 'debug'];
    for (const level of levels) {
        const original = console[level].bind(console);
        console[level] = ((...args) => {
            original(...args);
            const message = redact(args.map(printable).join(' ')).slice(0, 20000);
            appendLine(`${new Date().toISOString()} [${level.toUpperCase()}] ${message}`);
        });
    }
    process.on('uncaughtExceptionMonitor', error => {
        appendLine(`${new Date().toISOString()} [FATAL] ${redact(printable(error)).slice(0, 20000)}`);
    });
    process.on('unhandledRejection', reason => {
        appendLine(`${new Date().toISOString()} [UNHANDLED_REJECTION] ${redact(printable(reason)).slice(0, 20000)}`);
    });
}
