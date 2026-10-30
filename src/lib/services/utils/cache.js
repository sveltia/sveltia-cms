/**
 * Get a value from a cache `Map` or `WeakMap`, creating and storing it if absent.
 * @template K, V
 * @param {Map<K, V> | WeakMap<K & WeakKey, V>} cache The cache to look up.
 * @param {K} key Cache key.
 * @param {() => V} create Factory called once to produce the value when not cached.
 * @returns {V} Cached or newly created value.
 */
export const getOrCreate = (cache, key, create) => {
  // Both types share the `has`/`get`/`set` signatures used here
  const map = /** @type {Map<K, V>} */ (cache);

  if (!map.has(key)) {
    map.set(key, create());
  }

  return /** @type {V} */ (map.get(key));
};

/**
 * Mark the given entry of a `Map` as the most recently used one. A `Map` iterates in insertion
 * order, so re-inserting the key moves it to the end.
 * @template K, V
 * @param {Map<K, V>} map Map.
 * @param {K} key Key of an existing entry.
 * @returns {V} Value of the entry.
 */
const touchEntry = (map, key) => {
  const value = /** @type {V} */ (map.get(key));

  map.delete(key);
  map.set(key, value);

  return value;
};

/**
 * Store a value in a `Map` as its most recently used entry, then evict the least recently used one,
 * which is the first key, if the map holds more than `maxSize` entries.
 * @template K, V
 * @param {Map<K, V>} map Map.
 * @param {K} key Key.
 * @param {V} value Value.
 * @param {number} maxSize Maximum number of entries to retain.
 */
const setEntry = (map, key, value, maxSize) => {
  map.delete(key);
  map.set(key, value);

  if (map.size > maxSize) {
    map.delete(/** @type {K} */ (map.keys().next().value));
  }
};

/**
 * @template K, V
 * @typedef {object} LRUMap
 * @property {(key: K) => boolean} has Check if the key has an entry.
 * @property {(key: K) => V | undefined} get Get the value of the key, marking it as recently used.
 * @property {(key: K, value: V) => void} set Store a value, evicting the least recently used entry
 * if the map is full.
 * @property {() => void} clear Remove all the entries.
 */

/**
 * Create a map holding at most `maxSize` entries, which evicts the least recently used one once the
 * limit is exceeded. Reading an entry with `get` marks it as recently used; `has` doesn’t.
 * @template K, V
 * @param {number} maxSize Maximum number of entries to retain.
 * @returns {LRUMap<K, V>} Map.
 */
export const createLRUMap = (maxSize) => {
  /** @type {Map<K, V>} */
  const map = new Map();

  return {
    /**
     * Check if the key has an entry, without marking it as recently used.
     * @param {K} key Key.
     * @returns {boolean} Result.
     */
    has: (key) => map.has(key),
    /**
     * Get the value of the key, marking the entry as recently used.
     * @param {K} key Key.
     * @returns {V | undefined} Value, if any.
     */
    get: (key) => (map.has(key) ? touchEntry(map, key) : undefined),
    /**
     * Store a value, evicting the least recently used entry if the map is full.
     * @param {K} key Key.
     * @param {V} value Value.
     */
    set: (key, value) => {
      setEntry(map, key, value, maxSize);
    },
    /**
     * Remove all the entries.
     */
    clear: () => {
      map.clear();
    },
  };
};

/**
 * Get a value from a cache `Map` holding at most `maxSize` entries, creating and storing it if
 * absent. The least recently used entry is evicted once the limit is exceeded, as in
 * {@link createLRUMap}.
 *
 * Use this instead of {@link getOrCreate} whenever the cache key includes something the user can
 * keep changing — a field value, a resolved filter, an object identity that is replaced every time
 * the entry list is loaded again. Such a cache never sees the same key twice, so an unbounded `Map`
 * would grow for as long as the page is open.
 * @template K, V
 * @param {Map<K, V>} cache The cache to look up.
 * @param {K} key Cache key.
 * @param {() => V} create Factory called once to produce the value when not cached.
 * @param {number} maxSize Maximum number of entries to retain.
 * @returns {V} Cached or newly created value.
 */
export const getOrCreateBounded = (cache, key, create, maxSize) => {
  if (cache.has(key)) {
    return touchEntry(cache, key);
  }

  const value = create();

  setEntry(cache, key, value, maxSize);

  return value;
};

/**
 * Run an asynchronous task, letting concurrent callers with the same key share it. The promise is
 * only cached while the task is in flight, so a caller coming after it has settled starts anew.
 * @template K, V
 * @param {Map<K, Promise<V>>} cache Cache of the tasks in flight.
 * @param {K} key Cache key.
 * @param {() => Promise<V>} create Function starting the task.
 * @returns {Promise<V>} Result of the task.
 */
export const shareInFlight = (cache, key, create) =>
  getOrCreate(cache, key, () =>
    create().finally(() => {
      cache.delete(key);
    }),
  );

/**
 * Run an asynchronous task once per key and remember its result. A failure isn’t remembered, so a
 * later caller can try again.
 * @template K, V
 * @param {Map<K, Promise<V>> | WeakMap<K & WeakKey, Promise<V>>} cache Cache of the tasks.
 * @param {K} key Cache key.
 * @param {() => Promise<V>} create Function starting the task.
 * @returns {Promise<V>} Result of the task.
 */
export const getOrCreateAsync = (cache, key, create) =>
  getOrCreate(cache, key, () =>
    create().catch((ex) => {
      /** @type {Map<K, Promise<V>>} */ (cache).delete(key);

      throw ex;
    }),
  );

/**
 * Create a getter for a value built from a source, such as the array in a store, that is only built
 * again once the source has been replaced. A store is replaced rather than modified when it
 * changes, so the source’s identity tells whether the value is still valid. This is how an index
 * of a store, e.g. assets by path, is kept without rebuilding it on every lookup.
 * @template S, V
 * @param {() => S} getSource Function returning the current source.
 * @param {(source: S) => V} build Function building the value from the source.
 * @returns {() => V} Function returning the value for the current source.
 */
export const memoizeOnSource = (getSource, build) => {
  /** @type {{ source: S, value: V } | undefined} */
  let cache;

  return () => {
    const source = getSource();

    if (!cache || cache.source !== source) {
      cache = { source, value: build(source) };
    }

    return cache.value;
  };
};

/**
 * Create a getter for a value that is built on first use rather than when the module is loaded.
 * This is how a regular expression with the `v` flag is kept: the bundle turns its literal into a
 * `RegExp()` call for browsers lacking the flag, which throws in those, e.g. Safari 16, and a throw
 * while the bundle loads would leave the page blank instead of showing the unsupported browser
 * message.
 * @template V
 * @param {() => V} create Function building the value.
 * @returns {() => V} Function returning the value.
 */
export const lazy = (create) => {
  /** @type {{ value: V } | undefined} */
  let cache;

  return () => {
    cache ??= { value: create() };

    return cache.value;
  };
};
