const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRemotePath, sftpStatus } = require('../dist/tools/sftp.js');

test('SFTP path stays inside configured remote root', () => {
  assert.equal(normalizeRemotePath('src/index.js', '/home/container'), '/home/container/src/index.js');
  assert.equal(normalizeRemotePath('.', '/home/container'), '/home/container');
  assert.throws(() => normalizeRemotePath('../../etc/passwd', '/home/container'), /hors de SFTP_REMOTE_ROOT/);
  assert.throws(() => normalizeRemotePath('/etc/passwd', '/home/container'), /hors de SFTP_REMOTE_ROOT/);
});

test('SFTP blocks secret-like paths', () => {
  assert.throws(() => normalizeRemotePath('.env', '/home/container'), /potentiellement secret/);
  assert.throws(() => normalizeRemotePath('config/credentials.json', '/home/container'), /potentiellement secret/);
  assert.throws(() => normalizeRemotePath('certs/server.pem', '/home/container'), /potentiellement secret/);
});

test('SFTP status never exposes credentials and stays disabled by default', () => {
  const status = sftpStatus();
  assert.equal(status.enabled, false);
  assert.equal(Object.hasOwn(status, 'password'), false);
  assert.equal(Object.hasOwn(status, 'privateKey'), false);
});
