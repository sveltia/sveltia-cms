/**
 * Implement a wrapper for the Web Storage API. These methods are async just like the experimental
 * KV Storage and automatically parse/stringify JSON data.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Storage
 * @see https://developer.chrome.com/blog/kv-storage/
 */
export default class LocalStorage {
  /**
   * Save data.
   * @param {string} key - Storage key.
   * @param {any} value - Serializable value.
   * @throws {DOMException} When storage access is denied.
   */
  static async set(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Retrieve data by key.
   * @param {string} key - Storage key.
   * @returns {Promise<*>} Data.
   * @throws {DOMException} When storage access is denied.
   */
  static async get(key) {
    const cache = window.localStorage.getItem(key);

    return cache ? JSON.parse(cache) : null;
  }

  /**
   * Delete data by key.
   * @param {string} key - Storage key.
   * @throws {DOMException} When storage access is denied.
   */
  static async delete(key) {
    window.localStorage.removeItem(key);
  }

  /**
   * Clear the storage.
   * @throws {DOMException} When storage access is denied.
   */
  static async clear() {
    window.localStorage.clear();
  }

  /**
   * Get a list of storage keys.
   * @returns {Promise<string[]>} Keys.
   * @throws {DOMException} When storage access is denied.
   */
  static async keys() {
    return Object.keys(window.localStorage);
  }

  /**
   * Get a list of storage values.
   * @returns {Promise<*[]>} Values.
   * @throws {DOMException} When storage access is denied.
   */
  static async values() {
    return Object.values(window.localStorage).map((value) => JSON.parse(value));
  }

  /**
   * Get a list of storage entries.
   * @returns {Promise<[string, any][]>} Entries.
   * @throws {DOMException} When storage access is denied.
   */
  static async entries() {
    return Object.entries(window.localStorage).map(([key, value]) => [key, JSON.parse(value)]);
  }
}
