const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Next App Router has a dedicated page for every primary dashboard section', () => {
  const pages = [
    'app/dashboard/page.tsx',
    'app/dashboard/[guildId]/page.tsx',
    'app/dashboard/[guildId]/general/page.tsx',
    'app/dashboard/[guildId]/moderation/page.tsx',
    'app/dashboard/[guildId]/automod/page.tsx',
    'app/dashboard/[guildId]/anti-raid/page.tsx',
    'app/dashboard/[guildId]/anti-spam/page.tsx',
    'app/dashboard/[guildId]/anti-link/page.tsx',
    'app/dashboard/[guildId]/security/page.tsx',
    'app/dashboard/[guildId]/verification/page.tsx',
    'app/dashboard/[guildId]/honeypot/page.tsx',
    'app/dashboard/[guildId]/welcome/page.tsx',
    'app/dashboard/[guildId]/goodbye/page.tsx',
    'app/dashboard/[guildId]/auto-role/page.tsx',
    'app/dashboard/[guildId]/reaction-roles/page.tsx',
    'app/dashboard/[guildId]/suggestions/page.tsx',
    'app/dashboard/[guildId]/polls/page.tsx',
    'app/dashboard/[guildId]/giveaways/page.tsx',
    'app/dashboard/[guildId]/levels/page.tsx',
    'app/dashboard/[guildId]/counting/page.tsx',
    'app/dashboard/[guildId]/auto-reactions/page.tsx',
    'app/dashboard/[guildId]/scheduled-messages/page.tsx',
    'app/dashboard/[guildId]/custom-commands/page.tsx',
    'app/dashboard/[guildId]/tickets/page.tsx',
    'app/dashboard/[guildId]/logs/page.tsx',
    'app/dashboard/[guildId]/statistics/page.tsx',
    'app/dashboard/[guildId]/ping/page.tsx',
    'app/dashboard/[guildId]/economy/page.tsx',
    'app/dashboard/[guildId]/shop/page.tsx',
    'app/dashboard/[guildId]/ai/page.tsx',
    'app/dashboard/[guildId]/backups/page.tsx',
    'app/dashboard/[guildId]/settings/page.tsx',
  ];
  for (const file of pages) assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
});

test('Next dashboard remains behind the existing Express authentication and guild-access middleware', () => {
  const source = read('src/api/app.ts');
  const mount = source.indexOf("app.use('/dashboard/:guildId', requireAuthentication, requireGuildAccess, dispatchNextDashboard)");
  const legacy = source.indexOf("app.get(\n  '/dashboard/:guildId'");
  assert.ok(mount >= 0 && legacy > mount, 'Next dispatch must be registered before legacy dashboard EJS route');
  assert.match(source, /app\.use\('\/dashboard', requireAuthentication, dispatchNextDashboard\)/);
  assert.match(source, /app\.use\('\/_next', dispatchNextDashboard\)/);
});

test('existing Mongo guild cache schema persists dashboard fields', () => {
  const source = read('src/models/User.ts');
  assert.match(source, /memberCount:\s*\{/);
  assert.match(source, /features:\s*\{/);
});

test('existing MongoDB and MySQL dependencies are retained alongside Next.js', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies.mongoose);
  assert.ok(pkg.dependencies.mysql2);
  assert.ok(pkg.dependencies.express);
  assert.ok(pkg.dependencies.next);
  assert.ok(pkg.dependencies.react);
});
