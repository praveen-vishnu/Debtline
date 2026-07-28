import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePasskey, isPasskeyMatch, hasStoredPasskey } from '../src/lib/accessControl.js';

test('normalizes passkeys consistently', () => {
  assert.equal(normalizePasskey('  MyPass123  '), 'mypass123');
  assert.equal(normalizePasskey('my-pass'), 'my-pass');
});

test('matches passkeys case-insensitively', () => {
  assert.equal(isPasskeyMatch('MyPass123', 'mypass123'), true);
  assert.equal(isPasskeyMatch('demo', 'other'), false);
});

test('detects whether a passkey is already stored', () => {
  const saved = 'demo-key';
  assert.equal(hasStoredPasskey(saved), true);
  assert.equal(hasStoredPasskey(''), false);
});
