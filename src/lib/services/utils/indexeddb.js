/* eslint-disable jsdoc/require-jsdoc */

/**
 * Implement a wrapper for the IndexedDB API, making it easier to use the client-side database with
 * auto-upgrades and convenient Promise methods.
 */
export default class IndexedDB {
  /**
   * Database itself.
   * @type {IDBDatabase | undefined}
   */
  #database;

  /**
   * Database name in use.
   * @type {string}
   */
  #databaseName = '';

  /**
   * Store name in use.
   * @type {string}
   */
  #storeName = '';

  /**
   * Initialize a new `IndexedDB` instance.
   * @param {string} databaseName - Database name.
   * @param {string} storeName - Store name.
   */
  constructor(databaseName, storeName) {
    this.#database = undefined;
    this.#databaseName = databaseName;
    this.#storeName = storeName;
  }

  /**
   * Open the database and create a store if needed.
   * @param {number} [version] - Database version.
   * @returns {Promise<IDBDatabase>} Database.
   */
  async #openDatabase(version) {
    return new Promise((resolve) => {
      const request = window.indexedDB.open(this.#databaseName, version);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.#storeName);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  /**
   * Get the database and automatically upgrade it if a new store is not created yet.
   * @returns {Promise<IDBDatabase>} Database.
   */
  async #getDatabase() {
    let database = await this.#openDatabase();
    const { version, objectStoreNames } = database;

    if (![...objectStoreNames].includes(this.#storeName)) {
      database.close();
      database = await this.#openDatabase(version + 1);
    }

    // Avoid upgrade conflict
    database.onversionchange = () => {
      database.close();
      this.#database = undefined;
    };

    return database;
  }

  /**
   * Create a database if not yet initialized, then execute the given function over the store.
   * @param {(store: IDBObjectStore) => IDBRequest | void} getRequest - Function to be executed.
   * @returns {Promise<any | void>} Result.
   */
  async #query(getRequest) {
    this.#database ??= await this.#getDatabase();

    const transaction = /** @type {IDBDatabase} */ (this.#database).transaction(
      [this.#storeName],
      'readwrite',
    );

    const store = transaction.objectStore(this.#storeName);
    const request = getRequest(store);

    if (request) {
      return new Promise((resolve) => {
        request.onsuccess = () => {
          resolve(request.result);
        };
      });
    }

    return new Promise((resolve) => {
      transaction.oncomplete = () => {
        resolve(void 0);
      };
    });
  }

  /**
   * Save a single entry.
   * @param {string} key - Key.
   * @param {any} value - Value.
   * @returns {Promise<string>} Key.
   */
  async set(key, value) {
    return this.#query((store) => store.put(value, key));
  }

  /**
   * Save multiple entries.
   * @param {[string, any][]} entries - Key/value pairs.
   * @returns {Promise<string>} Key.
   */
  async saveEntries(entries) {
    return this.#query((store) => {
      entries.forEach(([key, value]) => {
        store.put(value, key);
      });
    });
  }

  /**
   * Retrieve a value by key.
   * @param {string} key - Key.
   * @returns {Promise<any>} Value.
   */
  async get(key) {
    return this.#query((store) => store.get(key));
  }

  /**
   * Retrieve all keys.
   * @returns {Promise<string[]>} Keys.
   */
  async keys() {
    return this.#query((store) => store.getAllKeys());
  }

  /**
   * Retrieve all values.
   * @returns {Promise<any[]>} Values.
   */
  async values() {
    return this.#query((store) => store.getAll());
  }

  /**
   * Retrieve all entries.
   * @returns {Promise<[string, any][]>} Key/value pairs.
   */
  async entries() {
    const [keys, values] = await Promise.all([this.keys(), this.values()]);

    return keys.map((key, index) => [key, values[index]]);
  }

  /**
   * Delete an entry by key.
   * @param {string} key - Key.
   * @returns {Promise<void>} Result.
   */
  async delete(key) {
    return this.#query((store) => store.delete(key));
  }

  /**
   * Delete multiple entries by keys.
   * @param {string[]} keys - Property keys.
   * @returns {Promise<void>} Result.
   */
  async deleteEntries(keys) {
    return this.#query((store) => {
      keys.forEach((key) => {
        store.delete(key);
      });
    });
  }

  /**
   * Delete all entries.
   * @returns {Promise<void>} Result.
   */
  async clear() {
    return this.#query((store) => store.clear());
  }
}
