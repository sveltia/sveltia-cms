import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';

import { assetUpdatesToast } from './index.js';

describe('assets/data/index', () => {
  describe('assetUpdatesToast', () => {
    it('should initialize with default state', () => {
      const state = get(assetUpdatesToast);

      expect(state).toEqual(UPDATE_TOAST_DEFAULT_STATE);
    });

    it('should be writable', () => {
      const newState = { ...UPDATE_TOAST_DEFAULT_STATE, saved: true, count: 3 };

      assetUpdatesToast.set(newState);

      const state = get(assetUpdatesToast);

      expect(state).toEqual(newState);
    });

    it('should update specific properties', () => {
      assetUpdatesToast.update((state) => ({ ...state, deleted: true, count: 2 }));

      const state = get(assetUpdatesToast);

      expect(state.deleted).toBe(true);
      expect(state.count).toBe(2);
    });
  });
});
