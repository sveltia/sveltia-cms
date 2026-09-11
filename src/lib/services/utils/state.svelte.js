/**
 * Wrap the given plain object in a deeply reactive `$state` proxy. Runes are only available in
 * Svelte-compiled modules, so this lets a plain service module create reactive state, e.g. an
 * entry draft, that Svelte components can then read and mutate reactively.
 * @template {object} T
 * @param {T} value Plain object to wrap. A value that is already a `$state` proxy is returned as
 * is.
 * @returns {T} Reactive proxy.
 */
export const createState = (value) => {
  const state = $state(value);

  return state;
};

/**
 * Take a static, deeply cloned snapshot of the given value, detached from any `$state` proxy. Same
 * as `$state.snapshot()`, made available to plain service modules.
 * @template T
 * @param {T} value Value to clone.
 * @returns {T} Snapshot.
 */
export const getSnapshot = (value) => /** @type {T} */ ($state.snapshot(value));
