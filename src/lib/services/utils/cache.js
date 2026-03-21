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
