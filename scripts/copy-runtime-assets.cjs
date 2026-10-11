'use strict';
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..', 'src');
const destination = path.resolve(__dirname, '..', 'dist');
if (!source.endsWith(`${path.sep}src`) || !destination.endsWith(`${path.sep}dist`)) {
  throw new Error('Refusing unsafe runtime asset copy');
}
function copyAssets(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyAssets(src, dest);
    } else if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}
copyAssets(source, destination);
console.log('[Build] Runtime assets copied to dist/.');
