/* eslint-disable jsdoc/require-jsdoc */

/**
 * Implement a Promise wrapper for the IndexedDB API.
 */
export default class IndexedDB {
  /**
   * Initialize a new `IndexedDB` instance.
   * @param {string} databaseName Database name.
   * @param {string} storeName Store name.
   */
  constructor(databaseName, storeName) {
    this.database = undefined;
    this.databaseName = databaseName;
    this.storeName = storeName;
  }

  /**
   * Create a database if not yet initialized, then execute the given function over the store.
   * @param {(store: IDBObjectStore) => IDBRequest | void} getRequest Function to be executed.
   * @returns {Promise<any>} Result.
   */
  async #query(getRequest) {
    this.database ||= await new Promise((resolve) => {
      const request = window.indexedDB.open(this.databaseName, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });

    return new Promise((resolve) => {
      const transaction = this.database.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = getRequest(store);

      if (request) {
        request.onsuccess = () => {
          resolve(request.result);
        };
      } else {
        transaction.oncomplete = () => {
          resolve();
        };
      }
    });
  }

  /**
   * Save single value.
   * @param {string} key Property key.
   * @param {any} value Property value.
   * @returns {Promise<string>} Property key.
   */
  async set(key, value) {
    return this.#query((store) => store.put(value, key));
  }

  /**
   * Save multiple values.
   * @param {[string, any][]} entries Property key/value pairs.
   * @returns {Promise<string>} Property key.
   */
  async setAll(entries) {
    return this.#query((store) => {
      entries.forEach(([key, value]) => {
        store.put(value, key);
      });
    });
  }

  /**
   * Retrieve value by key.
   * @param {string} key Property key.
   * @returns {Promise<any>} Property value.
   */
  async get(key) {
    return this.#query((store) => store.get(key));
  }

  /**
   * Retrieve all values.
   * @returns {Promise<any[]>} Property values.
   */
  async getAll() {
    return this.#query((store) => store.getAll());
  }

  /**
   * Delete value by key.
   * @param {string} key Property key.
   * @returns {Promise<undefined>} Result.
   */
  async delete(key) {
    return this.#query((store) => store.delete(key));
  }

  /**
   * Delete all values.
   * @returns {Promise<undefined>} Result.
   */
  async clear() {
    return this.#query((store) => store.clear());
  }
}
