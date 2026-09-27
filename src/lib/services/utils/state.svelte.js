import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

/**
 * Wrap the given plain object in a deeply reactive `$state` proxy. Runes are only available in
 * Svelte-compiled modules, so this lets a plain service module create reactive state, e.g. an
 * entry draft, that Svelte components can then read and mutate reactively.
 * @template {object} T
 * @param {T} value Plain object to wrap. A value that is already a `$state` proxy is returned as
 * is.
 * @param {string[]} [staticKeys] Properties holding data that never changes while the state
 * object is alive, such as the collection configuration in an entry draft. Svelte’s proxy leaves a
 * read-only property alone, so these are handed out as they are: the reader gets the original
 * object rather than a proxy of it, and doesn’t depend on anything in it.
 *
 * This is not just an optimization. A proxy is created per state object, so two state objects
 * built from the same configuration hand out two different proxies of it. Replacing one with the
 * other — which is what saving an entry with the editor left open does — then looks like a new
 * value to every keyed `{#each}` block iterating the fields, and Svelte answers a write made while
 * an effect is running by walking the derived graph below it in search of the effect itself. That
 * walk doesn’t memoize, so in a deeply nested entry editor, where every level multiplies the
 * number of paths to the same derived, it takes exponentially longer with each level of nesting
 * and eventually hangs the browser.
 * @returns {T} Reactive proxy.
 * @see https://github.com/sveltia/sveltia-cms/issues/1006
 */
export const createState = (value, staticKeys = []) => {
  staticKeys.forEach((key) => {
    // A key the object doesn’t carry is skipped rather than defined as `undefined`, so that one
    // list can be shared by callers that assemble the object slightly differently
    if (Object.hasOwn(value, key)) {
      Object.defineProperty(value, key, {
        value: /** @type {any} */ (value)[key],
        writable: false,
        enumerable: true,
        configurable: true,
      });
    }
  });

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
 * Create a read-only reactive box like {@link createDerivedState}, but keep handing out the
 * previous value as long as the new one is deeply equal to it. A derived value only notifies what
 * depends on it when it’s a different object, so this stops a change that leaves the value as it
 * was from rippling any further. For example, the sort conditions picked out of a view object stay
 * the same object when the view is replaced to switch from list to grid, so the sorted list isn’t
 * recomputed.
 * @template T
 * @param {() => T} getter Function computing the value.
 * @returns {{ readonly current: T }} Reactive box.
 */
export const createStableDerivedState = (getter) => {
  /** @type {T | undefined} */
  let previous;

  return createDerivedState(() => {
    const value = getter();

    if (!equal(value, previous)) {
      previous = value;
    }

    return /** @type {T} */ (previous);
  });
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

/**
 * Run the given function whenever the given dependencies have changed, like `$effect`, but without
 * tracking the state the function itself reads. Use it in a component for a function that reads
 * more state than it should react to, e.g. one syncing two values in both directions, where
 * tracking the target would set off an infinite loop.
 * @param {() => unknown} getDependencies Function reading the reactive state to be tracked. Its
 * return value is ignored; wrap several values in an array, e.g. `() => [a, b]`.
 * @param {() => void | (() => void)} fn Function to run. It can return a cleanup function, which
 * is called before the next run.
 */
export const watch = (getDependencies, fn) => {
  $effect(() => {
    getDependencies();

    return untrack(fn);
  });
};

/**
 * Keep a field value and the value of its input in sync in both directions, like a bindable prop
 * and the local state bound to an input widget. A change to either side is converted and written to
 * the other side, but only if the converted value is different, so that the other side’s watcher
 * doesn’t set off an infinite loop. Each side is watched with {@link watch}, so the converters can
 * read other state, e.g. the field configuration, without being rerun on changes to it. The
 * arguments are positional because an arrow function in an object literal would need a JSDoc
 * comment of its own at every call site.
 * @template V, I
 * @param {() => V} getValue Function returning the field value.
 * @param {(value: V) => void} setValue Function updating the field value.
 * @param {() => I} getInput Function returning the input value.
 * @param {(input: I) => void} setInput Function updating the input value.
 * @param {(value: V) => I} [toInput] Function converting a field value to an input value. Defaults
 * to returning the value as is.
 * @param {(input: I) => V} [toValue] Function converting an input value to a field value. Defaults
 * to returning the value as is.
 * @returns {{ updateInput: () => void, updateValue: () => void }} Functions to sync the input
 * value with the field value and vice versa on demand, e.g. when the input loses focus.
 */
export const syncValues = (
  getValue,
  setValue,
  getInput,
  setInput,
  toInput = (value) => /** @type {I} */ (/** @type {unknown} */ (value)),
  toValue = (input) => /** @type {V} */ (/** @type {unknown} */ (input)),
) => {
  /**
   * Update the input value based on the field value.
   */
  const updateInput = () => {
    const input = toInput(getValue());

    if (getInput() !== input) {
      setInput(input);
    }
  };

  /**
   * Update the field value based on the input value.
   */
  const updateValue = () => {
    const value = toValue(getInput());

    if (getValue() !== value) {
      setValue(value);
    }
  };

  watch(getValue, updateInput);
  watch(getInput, updateValue);

  return { updateInput, updateValue };
};
