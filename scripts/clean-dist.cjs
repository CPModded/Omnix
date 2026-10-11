const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '..', 'dist');
if (dist === path.resolve(__dirname, '..') || !dist.endsWith(`${path.sep}dist`)) throw new Error('Refusing unsafe dist cleanup');
fs.rmSync(dist, { recursive: true, force: true });
