const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('API routes share the bot singleton and do not treat a cold guild cache as absence', () => {
  const entry = read('src/index.ts');
  const routes = read('src/api/routes/guild.routes.ts');
  assert.match(entry, /globalThis\s+as\s+any\)\.omnixDiscordClient\s*=\s*client/);
  assert.match(routes, /import\s*\{\s*client\s+as\s+botClient\s*\}\s*from\s*['"]\.\.\/\.\.\/bot\/client['"]/);
  assert.match(routes, /Boolean\(liveGuild\)\s*\|\|\s*await\s+isBotInGuild\(guild\.id\)/);
  assert.match(routes, /botInstalled:\s*botPresent/);
});

test('module writes fail explicitly when configured MySQL persistence cannot be verified', () => {
  const service = read('src/bot/utils/guildConfig.ts');
  const sql = read('src/database/mysql.ts');
  assert.match(service, /if\s*\(mysqlEnabled\)\s*\{[\s\S]*?saveGuildModules\(guildId, mergedModules\)[\s\S]*?if\s*\(!sqlSaved\)[\s\S]*?Échec de sauvegarde MySQL des modules/);
  assert.match(sql, /function stableJson\(/);
  assert.match(sql, /stableJson\(stored\)\s*===\s*stableJson\(modules\s*\?\?\s*\{\}\)/);
});

test('production JavaScript contains the same fixes as the TypeScript source', () => {
  assert.match(read('dist/index.js'), /globalThis\.omnixDiscordClient\s*=\s*client_js_1\.client/);
  assert.match(read('dist/api/routes/guild.routes.js'), /Boolean\(liveGuild\)\s*\|\|\s*await\s+isBotInGuild\(guild\.id\)/);
  assert.match(read('dist/bot/utils/guildConfig.js'), /Échec de sauvegarde MySQL des modules/);
});
