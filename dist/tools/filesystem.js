"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFiles = listFiles;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.deleteFile = deleteFile;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const policy_js_1 = require("../security/policy.js");
const env_js_1 = require("../config/env.js");
async function listFiles(relative = '.', depth = 2) {
    const root = (0, policy_js_1.safePath)(relative);
    const out = [];
    async function walk(dir, d) {
        if (d < 0)
            return;
        for (const entry of await promises_1.default.readdir(dir, { withFileTypes: true })) {
            const rel = node_path_1.default.relative(env_js_1.env.root, node_path_1.default.join(dir, entry.name)).replaceAll('\\', '/');
            try {
                (0, policy_js_1.safePath)(rel);
            }
            catch {
                continue;
            }
            out.push(rel);
            if (entry.isDirectory())
                await walk(node_path_1.default.join(dir, entry.name), d - 1);
        }
    }
    await walk(root, depth);
    return out;
}
async function readFile(relative, maxBytes = 500_000) {
    const data = await promises_1.default.readFile((0, policy_js_1.safePath)(relative));
    if (data.byteLength > maxBytes)
        throw new Error('File exceeds read limit');
    return data.toString('utf8');
}
async function writeFile(relative, content) {
    const target = (0, policy_js_1.safePath)(relative, true);
    if (Buffer.byteLength(content, 'utf8') > 1_000_000)
        throw new Error('File exceeds write limit');
    await promises_1.default.mkdir(node_path_1.default.dirname(target), { recursive: true });
    await promises_1.default.writeFile(target, content, 'utf8');
}
async function deleteFile(relative) { await promises_1.default.rm((0, policy_js_1.safePath)(relative, true), { force: true }); }
