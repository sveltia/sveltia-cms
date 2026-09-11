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

/**
 * Create a reactive box holding a value that is replaced as a whole, e.g. a list of entries that
 * is reloaded, or a flag. The value is held in `$state.raw`, so it’s not proxied: reading
 * `current` from a component or a `$derived` tracks the box, and assigning `current` notifies the
 * readers, but mutating the value in place doesn’t. Because the value is not proxied, it can be
 * safely passed to APIs that can’t handle a proxy, such as `structuredClone()` or IndexedDB.
 * @template T
 * @param {T} [initialValue] Initial value.
 * @returns {{ current: T }} Reactive box.
 */
export const createRawState = (initialValue) => {
  let current = $state.raw(/** @type {T} */ (initialValue));

  return {
    /**
     * Get the current value.
     * @returns {T} Value.
     */
    get current() {
      return current;
    },
    /**
     * Set a new value.
     * @param {T} value Value.
     */
    set current(value) {
      current = value;
    },
  };
};

/**
 * Create a reactive box holding a deeply reactive value, like `$state`. Unlike
 * {@link createRawState}, the value is proxied, so a property of it can be mutated in place, or
 * bound to with `bind:`, and the readers are notified. Use it for a small object like a dialog or
 * toast state, not for data that is passed to APIs that can’t handle a proxy.
 * @template T
 * @param {T} initialValue Initial value.
 * @returns {{ current: T }} Reactive box.
 */
export const createDeepState = (initialValue) => {
  const state = $state({ current: initialValue });

  return state;
};

/**
 * Create a read-only reactive box whose value is derived from other reactive state. The getter is
 * re-evaluated lazily, only when one of the values it read has changed since the last read.
 * @template T
 * @param {() => T} getter Function computing the value.
 * @returns {{ readonly current: T }} Reactive box.
 */
export const createDerivedState = (getter) => {
  const current = $derived.by(getter);

  return {
    /**
     * Get the current value.
     * @returns {T} Value.
     */
    get current() {
      return current;
    },
  };
};

/**
 * Run the given function whenever the reactive state it reads has changed, like `$effect` in a
 * component, but for a service module that lives as long as the app. The function is first run
 * asynchronously, after the current task, and never synchronously on state changes, so a service
 * that needs a value updated right away should do so directly rather than in an effect.
 * @param {() => void | (() => void)} fn Function to run. It can return a cleanup function, which
 * is called before the next run.
 * @returns {() => void} Function to stop the effect.
 */
export const createRootEffect = (fn) =>
  $effect.root(() => {
    $effect(fn);
  });
