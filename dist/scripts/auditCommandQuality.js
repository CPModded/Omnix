"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const root = node_path_1.default.resolve(process.cwd(), 'src/bot/commands');
function walk(directory) {
    return node_fs_1.default.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const full = node_path_1.default.join(directory, entry.name);
        if (entry.isDirectory())
            return walk(full);
        return entry.name.endsWith('.ts') ? [full] : [];
    });
}
const files = walk(root).sort();
const reviews = [];
for (const file of files) {
    const source = node_fs_1.default.readFileSync(file, 'utf8');
    const name = source.match(/\.setName\(['"]([^'"]+)['"]\)/)?.[1] || null;
    const notes = [];
    const hasBuilder = /new\s+SlashCommandBuilder\s*\(/.test(source);
    const hasExecute = /execute\s*\(/.test(source);
    const hasDescription = /\.setDescription\(/.test(source);
    const hasPermissionGuard = /PermissionFlagsBits|memberPermissions|permissionsFor|setDefaultMemberPermissions/.test(source);
    const hasGuildGuard = /interaction\.guild(Id)?\b|interaction\.guild\b/.test(source);
    const hasTryCatch = /try\s*\{[\s\S]*catch\s*\(/.test(source);
    const optionsCount = (source.match(/\.add(?:String|User|Role|Channel|Boolean|Integer|Number|Attachment|Mentionable)Option\(/g) || []).length;
    if (!hasBuilder)
        notes.push('Pas de SlashCommandBuilder détecté');
    if (!hasExecute)
        notes.push('execute() manquant');
    if (!hasDescription)
        notes.push('Description manquante');
    if (hasGuildGuard && !hasPermissionGuard && /delete|ban|kick|mute|warn|clear|purge|lock|unlock|role-|channel-|nuke|massban|timeout|deafen|disconnect/i.test(name || file)) {
        notes.push('Vérifier les permissions pour une commande sensible');
    }
    if (!hasTryCatch)
        notes.push('Pas de try/catch local; le handler global couvre l’erreur');
    reviews.push({ file: node_path_1.default.relative(root, file), name, hasBuilder, hasExecute, hasDescription, hasPermissionGuard, hasGuildGuard, hasTryCatch, optionsCount, notes });
}
const report = [
    '# OMNIX — Audit qualité des commandes',
    '',
    `- Commandes découvertes : **${reviews.length}**`,
    `- Builders : **${reviews.filter(r => r.hasBuilder).length}/${reviews.length}**`,
    `- execute() : **${reviews.filter(r => r.hasExecute).length}/${reviews.length}**`,
    `- Descriptions : **${reviews.filter(r => r.hasDescription).length}/${reviews.length}**`,
    '',
    '| Commande | Builder | execute | Description | Permissions | Guild | Options | Notes |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...reviews.map(r => `| \/${r.name || '?'} | ${r.hasBuilder ? '✓' : '✗'} | ${r.hasExecute ? '✓' : '✗'} | ${r.hasDescription ? '✓' : '✗'} | ${r.hasPermissionGuard ? '✓' : '—'} | ${r.hasGuildGuard ? '✓' : '—'} | ${r.optionsCount} | ${r.notes.join('; ') || 'OK'} |`),
    '',
    '> Cet audit est statique : il ne remplace pas un test réel sur Discord avec les permissions et les variables d’environnement de production.',
].join('\n');
node_fs_1.default.writeFileSync(node_path_1.default.resolve(process.cwd(), 'COMMAND_QUALITY_AUDIT.md'), report);
console.log(report);
