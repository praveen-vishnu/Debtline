const STORAGE_KEY = 'debtline-edit-passkey';

export function normalizePasskey(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isPasskeyMatch(input, saved) {
  return normalizePasskey(input) === normalizePasskey(saved);
}

export function hasStoredPasskey(value = '') {
  return normalizePasskey(value).length > 0;
}

export function savePasskey(passkey) {
  const normalized = normalizePasskey(passkey);
  if (!normalized) return null;
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function loadPasskey() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function clearPasskey() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isPasskeyConfigured() {
  return hasStoredPasskey(loadPasskey());
}
