"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safePath = safePath;
exports.assertDeveloper = assertDeveloper;
exports.assertBranchWritable = assertBranchWritable;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = require("node:fs");
const env_js_1 = require("../config/env.js");
const BLOCKED = [
    /^\.env(?:\..*)?$/i, /(^|\/)\.env(?:\..*)?$/i, /(^|\/)(secrets?|credentials?|private)(\/|$)/i,
    /\.(?:pem|key|p12|pfx|crt|cer)$/i, /(^|\/)node_modules(\/|$)/, /(^|\/)\.git(\/|$)/, /(^|\/)\.omnix-agent-backups(\/|$)/
];
const WRITE_BLOCKED = [/package-lock\.json$/i, /pnpm-lock\.yaml$/i, /yarn\.lock$/i];
function safePath(relative, write = false) {
    const normalized = relative.replaceAll('\\', '/').replace(/^\/+/, '');
    if (normalized === '' || normalized === '.')
        return node_path_1.default.resolve(env_js_1.env.root);
    if (normalized.includes('..'))
        throw new Error('Invalid project path');
    if (BLOCKED.some(r => r.test(normalized)))
        throw new Error('Protected path');
    if (write && WRITE_BLOCKED.some(r => r.test(normalized)))
        throw new Error('Lockfile writes are blocked');
    const rootPath = node_path_1.default.resolve(env_js_1.env.root);
    const absolute = node_path_1.default.resolve(rootPath, normalized);
    const rootBoundary = rootPath + node_path_1.default.sep;
    if (absolute !== rootPath && !absolute.startsWith(rootBoundary))
        throw new Error('Path escapes OMNIX_ROOT');
    // Prevent a symlink inside the project from redirecting reads/writes outside OMNIX_ROOT.
    const realRoot = (0, node_fs_1.realpathSync)(rootPath);
    let probe = absolute;
    while (!(0, node_fs_1.existsSync)(probe)) {
        const parent = node_path_1.default.dirname(probe);
        if (parent === probe)
            throw new Error('Invalid project path');
        probe = parent;
    }
    const realProbe = (0, node_fs_1.realpathSync)(probe);
    if (realProbe !== realRoot && !realProbe.startsWith(realRoot + node_path_1.default.sep))
        throw new Error('Path resolves outside OMNIX_ROOT');
    if ((0, node_fs_1.existsSync)(absolute)) {
        const realTarget = (0, node_fs_1.realpathSync)(absolute);
        if (realTarget !== realRoot && !realTarget.startsWith(realRoot + node_path_1.default.sep))
            throw new Error('Path resolves outside OMNIX_ROOT');
    }
    return absolute;
}
function assertDeveloper(apiKey) {
    if (!env_js_1.env.apiKey || !apiKey || apiKey !== env_js_1.env.apiKey)
        throw new Error('Developer authentication required');
}
function assertBranchWritable(branch) {
    if (branch === env_js_1.env.github.defaultBranch && !env_js_1.env.github.allowMainWrite)
        throw new Error('Direct writes to the default branch are disabled');
}
