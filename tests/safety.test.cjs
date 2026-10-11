const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { normalizePteroBaseUrl, classifyPteroResponse, redactSensitiveText } = require('../dist/tools/eternodes.js');
const { safePath } = require('../dist/security/policy.js');
const { normalizeMysqlConnectionString } = require('../dist/database/mysql-url.js');

test('normalizes Pterodactyl base URL without duplicate API path', () => {
  assert.equal(normalizePteroBaseUrl('https://panel.example/api/'), 'https://panel.example');
  assert.equal(normalizePteroBaseUrl('https://panel.example/'), 'https://panel.example');
  assert.equal(normalizePteroBaseUrl('https://panel.example/panel/api/client'), 'https://panel.example/panel');
});

test('rejects unsafe Pterodactyl URL forms', () => {
  assert.throws(() => normalizePteroBaseUrl('https://panel.example/server/abc'), /base du panel/);
  assert.throws(() => normalizePteroBaseUrl('https://user:password@panel.example'), /identifiants/);
  assert.throws(() => normalizePteroBaseUrl('file:///tmp/panel'), /HTTP ou HTTPS/);
});

test('distinguishes Cloudflare challenge from API authentication and permissions', () => {
  assert.equal(classifyPteroResponse(403, 'text/html', '<html><title>Just a moment...</title>Cloudflare</html>'), 'PTERO_EDGE_CHALLENGE');
  assert.equal(classifyPteroResponse(403, 'application/json', '{"errors":[]}'), 'PTERO_PERMISSION_DENIED');
  assert.equal(classifyPteroResponse(401, 'application/json', '{"errors":[]}'), 'PTERO_AUTH_REJECTED');
  assert.equal(classifyPteroResponse(404, 'application/json', '{}'), 'PTERO_NOT_FOUND');
});

test('redacts common secrets from diagnostics', () => {
  const input = 'MAMMOUTH_API_KEY=secret123 Authorization: Bearer abc.def ghp_abcdefghijklmnopqrstuvwxyz123456';
  const output = redactSensitiveText(input);
  assert.doesNotMatch(output, /secret123|abc\.def|ghp_abcdefghijklmnopqrstuvwxyz123456/);
  assert.match(output, /MASQUÉ/);
});

test('safePath blocks traversal, secret files and manifest/config writes', () => {
  assert.throws(() => safePath('../outside.txt'), /Invalid project path/);
  assert.throws(() => safePath('.env'), /Protected path/);
  assert.throws(() => safePath('package.json', true), /blocked/);
  assert.throws(() => safePath('.npmrc', true), /blocked/);
  assert.equal(path.basename(safePath('src/server.ts')), 'server.ts');
});

test('normalizes Eternodes JDBC MySQL URLs before URL parsing', () => {
  assert.equal(normalizeMysqlConnectionString('jdbc:mysql://db.example:3306/omnix'), 'mysql://db.example:3306/omnix');
  assert.equal(normalizeMysqlConnectionString('mysql://db.example:3306/omnix'), 'mysql://db.example:3306/omnix');
});
