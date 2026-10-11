import { env } from '../config/env.js';
import { assertBranchWritable } from '../security/policy.js';

async function github(path: string, init: RequestInit = {}) {
  if (!env.github.token) throw new Error('GITHUB_TOKEN is not configured');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.github.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${text.slice(0, 500)}`);
  return data;
}

const repoPath = () => `/repos/${encodeURIComponent(env.github.owner)}/${encodeURIComponent(env.github.repo)}`;

export async function githubStatus() {
  const r = await github(repoPath());
  return { fullName: r.full_name, defaultBranch: r.default_branch, private: r.private };
}

export async function getBranch(branch: string) {
  return github(`${repoPath()}/branches/${encodeURIComponent(branch)}`);
}

export async function createBranch(branch: string, from = env.github.defaultBranch) {
  assertBranchWritable(branch);
  const base = await getBranch(from);
  return github(`${repoPath()}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.commit.sha }) });
}

export async function createPullRequest(head: string, title: string, body: string) {
  return github(`${repoPath()}/pulls`, { method: 'POST', body: JSON.stringify({ head, base: env.github.defaultBranch, title, body }) });
}

export async function listRecentCommits(limit = 10) {
  const data = await github(`${repoPath()}/commits?per_page=${Math.min(Math.max(limit, 1), 30)}`);
  return data.map((c: any) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author?.name, date: c.commit.author?.date }));
}
