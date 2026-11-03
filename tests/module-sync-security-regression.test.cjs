const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('command context loads the guild configuration and applies module gates', () => {
  const handler = read('src/bot/handlers/commandHandler.ts');
  assert.match(handler, /import \{ getGuildConfig \} from '\.\.\/utils\/guildConfig'/);
  assert.match(handler, /guildConfig = interaction\.guildId[\s\S]*?getGuildConfig\(interaction\.guildId\)/);
  assert.match(handler, /ensureCommandModuleEnabled\(interaction, command\)/);
  assert.match(handler, /moduleConfig\.enabled === true/);
});

test('AI slash and mention flows both require an explicitly enabled AI module', () => {
  const slash = read('src/bot/commands/ai.ts');
  const messages = read('src/bot/events/messageCreate.ts');
  assert.match(slash, /modules as any\)\?\.ai\?\.enabled !== true/);
  assert.match(messages, /if \(!aiModule \|\| aiModule\.enabled !== true\)/);
});

test('image quota is persistent and shared through the Mongo rate-limit model', () => {
  const service = read('src/services/AiService.ts');
  const messages = read('src/bot/events/messageCreate.ts');
  assert.match(service, /consumeAIImageAllowance/);
  assert.match(service, /ai-image:\$\{userId\}/);
  assert.match(messages, /await consumeAIImageAllowance/);
  assert.doesNotMatch(messages, /const imageUsage = new Map/);
});

test('AutoMod exempts staff before deletion and validates whitelist hostnames', () => {
  const security = read('src/bot/utils/securityEngine.ts');
  assert.match(security, /!message\.member \|\| isStaff\(message\.member\)\) return false/);
  assert.match(security, /hostname === domain \|\| hostname\.endsWith\(`\.\$\{domain\}`\)/);
  assert.doesNotMatch(security, /content\.toLowerCase\(\)\.includes\(domain\)/);
});

test('event handlers resolve guild module state through the canonical config service', () => {
  for (const file of [
    'src/bot/events/guildMemberAdd.ts',
    'src/bot/events/guildMemberRemove.ts',
    'src/bot/events/messageReactionAdd.ts',
    'src/bot/utils/securityEngine.ts',
  ]) {
    const source = read(file);
    assert.match(source, /getGuildConfig/);
    assert.doesNotMatch(source, /GuildConfig\.findOne/);
  }
});

test('module registry covers every default module exactly once', () => {
  const model = read('src/models/GuildConfig.ts');
  const registry = read('src/config/moduleRegistry.ts');
  const start = model.indexOf('export const defaultModules: IModulesConfig = {');
  const end = model.indexOf('\n};', start);
  const defaults = [...model.slice(start, end).matchAll(/^  ([A-Za-z][A-Za-z0-9]*):\s*\{/gm)].map((m) => m[1]);
  const registered = [...registry.matchAll(/key:'([^']+)'/g)].map((m) => m[1]);
  assert.equal(new Set(registered).size, registered.length, 'registry contains duplicate keys');
  assert.deepEqual([...registered].sort(), [...defaults].sort());
});

test('new guild configurations continue into the MySQL seeding path', () => {
  const config = read('src/bot/utils/guildConfig.ts');
  const creation = config.indexOf('Configuration créée : ${guildId}');
  const sqlSeed = config.indexOf('saveGuildModules(guildId, mergeModules(config.modules))');
  assert.ok(creation >= 0 && sqlSeed > creation);
  assert.doesNotMatch(config.slice(creation, sqlSeed), /return config;/);
});
