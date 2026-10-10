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
const env_js_1 = require("./config/env.js");
const policy_js_1 = require("./security/policy.js");
const fs = __importStar(require("./tools/filesystem.js"));
const gh = __importStar(require("./tools/github.js"));
const ep = __importStar(require("./tools/eternodes.js"));
const deployment_js_1 = require("./tools/deployment.js");
const audit_js_1 = require("./audit.js");
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
        case 'write_file':
            await fs.writeFile(String(args.path), String(args.content ?? ''));
            return { ok: true };
        case 'delete_file':
            await fs.deleteFile(String(args.path));
            return { ok: true };
        case 'github_status': return gh.githubStatus();
        case 'github_commits': return gh.listRecentCommits(Number(args.limit ?? 10));
        case 'github_create_branch': return gh.createBranch(String(args.branch), String(args.from ?? env_js_1.env.github.defaultBranch));
        case 'github_create_pr': return gh.createPullRequest(String(args.head), String(args.title), String(args.body ?? ''));
        case 'eternodes_status': return ep.serverStatus();
        case 'eternodes_restart': return ep.sendPower('restart');
        default: throw new Error(`Unknown MCP tool: ${name}`);
    }
}
const toolDefinitions = [
    { name: 'list_files', description: 'List safe project files.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, depth: { type: 'number' } } } },
    { name: 'read_file', description: 'Read a safe project file.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
    { name: 'write_file', description: 'Write a safe project file. Protected files are blocked.', inputSchema: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } },
    { name: 'delete_file', description: 'Delete a safe project file.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
    { name: 'github_status', description: 'Read the configured Omnix GitHub repository status.', inputSchema: { type: 'object', properties: {} } },
    { name: 'github_commits', description: 'List recent Omnix GitHub commits.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
    { name: 'github_create_branch', description: 'Create a protected development branch from the default branch.', inputSchema: { type: 'object', required: ['branch'], properties: { branch: { type: 'string' }, from: { type: 'string' } } } },
    { name: 'github_create_pr', description: 'Create a pull request against the default branch.', inputSchema: { type: 'object', required: ['head', 'title'], properties: { head: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } } } },
    { name: 'eternodes_status', description: 'Read the configured Pterodactyl/Eternodes server status.', inputSchema: { type: 'object', properties: {} } },
    { name: 'eternodes_restart', description: 'Restart the configured Eternodes server.', inputSchema: { type: 'object', properties: {} } }
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
    app.delete('/api/file', auth, async (req, res) => { try {
        await fs.deleteFile(String(req.body.path));
        (0, audit_js_1.audit)('files.delete', 'ok');
        res.json({ ok: true });
    }
    catch (e) {
        (0, audit_js_1.audit)('files.delete', 'error');
        res.status(400).json({ error: e.message });
    } });
    app.get('/api/github/status', auth, async (_req, res) => res.json(await gh.githubStatus()));
    app.get('/api/github/commits', auth, async (req, res) => res.json(await gh.listRecentCommits(Number(req.query.limit ?? 10))));
    app.post('/api/github/branch', auth, async (req, res) => res.json(await gh.createBranch(String(req.body.branch), String(req.body.from ?? env_js_1.env.github.defaultBranch))));
    app.post('/api/github/pr', auth, async (req, res) => res.json(await gh.createPullRequest(String(req.body.head), String(req.body.title), String(req.body.body ?? ''))));
    app.get('/api/eternodes/status', auth, async (_req, res) => res.json(await ep.serverStatus()));
    app.post('/api/eternodes/restart', auth, async (_req, res) => res.json(await ep.sendPower('restart')));
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
                const result = await callTool(String(body.params?.name), body.params?.arguments ?? {});
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
