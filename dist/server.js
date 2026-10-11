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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const env_js_1 = require("./config/env.js");
const policy_js_1 = require("./security/policy.js");
const fs = __importStar(require("./tools/filesystem.js"));
const gh = __importStar(require("./tools/github.js"));
const ep = __importStar(require("./tools/eternodes.js"));
const sftp = __importStar(require("./tools/sftp.js"));
const deployment_js_1 = require("./tools/deployment.js");
const audit_js_1 = require("./audit.js");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function redactOutput(value) {
    return String(value ?? '')
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s\"']+/ig, '$1[MASQUÉ]')
        .replace(/((?:MAMMOUTH_API_KEY|OPENROUTER_API_KEY|DISCORD_TOKEN|DISCORD_BOT_TOKEN|BOT_TOKEN|DISCORD_CLIENT_SECRET|PTERO_API_TOKEN|MCP_API_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|JWT_SECRET|SMTP_PASSWORD|MYSQL_PASSWORD|SFTP_PASSWORD|SFTP_PRIVATE_KEY|MONGODB_URI|MONGO_URI|DATABASE_URL|MYSQL_URL)\s*[:=]\s*)[^\s,;\"']+/ig, '$1[MASQUÉ]')
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[JETON GITHUB MASQUÉ]')
        .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT MASQUÉ]')
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[CLÉ API MASQUÉE]');
}
function credentials(req) {
    const direct = req.header('x-omnix-api-key');
    if (direct)
        return direct;
    const auth = req.header('authorization');
    return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}
async function callTool(name, args = {}) {
    switch (name) {
        case 'list_files': return fs.listFiles(String(args.path ?? '.'), Number(args.depth ?? 2));
        case 'read_file': return fs.readFile(String(args.path));
        case 'write_file': {
            const result = await fs.writeFile(String(args.path), String(args.content ?? ''));
            (0, audit_js_1.audit)('files.write', 'ok', { path: String(args.path), bytes: result.bytes, backup: result.backup });
            return { ok: true, path: String(args.path), ...result };
        }
        case 'delete_file': {
            const target = String(args.path);
            if (String(args.confirmationPhrase ?? '') !== `SUPPRIMER ${target}`)
                throw new Error(`Confirmation requise : confirmationPhrase doit être exactement « SUPPRIMER ${target} ».`);
            const result = await fs.deleteFile(target);
            (0, audit_js_1.audit)('files.delete', 'ok', { path: target, backup: result.backup });
            return { ok: true, path: target, ...result };
        }
        case 'github_status': return gh.githubStatus();
        case 'github_commits': return gh.listRecentCommits(Number(args.limit ?? 10));
        case 'github_create_branch': return gh.createBranch(String(args.branch), String(args.from ?? env_js_1.env.github.defaultBranch));
        case 'github_create_pr': return gh.createPullRequest(String(args.head), String(args.title), String(args.body ?? ''));
        case 'eternodes_sftp_status': return sftp.sftpStatus();
        case 'eternodes_sftp_test': return sftp.testSftpConnection();
        case 'eternodes_sftp_list': return sftp.listRemoteFiles(String(args.path ?? '.'), Number(args.limit ?? 100));
        case 'eternodes_sftp_read': return sftp.readRemoteFile(String(args.path), Number(args.maxBytes ?? 500000));
        case 'eternodes_status': return ep.serverStatus();
        case 'eternodes_logs': return ep.consoleLogs(Number(args.lines ?? 150));
        case 'project_logs': return fs.recentProjectLogs(Number(args.lines ?? 150));
        case 'run_project_check': {
            const check = String(args.check ?? '');
            let command;
            let commandArgs;
            if (check === 'build') {
                command = process.execPath;
                commandArgs = [node_path_1.default.join(env_js_1.env.root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', (0, policy_js_1.safePath)('tsconfig.json')];
            }
            else if (check === 'test') {
                command = process.execPath;
                commandArgs = [(0, policy_js_1.safePath)('scripts/run-tests.cjs')];
            }
            else if (check === 'syntax') {
                const relative = String(args.path ?? '');
                if (!relative || !/\.(?:js|cjs|mjs)$/i.test(relative))
                    throw new Error('Le contrôle syntaxe exige un fichier .js, .cjs ou .mjs. Utilise le contrôle build pour TypeScript.');
                command = process.execPath;
                commandArgs = ['--check', (0, policy_js_1.safePath)(relative)];
            }
            else
                throw new Error('Contrôle refusé. Valeurs autorisées : build, test, syntax.');
            const startedAt = new Date().toISOString();
            try {
                const result = await execFileAsync(command, commandArgs, { cwd: env_js_1.env.root, timeout: 120_000, maxBuffer: 2_000_000, windowsHide: true });
                (0, audit_js_1.audit)('project.check', 'ok', { check });
                return { ok: true, check, startedAt, finishedAt: new Date().toISOString(), stdout: redactOutput(result.stdout).slice(-60_000), stderr: redactOutput(result.stderr).slice(-30_000) };
            }
            catch (error) {
                (0, audit_js_1.audit)('project.check', 'error', { check, exitCode: error?.code ?? null });
                return { ok: false, check, startedAt, finishedAt: new Date().toISOString(), exitCode: error?.code ?? null, stdout: redactOutput(error?.stdout).slice(-60_000), stderr: redactOutput(error?.stderr || error?.message).slice(-30_000) };
            }
        }
        case 'eternodes_restart': {
            if (String(args.confirmationPhrase ?? '') !== 'REDÉMARRER OMNIX')
                throw new Error('Confirmation requise : confirmationPhrase doit être exactement « REDÉMARRER OMNIX ».');
            const result = await ep.sendPower('restart');
            (0, audit_js_1.audit)('eternodes.restart', 'ok');
            return result;
        }
        default: throw new Error(`Unknown MCP tool: ${name}`);
    }
}
const toolDefinitions = [
    { name: 'list_files', description: 'List safe project files.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, depth: { type: 'number' } } } },
    { name: 'read_file', description: 'Read a safe project file.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
    { name: 'write_file', description: 'Create or modify a safe project file. Existing files are backed up before replacement; protected files and lockfiles are blocked.', inputSchema: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } },
    { name: 'delete_file', description: 'Delete a safe project file only after the current user message explicitly requests deletion of that exact path. A recoverable backup is created first. Requires confirmationPhrase exactly equal to SUPPRIMER followed by the path.', inputSchema: { type: 'object', required: ['path', 'confirmationPhrase'], properties: { path: { type: 'string' }, confirmationPhrase: { type: 'string', description: 'Must equal SUPPRIMER followed by the exact path.' } } } },
    { name: 'github_status', description: 'Read the configured Omnix GitHub repository status.', inputSchema: { type: 'object', properties: {} } },
    { name: 'github_commits', description: 'List recent Omnix GitHub commits.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
    { name: 'github_create_branch', description: 'Create a protected development branch from the default branch.', inputSchema: { type: 'object', required: ['branch'], properties: { branch: { type: 'string' }, from: { type: 'string' } } } },
    { name: 'github_create_pr', description: 'Create a pull request against the default branch.', inputSchema: { type: 'object', required: ['head', 'title'], properties: { head: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } } } },
    { name: 'eternodes_sftp_status', description: 'Show whether the SFTP connector is enabled and whether its environment variables are present. Never returns credentials.', inputSchema: { type: 'object', properties: {} } },
    { name: 'eternodes_sftp_test', description: 'Test the configured Eternodes SFTP connection and list a small sample of entries in the configured remote root.', inputSchema: { type: 'object', properties: {} } },
    { name: 'eternodes_sftp_list', description: 'List files and directories in the configured Eternodes SFTP root. Paths are confined to SFTP_REMOTE_ROOT; secret-like files are blocked.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'eternodes_sftp_read', description: 'Read a text file from Eternodes over SFTP, confined to SFTP_REMOTE_ROOT, up to 500 KB. Secret-like paths are blocked and common secrets are redacted.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, maxBytes: { type: 'number' } } } },
    { name: 'eternodes_status', description: 'Read the configured Pterodactyl/Eternodes server status and resource usage.', inputSchema: { type: 'object', properties: {} } },
    { name: 'eternodes_logs', description: 'Retrieve recent live console logs from Eternodes through the Pterodactyl WebSocket API. Requires console access permissions.', inputSchema: { type: 'object', properties: { lines: { type: 'number', description: 'Number of recent lines, from 20 to 300.' } } } },
    { name: 'project_logs', description: 'Read recent .log/.out/.err files from the known logs/ or log/ folders in the project, with secret-like values redacted.', inputSchema: { type: 'object', properties: { lines: { type: 'number' } } } },
    { name: 'run_project_check', description: 'Run only an allowlisted project verification: build (TypeScript compiler directly), test (scripts/run-tests.cjs), or syntax (node --check on a safe JavaScript file). No package scripts or arbitrary shell commands are executed.', inputSchema: { type: 'object', required: ['check'], properties: { check: { type: 'string', enum: ['build', 'test', 'syntax'] }, path: { type: 'string', description: 'Required for syntax; a relative .js/.cjs/.mjs path inside the project.' } } } },
    { name: 'eternodes_restart', description: 'Restart the configured Eternodes server only when the current user message explicitly requests a restart. Requires confirmationPhrase exactly equal to REDÉMARRER OMNIX.', inputSchema: { type: 'object', required: ['confirmationPhrase'], properties: { confirmationPhrase: { type: 'string', enum: ['REDÉMARRER OMNIX'] } } } }
];
function createServer() {
    const app = (0, express_1.default)();
    app.use('/webhooks/github', express_1.default.raw({ type: 'application/json', limit: '1mb' }));
    app.use(express_1.default.json({ limit: '1mb' }));
    const auth = (req, res, next) => {
        try {
            (0, policy_js_1.assertDeveloper)(credentials(req));
            next();
        }
        catch (e) {
            (0, audit_js_1.audit)('auth', 'error');
            res.status(401).json({ error: e.message });
        }
    };
    app.get('/health', (_req, res) => res.json({ ok: true, service: 'omnix-dev-bridge', mcp: true }));
    app.get('/api/files', auth, async (req, res) => { try {
        const data = await fs.listFiles(String(req.query.path ?? '.'), Number(req.query.depth ?? 2));
        (0, audit_js_1.audit)('files.list', 'ok');
        res.json(data);
    }
    catch (e) {
        (0, audit_js_1.audit)('files.list', 'error');
        res.status(400).json({ error: e.message });
    } });
    app.get('/api/file', auth, async (req, res) => { try {
        const data = await fs.readFile(String(req.query.path));
        (0, audit_js_1.audit)('files.read', 'ok');
        res.type('text/plain').send(data);
    }
    catch (e) {
        (0, audit_js_1.audit)('files.read', 'error');
        res.status(400).json({ error: e.message });
    } });
    app.put('/api/file', auth, async (req, res) => { try {
        await fs.writeFile(String(req.body.path), String(req.body.content ?? ''));
        (0, audit_js_1.audit)('files.write', 'ok', { path: req.body.path });
        res.json({ ok: true });
    }
    catch (e) {
        (0, audit_js_1.audit)('files.write', 'error');
        res.status(400).json({ error: e.message });
    } });
    app.delete('/api/file', auth, async (req, res) => { const target = String(req.body?.path ?? ''); if (req.body?.confirmationPhrase !== `SUPPRIMER ${target}`)
        return res.status(400).json({ error: `Confirmation requise : confirmationPhrase doit être exactement « SUPPRIMER ${target} ».` }); try {
        const result = await fs.deleteFile(target);
        (0, audit_js_1.audit)('files.delete', 'ok', { path: target, backup: result.backup });
        res.json({ ok: true, path: target, ...result });
    }
    catch (e) {
        (0, audit_js_1.audit)('files.delete', 'error', { path: target });
        res.status(400).json({ error: e.message });
    } });
    app.get('/api/github/status', auth, async (_req, res) => res.json(await gh.githubStatus()));
    app.get('/api/github/commits', auth, async (req, res) => res.json(await gh.listRecentCommits(Number(req.query.limit ?? 10))));
    app.post('/api/github/branch', auth, async (req, res) => res.json(await gh.createBranch(String(req.body.branch), String(req.body.from ?? env_js_1.env.github.defaultBranch))));
    app.post('/api/github/pr', auth, async (req, res) => res.json(await gh.createPullRequest(String(req.body.head), String(req.body.title), String(req.body.body ?? ''))));
    app.get('/api/eternodes/sftp/status', auth, (_req, res) => res.json(sftp.sftpStatus()));
    app.post('/api/eternodes/sftp/test', auth, async (_req, res) => { try {
        res.json(await sftp.testSftpConnection());
    }
    catch (e) {
        (0, audit_js_1.audit)('sftp.test', 'error');
        res.status(502).json({ error: e.message });
    } });
    app.get('/api/eternodes/sftp/files', auth, async (req, res) => { try {
        res.json(await sftp.listRemoteFiles(String(req.query.path ?? '.'), Number(req.query.limit ?? 100)));
    }
    catch (e) {
        (0, audit_js_1.audit)('sftp.list', 'error');
        res.status(400).json({ error: e.message });
    } });
    app.get('/api/eternodes/sftp/file', auth, async (req, res) => { try {
        res.json(await sftp.readRemoteFile(String(req.query.path ?? ''), Number(req.query.maxBytes ?? 500000)));
    }
    catch (e) {
        (0, audit_js_1.audit)('sftp.read', 'error');
        res.status(400).json({ error: e.message });
    } });
    app.get('/api/eternodes/status', auth, async (_req, res) => res.json(await ep.serverStatus()));
    app.post('/api/eternodes/restart', auth, async (req, res) => { if (req.body?.confirmationPhrase !== 'REDÉMARRER OMNIX')
        return res.status(400).json({ error: 'Confirmation requise : confirmationPhrase doit être REDÉMARRER OMNIX.' }); return res.json(await ep.sendPower('restart')); });
    app.post('/mcp', auth, async (req, res) => {
        try {
            const body = req.body ?? {};
            if (body.method === 'initialize')
                return res.json({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: body.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'omnix-dev-bridge', version: '1.0.0' } } });
            if (body.method === 'notifications/initialized')
                return res.status(202).end();
            if (body.method === 'tools/list')
                return res.json({ jsonrpc: '2.0', id: body.id, result: { tools: toolDefinitions } });
            if (body.method === 'tools/call') {
                const toolName = String(body.params?.name);
                const result = await callTool(toolName, body.params?.arguments ?? {});
                (0, audit_js_1.audit)(`tool.${toolName}`, 'ok');
                return res.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }], isError: false } });
            }
            return res.status(400).json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } });
        }
        catch (e) {
            return res.status(500).json({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32000, message: e.message } });
        }
    });
    app.post('/webhooks/github', async (req, res) => {
        if (!(0, deployment_js_1.verifyGithubSignature)(req.body, req.header('x-hub-signature-256')))
            return res.status(401).send('invalid signature');
        try {
            const event = req.header('x-github-event');
            if (event === 'push') {
                const payload = JSON.parse(req.body.toString('utf8'));
                await (0, deployment_js_1.deployFromMain)(payload.ref);
            }
            (0, audit_js_1.audit)('github.webhook', 'ok', { event });
            res.sendStatus(202);
        }
        catch (e) {
            (0, audit_js_1.audit)('github.webhook', 'error');
            res.status(500).json({ error: e.message });
        }
    });
    return app;
}
