import Store from 'electron-store';

const ENCRYPTION_KEY = 'crossflow-settings';

let _store: Store | null = null;

export function getStore(): Store {
  if (!_store) {
    _store = new Store({ encryptionKey: ENCRYPTION_KEY });
  }
  return _store;
}
