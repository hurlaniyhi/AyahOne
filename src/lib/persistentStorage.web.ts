// Web-only replacement for @react-native-async-storage/async-storage, whose
// web shim is backed by plain `localStorage`. iOS Safari's "Add to Home
// Screen" standalone PWAs have a long-documented WebKit history of losing
// localStorage-backed data across a force-quit + relaunch, even the same day
// — this is exactly the "app sees me as a first-time user every time I
// reopen it" symptom. IndexedDB transactions have an explicit durability
// contract (a transaction's `oncomplete` only fires once it's committed to
// disk) that localStorage's synchronous API does not guarantee under an
// abrupt process kill, so the persisted app-state blob is moved here for web
// only. Native is completely untouched — see persistentStorage.ts.
const DB_NAME = 'ayahone-storage';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export default {
  async getItem(key: string): Promise<string | null> {
    const fromIdb = await withStore<string | undefined>('readonly', store => store.get(key));
    if (fromIdb != null) return fromIdb;
    // One-time migration from the old localStorage-backed AsyncStorage shim
    // this app used before moving to IndexedDB, so upgrading users don't see
    // a fake "reset" the first time this ships.
    try {
      const legacy = window.localStorage.getItem(key);
      if (legacy != null) {
        await withStore('readwrite', store => store.put(legacy, key));
        return legacy;
      }
    } catch {
      /* noop */
    }
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await withStore('readwrite', store => store.put(value, key));
  },
  async removeItem(key: string): Promise<void> {
    await withStore('readwrite', store => store.delete(key));
  },
};
