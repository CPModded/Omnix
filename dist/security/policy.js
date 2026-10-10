"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safePath = safePath;
exports.assertDeveloper = assertDeveloper;
exports.assertBranchWritable = assertBranchWritable;
const node_path_1 = __importDefault(require("node:path"));
const env_js_1 = require("../config/env.js");
const BLOCKED = [
    /^\.env(?:\..*)?$/i, /(^|\/)\.env(?:\..*)?$/i, /(^|\/)(secrets?|credentials?|private)(\/|$)/i,
    /\.(?:pem|key|p12|pfx|crt|cer)$/i, /(^|\/)node_modules(\/|$)/, /(^|\/)\.git(\/|$)/
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
    const absolute = node_path_1.default.resolve(env_js_1.env.root, normalized);
    const root = node_path_1.default.resolve(env_js_1.env.root) + node_path_1.default.sep;
    if (absolute !== node_path_1.default.resolve(env_js_1.env.root) && !absolute.startsWith(root))
        throw new Error('Path escapes OMNIX_ROOT');
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
