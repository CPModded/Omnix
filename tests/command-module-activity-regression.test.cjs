const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('dashboard resolves module routes through the canonical MODULE_DETAILS key', () => {
  const page = read('src/dashboard-next/ModulePage.tsx');
  assert.match(page, /const moduleKey = detail\.key \|\| moduleId/);
  assert.doesNotMatch(page, /const MODULE_KEYS:/);
});

test('legacy module slugs are normalized before reads and writes', () => {
  const config = read('src/bot/utils/guildConfig.ts');
  assert.match(config, /'anti-raid': 'antiRaid'/);
  assert.match(config, /'auto-role': 'autoRole'/);
  assert.match(config, /'reaction-roles': 'reactionRoles'/);
  assert.match(config, /export function normalizeModuleKeys/);
  assert.match(config, /const normalized = normalizeModuleKeys\(existing\)/);
  assert.match(config, /let changed = stableSerialize\(repairedModules\) !== stableSerialize\(currentModules\)/);
});

test('module guard and command receive the same guild configuration snapshot', () => {
  const handler = read('src/bot/handlers/commandHandler.ts');
  assert.match(handler, /const context = await createCommandContext\(interaction\);[\s\S]*?ensureCommandModuleEnabled\(interaction, command, context\.guildConfig\)/);
  assert.doesNotMatch(handler, /'economy\.ts': 'economy'/);
});

test('command execution emits start and terminal events with a shared execution id', () => {
  const interaction = read('src/bot/events/interactionCreate.ts');
  const model = read('src/models/PlatformEvent.ts');
  const routes = read('src/api/routes/guild.routes.ts');
  const shell = read('src/dashboard-next/DashboardShell.tsx');
  assert.match(interaction, /recordPlatformEvent\('command_started'/);
  assert.match(interaction, /recordPlatformEvent\('command_executed'/);
  assert.match(interaction, /recordPlatformEvent\('command_blocked'/);
  assert.match(interaction, /sendTyping\(\)/);
  assert.match(model, /'command_started'/);
  assert.match(model, /'command_blocked'/);
  assert.match(routes, /scope.*commands/);
  assert.match(shell, /CommandActivity/);
  assert.match(shell, /activity\?scope=commands/);
});
