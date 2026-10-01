import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  deployments,
  deployPollTimedOut,
  forgetDeployments,
  lastCommitPublishHint,
  productionSHA,
  resetDeployments,
  setLastCommitPublishHint,
} from '$lib/services/deployments';

describe('Deployment stores', () => {
  beforeEach(() => {
    resetDeployments();
  });

  describe('forgetDeployments', () => {
    test('drops only the given commits', () => {
      deployments.current = {
        a: { state: 'ready', checkedTime: 0 },
        b: { state: 'ready', checkedTime: 0 },
      };

      forgetDeployments(['a']);

      expect(deployments.current).toEqual({ b: { state: 'ready', checkedTime: 0 } });
    });

    test('does nothing without a commit', () => {
      deployments.current = { a: { state: 'ready', checkedTime: 0 } };

      const before = deployments.current;

      forgetDeployments([]);
      // A pull request opened in an older session has no head commit recorded
      forgetDeployments([undefined]);

      expect(deployments.current).toBe(before);
    });
  });

  describe('resetDeployments', () => {
    test('clears every store', () => {
      deployments.current = { a: { state: 'ready', checkedTime: 0 } };
      productionSHA.current = 'abc';
      deployPollTimedOut.current = true;
      lastCommitPublishHint.current = { published: false, time: 1000 };

      resetDeployments();

      expect(deployments.current).toEqual({});
      expect(productionSHA.current).toBe('');
      expect(deployPollTimedOut.current).toBe(false);
      expect(lastCommitPublishHint.current).toEqual({ published: true, time: 0 });
    });
  });

  describe('setLastCommitPublishHint', () => {
    test('records the expectation with the current time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_700_000_000_000);

      setLastCommitPublishHint(false);

      expect(lastCommitPublishHint.current).toEqual({ published: false, time: 1_700_000_000_000 });

      vi.useRealTimers();
    });
  });
});
