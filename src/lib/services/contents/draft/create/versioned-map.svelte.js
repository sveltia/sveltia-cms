/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Property key on a value map proxy that yields the map’s version. See {@link getValueMapVersion}.
 */
const VERSION_KEY = Symbol('valueMapVersion');

/**
 * Get the version of the given value map, a counter that goes up whenever a value is written to or
 * deleted from the map through the proxy created with {@link createValueMap}. Reading it in a
 * reactive context makes that context depend on the whole map at the cost of a single dependency,
 * which is how the shared value map snapshot is kept fresh without every reader walking all the
 * values.
 * @param {FlattenedEntryContent | undefined} valueMap Value map.
 * @returns {number | undefined} Version, or `undefined` if the map is not a proxy.
 */
export const getValueMapVersion = (valueMap) => /** @type {any} */ (valueMap)?.[VERSION_KEY];

/**
 * Property key on a value map proxy that yields the versions of its subtrees. See
 * {@link getSubtreeVersion}.
 */
const SUBTREE_VERSIONS_KEY = Symbol('subtreeVersions');

/**
 * A counter of the writes to a subtree of a value map.
 */
class SubtreeVersion {
  count = $state(0);
}

/**
 * Get the version of a subtree of the given value map: a counter that goes up whenever a value is
 * written to or deleted from the key path or any key path below it. Reading it in a reactive
 * context makes that context depend on the subtree only, so a field editor isn’t updated when
 * another field changes, as it is when it depends on the whole map with {@link getValueMapVersion}.
 *
 * The counters are created along with the key paths, never here: Svelte doesn’t track a state read
 * in the reaction that has created it, so a counter created on its first read, from a `$derived`,
 * would never be depended on. A key path that has no value yet, e.g. an optional field left empty,
 * has no counter, so the version of the whole map stands in for it.
 * @param {FlattenedEntryContent | undefined} valueMap Value map.
 * @param {FieldKeyPath} keyPath Key path of the subtree.
 * @returns {number | undefined} Version, or `undefined` if the map is not a proxy.
 */
export const getSubtreeVersion = (valueMap, keyPath) => {
  /** @type {Map<FieldKeyPath, SubtreeVersion> | undefined} */
  const versions = /** @type {any} */ (valueMap)?.[SUBTREE_VERSIONS_KEY];

  if (!versions) {
    return undefined;
  }

  const version = versions.get(keyPath);

  return version ? version.count : getValueMapVersion(valueMap);
};

/**
 * Create a Proxy holding a flattened value map. The values live in a deeply reactive `$state`
 * object behind the proxy, so a component reading a single value only depends on that value. The
 * proxy also counts its writes; see {@link getValueMapVersion}.
 * @param {FlattenedEntryContent} [target] Plain object holding the initial values.
 * @param {object} [hooks] Functions called after a value is written or deleted through the proxy,
 * whether or not it has actually changed.
 * @param {(obj: FlattenedEntryContent, keyPath: FieldKeyPath, value: any) => void} [hooks.onSet]
 * Function called after a value is written.
 * @param {(obj: FlattenedEntryContent, keyPath: FieldKeyPath) => void} [hooks.onDelete] Function
 * called after a value is deleted.
 * @returns {any} Created proxy.
 */
export const createValueMap = (target = {}, { onSet, onDelete } = {}) => {
  /** @type {FlattenedEntryContent} */
  const values = $state(target);
  let version = $state(0);
  /**
   * Key paths in insertion order. Svelte’s `$state` proxy keeps a deleted key in its target, so a
   * key deleted and written again would otherwise be listed in its old position. That reorders the
   * pairs of a KeyValue field as soon as one of them is renamed, because the editor rewrites all of
   * them, and the order is what the entry file ends up with.
   * This is intentionally a plain `Set`, not a `SvelteSet`: a caller enumerating the keys already
   * depends on the `$state` proxy, which is read in the `ownKeys` trap below.
   * @type {Set<string | symbol>}
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const keys = new Set(Object.keys(target));
  /**
   * Versions of the subtrees, keyed by key path: one for each key path in the map and each key
   * path above one. See {@link getSubtreeVersion}. A plain `Map`, as each version is reactive of
   * its own.
   * @type {Map<FieldKeyPath, SubtreeVersion>}
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const subtreeVersions = new Map();

  /**
   * Get the given key path and the ones above it, e.g. `a`, `a.b` and `a.b.c` for `a.b.c`.
   * @param {FieldKeyPath} keyPath Key path.
   * @returns {FieldKeyPath[]} Key paths.
   */
  const getSubtreeKeyPaths = (keyPath) => {
    const segments = keyPath.split('.');

    return segments.map((_segment, index) => segments.slice(0, index + 1).join('.'));
  };

  /**
   * Create the versions of the subtrees the given key path belongs to, if they don’t exist yet.
   * @param {FieldKeyPath} keyPath Key path.
   */
  const addSubtreeVersions = (keyPath) => {
    getSubtreeKeyPaths(keyPath).forEach((subtreeKeyPath) => {
      if (!subtreeVersions.has(subtreeKeyPath)) {
        subtreeVersions.set(subtreeKeyPath, new SubtreeVersion());
      }
    });
  };

  /**
   * Count a write to the given key path in the version of the map and of the subtrees it belongs
   * to.
   * @param {FieldKeyPath} keyPath Key path.
   */
  const countWrite = (keyPath) => {
    version += 1;

    // Every key path written to has its versions, created along with it
    getSubtreeKeyPaths(keyPath).forEach((subtreeKeyPath) => {
      /** @type {SubtreeVersion} */ (subtreeVersions.get(subtreeKeyPath)).count += 1;
    });
  };

  keys.forEach((keyPath) => {
    addSubtreeVersions(/** @type {FieldKeyPath} */ (keyPath));
  });

  return new Proxy(/** @type {any} */ (values), {
    // eslint-disable-next-line jsdoc/require-jsdoc
    get: (obj, key) =>
      key === VERSION_KEY ? version : key === SUBTREE_VERSIONS_KEY ? subtreeVersions : obj[key],
    // eslint-disable-next-line jsdoc/require-jsdoc
    ownKeys: (obj) => {
      // Read the keys through the `$state` proxy, so that a caller enumerating them depends on
      // them; only the order comes from our own list
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const ownKeys = new Set(Reflect.ownKeys(obj));

      return [
        ...[...keys].filter((key) => ownKeys.has(key)),
        ...[...ownKeys].filter((key) => !keys.has(key)),
      ];
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, /** @type {FieldKeyPath} */ keyPath, value) => {
      if (obj[keyPath] !== value) {
        obj[keyPath] = value;
        keys.add(keyPath);
        addSubtreeVersions(keyPath);
        countWrite(keyPath);
      }

      onSet?.(obj, keyPath, value);

      return true;
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    deleteProperty: (obj, /** @type {FieldKeyPath} */ keyPath) => {
      if (keyPath in obj) {
        delete obj[keyPath];
        keys.delete(keyPath);
        countWrite(keyPath);
      }

      onDelete?.(obj, keyPath);

      return true;
    },
  });
};
