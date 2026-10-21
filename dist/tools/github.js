"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubStatus = githubStatus;
exports.getBranch = getBranch;
exports.createBranch = createBranch;
exports.createPullRequest = createPullRequest;
exports.listRecentCommits = listRecentCommits;
const env_js_1 = require("../config/env.js");
const policy_js_1 = require("../security/policy.js");
async function github(path, init = {}) {
    if (!env_js_1.env.github.token)
        throw new Error('GITHUB_TOKEN is not configured');
    const response = await fetch(`https://api.github.com${path}`, {
        ...init,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env_js_1.env.github.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            ...(init.headers ?? {})
        }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok)
        throw new Error(`GitHub ${response.status}: ${text.slice(0, 500)}`);
    return data;
}
const repoPath = () => `/repos/${encodeURIComponent(env_js_1.env.github.owner)}/${encodeURIComponent(env_js_1.env.github.repo)}`;
async function githubStatus() {
    const r = await github(repoPath());
    return { fullName: r.full_name, defaultBranch: r.default_branch, private: r.private };
}
async function getBranch(branch) {
    return github(`${repoPath()}/branches/${encodeURIComponent(branch)}`);
}
async function createBranch(branch, from = env_js_1.env.github.defaultBranch) {
    (0, policy_js_1.assertBranchWritable)(branch);
    const base = await getBranch(from);
    return github(`${repoPath()}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.commit.sha }) });
}
async function createPullRequest(head, title, body) {
    return github(`${repoPath()}/pulls`, { method: 'POST', body: JSON.stringify({ head, base: env_js_1.env.github.defaultBranch, title, body }) });
}
async function listRecentCommits(limit = 10) {
    const data = await github(`${repoPath()}/commits?per_page=${Math.min(Math.max(limit, 1), 30)}`);
    return data.map((c) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author?.name, date: c.commit.author?.date }));
}
