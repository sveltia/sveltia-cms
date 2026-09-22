// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  createDeepState,
  createDerivedState,
  createRawState,
  createRootEffect,
  createStableDerivedState,
  createState,
  getSnapshot,
  watch,
} from './state.svelte.js';

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('utils/state', () => {
  describe('createState()', () => {
    it('should return a deeply reactive proxy holding the same values', () => {
      const state = createState({ a: 1, nested: { b: 2 } });

      expect(state.a).toBe(1);
      expect(state.nested.b).toBe(2);

      state.nested.b = 3;
      expect(state.nested.b).toBe(3);
    });

    it('should return the same proxy for a value that is already reactive', () => {
      const state = createState({ a: 1 });

      expect(createState(state)).toBe(state);
    });

    it('should hand out a static property as it is, rather than a proxy of it', () => {
      const config = { nested: { b: 2 } };
      const reactive = { nested: { b: 2 } };
      const state = createState({ config, reactive }, ['config']);

      expect(state.config).toBe(config);
      // A reactive property, in contrast, is handed out as a proxy
      expect(state.reactive).not.toBe(reactive);
      expect(state.reactive).toEqual(reactive);
    });

    it('should skip a static key the object doesn’t carry', () => {
      const state = createState({ a: 1 }, ['config']);

      expect('config' in state).toBe(false);
      expect(state.a).toBe(1);
    });

    it('should hand out the same static property to every state built from it', () => {
      // Two proxies of the same configuration would look like a change to every reader
      // @see https://github.com/sveltia/sveltia-cms/issues/1006
      const config = { nested: { b: 2 } };

      expect(createState({ config }, ['config']).config).toBe(
        createState({ config }, ['config']).config,
      );
    });
  });

  describe('getSnapshot()', () => {
    it('should return a detached deep clone', () => {
      const state = createState({ nested: { b: 2 } });
      const snapshot = getSnapshot(state);

      expect(snapshot).toEqual({ nested: { b: 2 } });

      state.nested.b = 3;
      expect(snapshot.nested.b).toBe(2);
    });
  });
});

describe('createRawState()', () => {
  it('should hold the initial value', () => {
    expect(createRawState(1).current).toBe(1);
    expect(createRawState().current).toBeUndefined();
  });

  it('should be replaced as a whole', () => {
    const state = createRawState({ a: 1 });
    const value = { a: 2 };

    state.current = value;
    // The value is not proxied
    expect(state.current).toBe(value);
  });
});

describe('createDerivedState()', () => {
  it('should recompute when the state it reads changes', () => {
    const state = createRawState(1);
    const derived = createDerivedState(() => state.current * 2);

    expect(derived.current).toBe(2);

    state.current = 3;
    expect(derived.current).toBe(6);
  });
});

describe('createStableDerivedState()', () => {
  it('should keep the previous value while the new one is deeply equal', () => {
    const state = createRawState({ sort: { key: 'title' }, type: 'list' });
    const derived = createStableDerivedState(() => state.current.sort);
    const dependent = createDerivedState(() => ({ sort: derived.current }));
    const first = derived.current;
    const firstDependent = dependent.current;

    expect(first).toEqual({ key: 'title' });

    // A different object with the same value is not passed on, so the dependent isn’t recomputed
    state.current = { sort: { key: 'title' }, type: 'grid' };
    expect(derived.current).toBe(first);
    expect(dependent.current).toBe(firstDependent);

    state.current = { sort: { key: 'date' }, type: 'grid' };
    expect(derived.current).toEqual({ key: 'date' });
    expect(dependent.current).not.toBe(firstDependent);
  });

  it('should hand out the first value even when it is undefined', () => {
    const state = createRawState(/** @type {string | undefined} */ (undefined));
    const derived = createStableDerivedState(() => state.current);

    expect(derived.current).toBeUndefined();

    state.current = 'a';
    expect(derived.current).toBe('a');
  });
});

describe('createRootEffect()', () => {
  it('should run when the state it reads changes, until stopped', async () => {
    const state = createRawState(1);
    /** @type {number[]} */
    const seen = [];

    const stop = createRootEffect(() => {
      seen.push(state.current);
    });

    // The first run is asynchronous
    expect(seen).toEqual([]);
    await wait();
    expect(seen).toEqual([1]);

    state.current = 2;
    await wait();
    expect(seen).toEqual([1, 2]);

    stop();
    state.current = 3;
    await wait();
    expect(seen).toEqual([1, 2]);
  });

  it('should call the cleanup function before the next run', async () => {
    const state = createRawState(1);
    /** @type {string[]} */
    const log = [];

    createRootEffect(() => {
      const value = state.current;

      log.push(`run ${value}`);

      return () => {
        log.push(`cleanup ${value}`);
      };
    });

    await wait();
    state.current = 2;
    await wait();

    expect(log).toEqual(['run 1', 'cleanup 1', 'run 2']);
  });
});

describe('createDeepState()', () => {
  it('should notify when a property is mutated in place', () => {
    const state = createDeepState({ show: false });
    const derived = createDerivedState(() => state.current.show);

    expect(derived.current).toBe(false);

    state.current.show = true;
    expect(derived.current).toBe(true);

    state.current = { show: false };
    expect(derived.current).toBe(false);
  });
});

describe('watch()', () => {
  it('should run on the dependencies only, not on what the function reads', async () => {
    const dependency = createRawState(1);
    const other = createRawState('a');
    /** @type {string[]} */
    const log = [];

    const stop = createRootEffect(() => {
      watch(
        () => dependency.current,
        () => {
          log.push(`run ${dependency.current} ${other.current}`);

          return () => {
            log.push('cleanup');
          };
        },
      );
    });

    await wait();
    expect(log).toEqual(['run 1 a']);

    // Read by the function, but not a dependency
    other.current = 'b';
    await wait();
    expect(log).toEqual(['run 1 a']);

    dependency.current = 2;
    await wait();
    expect(log).toEqual(['run 1 a', 'cleanup', 'run 2 b']);

    stop();
  });
});
