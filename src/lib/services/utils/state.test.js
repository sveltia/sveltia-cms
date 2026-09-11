import { describe, expect, it } from 'vitest';

import { createState, getSnapshot } from './state.svelte.js';

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
