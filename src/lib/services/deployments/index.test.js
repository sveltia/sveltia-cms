import { get } from 'svelte/store';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  deployments,
  deployPollTimedOut,
  forgetDeployments,
  productionSHA,
  resetDeployments,
} from '$lib/services/deployments';

describe('Deployment stores', () => {
  beforeEach(() => {
    resetDeployments();
  });

  describe('forgetDeployments', () => {
    test('drops only the given commits', () => {
      deployments.set({
        a: { state: 'ready', checkedTime: 0 },
        b: { state: 'ready', checkedTime: 0 },
      });

      forgetDeployments(['a']);

      expect(get(deployments)).toEqual({ b: { state: 'ready', checkedTime: 0 } });
    });

    test('does nothing without a commit', () => {
      deployments.set({ a: { state: 'ready', checkedTime: 0 } });

      const before = get(deployments);

      forgetDeployments([]);
      // A pull request opened in an older session has no head commit recorded
      forgetDeployments([undefined]);

      expect(get(deployments)).toBe(before);
    });
  });

  describe('resetDeployments', () => {
    test('clears every store', () => {
      deployments.set({ a: { state: 'ready', checkedTime: 0 } });
      productionSHA.set('abc');
      deployPollTimedOut.set(true);

      resetDeployments();

      expect(get(deployments)).toEqual({});
      expect(get(productionSHA)).toBe('');
      expect(get(deployPollTimedOut)).toBe(false);
    });
  });
});
