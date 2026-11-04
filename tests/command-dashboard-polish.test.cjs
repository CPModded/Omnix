const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('all slash command replies pass through the Omnix embed and acknowledgement adapter', () => {
  const source = read('src/bot/handlers/commandHandler.ts');
  assert.match(source, /function omnixResponsePayload/);
  assert.match(source, /OMNIX · \$\{guildName\}/);
  assert.match(source, /function createOmnixInteraction/);
  assert.match(source, /pendingAcknowledgement/);
  assert.match(source, /pendingFirstReply/);
  assert.match(source, /}, 1800\)/);
});

test('slow Mongo interaction receipts cannot block command dispatch indefinitely', () => {
  const source = read('src/bot/events/interactionCreate.ts');
  assert.match(source, /Promise\.race/);
  assert.match(source, /resolve\('timeout'\), 700/);
});

test('dashboard navigation uses custom icons and provides both server-home routes', () => {
  const shell = read('src/dashboard-next/DashboardShell.tsx');
  assert.match(shell, /OmnixIcon/);
  assert.match(shell, /href="\/dashboard"/);
  assert.match(shell, /Accueil du serveur/);
  assert.match(shell, /Liste des serveurs/);
  assert.match(shell, /role-badge admin/);
  assert.match(shell, /role-badge owner/);
});

test('module suggestions are shuffled and limited to four items', () => {
  const page = read('src/dashboard-next/ModulePage.tsx');
  assert.match(page, /Math\.random\(\) \* \(i \+ 1\)/);
  assert.match(page, /items\.slice\(0, 4\)/);
});

test('dashboard module navigation uses semantic custom icon names rather than emoji glyphs', () => {
  const types = read('src/dashboard-next/types.ts');
  assert.match(types, /icon: 'shield'/);
  assert.match(types, /icon: 'grid'/);
  assert.doesNotMatch(types, /🎁|⚙️|✨|🛡️/u);
});
