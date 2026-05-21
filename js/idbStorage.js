// js/idbStorage.js
/* Jednoduchý wrapper nad IndexedDB
   - databáze: strongTranslatorDB
   - verze: 1
   - objectStore: kvStore (key‑value)
   - ukládá se jako strukturovaná kopie (hodnota je automaticky strukturovaně klonována)
   - všechny funkce vrací Promise
*/

const DB_NAME = 'strongTranslatorDB';
const STORE_NAME = 'kvStore';
const DB_VERSION = 1;

/**
 * Otevře (nebo vytvoří) databázi a vrátí připojený objekt DB.
 * Funkce je memoizovaná – při opakovaných voláních vrací stejný Promise.
 */
let dbPromise = null;
function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // vytvoření objectStore, pokud ještě neexistuje
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      // vzácné, ale pokud je DB otevřena jinde ve starší verzi, kterou potřebujeme upgradovat,
      // zavřeme ostatní připojení a pokusíme se znovu.
      const db = request.result;
      db.close();
      dbPromise = null;
      getDB().then(resolve, reject);
    };
  });

  return dbPromise;
}

/**
 * Uloží hodnotu pod daným klíčem.
 * @param {string} key   – klíč (string)
 * @param {any}    value – jakákoli hodnota (bude strukturovaně klonována)
 * @returns {Promise<void>}
 */
export function setItem(key, value) {
  return getDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      // Nezavíráme db po každé transakci – necháme otevřenou
    })
  );
}

/**
 * Načte hodnotu podle klíče.
 * @param {string} key – klíč
 * @returns {Promise<any|undefined>} – hodnota nebo undefined, pokud klíč neexistuje
 */
export function getItem(key) {
  return getDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result !== undefined ? result : undefined);
      };
      request.onerror = () => reject(request.error);
    })
  );
}

/**
 * Odstraní položku podle klíče.
 * @param {string} key – klíč
 * @returns {Promise<void>}
 */
export function removeItem(key) {
  return getDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    })
  );
}

/**
 * (Volitelné) Vyčistí celé úložiště – užitečné při vývoji nebo při resetu.
 * @returns {Promise<void>}
 */
export function clear() {
  return getDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    })
  );
}