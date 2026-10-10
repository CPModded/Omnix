"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFiles = listFiles;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.deleteFile = deleteFile;
exports.recentProjectLogs = recentProjectLogs;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const policy_js_1 = require("../security/policy.js");
const env_js_1 = require("../config/env.js");
const BACKUP_DIR = '.omnix-agent-backups';
const MAX_READ_BYTES = 500_000;
const MAX_WRITE_BYTES = 1_000_000;
async function backupExistingFile(target, relative) {
    try {
        const stat = await promises_1.default.lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink())
            throw new Error('Seuls les fichiers ordinaires peuvent être modifiés ou supprimés par l’agent.');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const relativeSafe = relative.replaceAll('\\', '/').replace(/^\/+/, '').split('/').map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_')).join('__');
        const backupRoot = node_path_1.default.join(node_path_1.default.resolve(env_js_1.env.root), BACKUP_DIR);
        await promises_1.default.mkdir(backupRoot, { recursive: true, mode: 0o700 });
        const backup = node_path_1.default.join(backupRoot, `${stamp}-${process.pid}-${Math.random().toString(36).slice(2, 8)}__${relativeSafe}`);
        await promises_1.default.copyFile(target, backup, node_fs_1.constants.COPYFILE_EXCL);
        return node_path_1.default.relative(node_path_1.default.resolve(env_js_1.env.root), backup).replaceAll('\\', '/');
    }
    catch (error) {
        if (error?.code === 'ENOENT')
            return null;
        throw error;
    }
}
async function listFiles(relative = '.', depth = 2) {
    const root = (0, policy_js_1.safePath)(relative);
    const out = [];
    const maxDepth = Math.max(0, Math.min(5, Number(depth) || 0));
    async function walk(dir, d) {
        if (d < 0)
            return;
        for (const entry of await promises_1.default.readdir(dir, { withFileTypes: true })) {
            if (entry.name === BACKUP_DIR)
                continue;
            const rel = node_path_1.default.relative(env_js_1.env.root, node_path_1.default.join(dir, entry.name)).replaceAll('\\', '/');
            try {
                (0, policy_js_1.safePath)(rel);
            }
            catch {
                continue;
            }
            out.push(rel);
            if (entry.isDirectory() && !entry.isSymbolicLink())
                await walk(node_path_1.default.join(dir, entry.name), d - 1);
        }
    }
    await walk(root, maxDepth);
    return out.slice(0, 5_000);
}
async function readFile(relative, maxBytes = MAX_READ_BYTES) {
    const target = (0, policy_js_1.safePath)(relative);
    const stat = await promises_1.default.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error('Seuls les fichiers ordinaires peuvent être lus.');
    const data = await promises_1.default.readFile(target);
    if (data.byteLength > maxBytes)
        throw new Error('File exceeds read limit');
    return data.toString('utf8');
}
async function writeFile(relative, content) {
    const target = (0, policy_js_1.safePath)(relative, true);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_WRITE_BYTES)
        throw new Error('File exceeds write limit');
    const backup = await backupExistingFile(target, relative);
    await promises_1.default.mkdir(node_path_1.default.dirname(target), { recursive: true });
    const temporary = `${target}.omnix-tmp-${process.pid}-${Date.now()}`;
    try {
        await promises_1.default.writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        await promises_1.default.rename(temporary, target);
    }
    catch (error) {
        await promises_1.default.rm(temporary, { force: true }).catch(() => undefined);
        throw error;
    }
    return { bytes, backup };
}
async function deleteFile(relative) {
    const target = (0, policy_js_1.safePath)(relative, true);
    const backup = await backupExistingFile(target, relative);
    if (!backup)
        throw new Error('Fichier introuvable ; aucune suppression effectuée.');
    await promises_1.default.rm(target, { force: false });
    return { backup };
}
/** Reads recent .log files from the project's known log folders, never recursively scanning the whole project. */
async function recentProjectLogs(maxLines = 150) {
    const limit = Math.max(20, Math.min(300, Math.floor(Number(maxLines) || 150)));
    const root = node_path_1.default.resolve(env_js_1.env.root);
    const candidates = [node_path_1.default.join(root, 'logs'), node_path_1.default.join(root, 'log')];
    const found = [];
    const redact = (line) => line
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]')
        .replace(/((?:MAMMOUTH_API_KEY|DISCORD_TOKEN|BOT_TOKEN|PTERO_API_TOKEN|MCP_API_KEY|MYSQL_PASSWORD|MONGODB_URI)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]')
        .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[CLÉ API MASQUÉE]');
    for (const folder of candidates) {
        try {
            for (const entry of await promises_1.default.readdir(folder, { withFileTypes: true })) {
                if (!entry.isFile() || !/\.(?:log|out|err)$/i.test(entry.name))
                    continue;
                const full = node_path_1.default.join(folder, entry.name);
                const stat = await promises_1.default.stat(full);
                if (stat.size > 2_000_000)
                    continue;
                const content = await promises_1.default.readFile(full, 'utf8');
                found.push({ path: node_path_1.default.relative(root, full).replaceAll('\\', '/'), lines: content.split(/\r?\n/).filter(Boolean).slice(-limit).map(redact), mtime: stat.mtimeMs });
            }
        }
        catch { /* log folder may not exist on this host */ }
    }
    found.sort((a, b) => b.mtime - a.mtime);
    return { source: 'fichiers de logs locaux du projet', retrievedAt: new Date().toISOString(), files: found.slice(0, 10).map(({ path: filePath, lines }) => ({ path: filePath, lines })) };
}
