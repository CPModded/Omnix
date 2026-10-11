const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const node = process.execPath;
const localCompiler = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const compilerCommand = require('node:fs').existsSync(localCompiler) ? node : 'tsc';
const compilerArgs = require('node:fs').existsSync(localCompiler) ? [localCompiler, '-p', path.join(root, 'tsconfig.json')] : ['-p', path.join(root, 'tsconfig.json')];
const build = spawnSync(compilerCommand, compilerArgs, { cwd: root, stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);
const testFiles = require('node:fs').readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs')).map(name => path.join(root, 'tests', name));
if (!testFiles.length) { console.error('No deterministic tests found in tests/*.test.cjs'); process.exit(1); }
const tests = spawnSync(node, ['--test', ...testFiles], { cwd: root, stdio: 'inherit' });
if (tests.error) throw tests.error;
process.exit(tests.status || 0);
