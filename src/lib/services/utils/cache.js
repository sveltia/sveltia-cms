/**
 * Get a value from a cache Map, creating and storing it if absent.
 * @template K, V
 * @param {Map<K, V>} cache The cache to look up.
 * @param {K} key Cache key.
 * @param {() => V} create Factory called once to produce the value when not cached.
 * @returns {V} Cached or newly created value.
 */
export const getOrCreate = (cache, key, create) => {
  if (!cache.has(key)) {
    cache.set(key, create());
  }

  return /** @type {V} */ (cache.get(key));
};

/**
 * Get a value from a cache `Map` holding at most `maxSize` entries, creating and storing it if
 * absent. The least recently used entry is evicted once the limit is exceeded.
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
    const value = /** @type {V} */ (cache.get(key));

    // A `Map` iterates in insertion order, so re-inserting the key moves it to the end, marking it
    // as the most recently used entry
    cache.delete(key);
    cache.set(key, value);

    return value;
  }

  const value = create();

  cache.set(key, value);

  if (cache.size > maxSize) {
    // The first key is the least recently used one
    cache.delete(/** @type {K} */ (cache.keys().next().value));
  }

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
 * @param {Map<K, Promise<V>>} cache Cache of the tasks.
 * @param {K} key Cache key.
 * @param {() => Promise<V>} create Function starting the task.
 * @returns {Promise<V>} Result of the task.
 */
export const getOrCreateAsync = (cache, key, create) =>
  getOrCreate(cache, key, () =>
    create().catch((ex) => {
      cache.delete(key);

      throw ex;
    }),
  );
