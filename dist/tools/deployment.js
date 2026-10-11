"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGithubSignature = verifyGithubSignature;
exports.deployFromMain = deployFromMain;
const node_crypto_1 = __importDefault(require("node:crypto"));
const env_js_1 = require("../config/env.js");
const eternodes_js_1 = require("./eternodes.js");
function verifyGithubSignature(raw, signature) {
    if (!env_js_1.env.webhookSecret || !signature)
        return false;
    const expected = 'sha256=' + node_crypto_1.default.createHmac('sha256', env_js_1.env.webhookSecret).update(raw).digest('hex');
    try {
        return node_crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    catch {
        return false;
    }
}
async function deployFromMain(ref) {
    const expected = `refs/heads/${env_js_1.env.github.defaultBranch}`;
    if (ref !== expected)
        throw new Error('Ignored non-default branch push');
    return (0, eternodes_js_1.deployRestart)();
}
