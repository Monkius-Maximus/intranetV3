'use strict';

// Runs against the compiled output (dist/), so `npm run build` must precede
// `npm test`. The offline bundle build does exactly that before packaging,
// validating the code against the pinned Node version.
const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('../dist/auth.js');

test('password hash roundtrip succeeds for the right password', () => {
  const hash = hashPassword('s3nha-correta', 10);
  assert.ok(verifyPassword('s3nha-correta', hash));
  assert.strictEqual(verifyPassword('senha-errada', hash), false);
});

test('verifyPassword returns false for a malformed hash (seed placeholder)', () => {
  assert.strictEqual(verifyPassword('qualquer', 'SET_AT_INSTALL'), false);
});

test('jwt sign/verify roundtrip preserves the payload', () => {
  const secret = 'segredo-de-teste';
  const token = signToken({ sub: 7, username: 'admin', role: 'admin' }, secret, 60);
  const payload = verifyToken(token, secret);
  assert.strictEqual(payload.sub, 7);
  assert.strictEqual(payload.username, 'admin');
  assert.strictEqual(payload.role, 'admin');
});

test('jwt verify fails with the wrong secret', () => {
  const token = signToken({ sub: 1, username: 'u', role: 'user' }, 'secret-a', 60);
  assert.throws(() => verifyToken(token, 'secret-b'));
});
