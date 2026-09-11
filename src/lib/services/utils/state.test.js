// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  createDeepState,
  createDerivedState,
  createRawState,
  createRootEffect,
  createState,
  getSnapshot,
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
