const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('npm start checks and installs missing production dependencies before launching', () => {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.prestart, 'node scripts/ensure-production-deps.cjs');
  assert.equal(pkg.scripts.start, 'node index.js');
  assert.ok(pkg.dependencies.mongoose, 'mongoose must be a production dependency');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'ensure-production-deps.cjs')));
  assert.ok(fs.existsSync(path.join(root, 'dist', 'index.js')));
});
