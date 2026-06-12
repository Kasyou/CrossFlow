// Secure credential storage using Electron's safeStorage (OS-level encryption).
// Replaces the hardcoded electron-store encryption key pattern.
//
// safeStorage uses:
//   - Windows: DPAPI (Data Protection API)
//   - macOS:   Keychain Services
//   - Linux:   libsecret (GNOME Keyring / KDE Wallet)
//
// Migration path: old electron-store values are re-encrypted on first access.

import { safeStorage } from 'electron';
import Store from 'electron-store';

let _legacyStore: Store | null = null;

function getLegacyStore(): Store {
  if (!_legacyStore) {
    _legacyStore = new Store({ encryptionKey: 'crossflow-settings' });
  }
  return _legacyStore;
}

/** Encrypt a string with the OS keychain. Returns base64-encoded ciphertext. */
export function encryptSecret(plaintext: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this platform');
  }
  const encrypted = safeStorage.encryptString(plaintext);
  return encrypted.toString('base64');
}

/** Decrypt a base64-encoded ciphertext. Returns the original plaintext. */
export function decryptSecret(ciphertext: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this platform');
  }
  const buffer = Buffer.from(ciphertext, 'base64');
  return safeStorage.decryptString(buffer);
}

/** Get a setting, transparently migrating from legacy electron-store to safeStorage. */
export function getSecureSetting(key: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: read from legacy store if safeStorage unavailable
    return getLegacyStore().get(key, null) as string | null;
  }

  const legacy = getLegacyStore();
  // Try new format first
  const raw = legacy.get(`secure:${key}`, null) as string | null;
  if (raw !== null) {
    try { return decryptSecret(raw); } catch { /* fall through to legacy */ }
  }

  // Migration: read old plaintext value, re-encrypt with safeStorage
  const oldVal = legacy.get(key, null) as string | null;
  if (oldVal !== null && oldVal !== '') {
    setSecureSetting(key, oldVal);
    legacy.delete(key); // Remove old key after migration
    return oldVal;
  }
  return null;
}

/** Store a setting encrypted via safeStorage. */
export function setSecureSetting(key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    getLegacyStore().set(key, value);
    return;
  }
  const encrypted = encryptSecret(value);
  getLegacyStore().set(`secure:${key}`, encrypted);
}

/** Encrypt an entire JSON object for database storage. */
export function encryptJson(data: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(data));
}

/** Decrypt a JSON object from database storage. */
export function decryptJson(ciphertext: string): Record<string, unknown> | null {
  try {
    return JSON.parse(decryptSecret(ciphertext));
  } catch {
    return null;
  }
}

/** Migrate a legacy plaintext DB value to safeStorage. Returns the plaintext. */
export function migrateLegacyDbValue(ciphertext: string): string | null {
  // If it looks like base64, try safeStorage first
  if (ciphertext.length > 40 && ciphertext.match(/^[A-Za-z0-9+/=]+$/)) {
    try {
      return decryptSecret(ciphertext);
    } catch {
      // Not valid safeStorage — might already be plaintext JSON
    }
  }
  // Legacy plaintext: re-encrypt and return
  return ciphertext;
}
