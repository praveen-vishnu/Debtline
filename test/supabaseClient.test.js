import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupabaseConfigValue } from '../src/lib/supabaseClient.js';

test('accepts a real Supabase URL and anon key', () => {
  assert.equal(
    isSupabaseConfigValue(
      'https://epaimxnxrjxfhfflmfko.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    ),
    true
  );
});

test('rejects placeholder values', () => {
  assert.equal(
    isSupabaseConfigValue('https://your-project-ref.supabase.co', 'your-anon-public-key'),
    false
  );
});
