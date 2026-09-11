import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  deployments,
  lastCommitPublishHint,
  productionSHA,
  resetDeployments,
} from '$lib/services/deployments';
import { isLastCommitPublished, setLastCommitPublishHint } from '$lib/services/deployments/publish';

/**
 * @import { DeployState } from '$lib/types/private';
 */

/** Time the hint is recorded at in each test. */
const NOW = new Date('2026-08-17T00:00:00Z').getTime();

/**
 * Record a deployment for the production commit.
 * @param {DeployState} state Deployment state.
 * @param {number} [checkedTime] When the backend was queried. Default: just after the hint.
 */
const recordDeployment = (state, checkedTime = NOW + 1000) => {
  productionSHA.current = 'prod';
  deployments.current = { prod: { state, checkedTime } };
};

describe('Publish state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    resetDeployments();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setLastCommitPublishHint', () => {
    test('records the expectation with the current time', () => {
      setLastCommitPublishHint(false);
      expect(lastCommitPublishHint.current).toEqual({ published: false, time: NOW });
    });
  });

  describe('isLastCommitPublished', () => {
    test('is published before anything has been looked up', () => {
      expect(isLastCommitPublished.current).toBe(true);
    });

    test('follows the hint while the provider has said nothing', () => {
      setLastCommitPublishHint(false);
      expect(isLastCommitPublished.current).toBe(false);

      setLastCommitPublishHint(true);
      expect(isLastCommitPublished.current).toBe(true);
    });

    test('follows the hint when no commit is being tracked', () => {
      setLastCommitPublishHint(false);
      deployments.current = { prod: { state: 'ready', checkedTime: NOW + 1000 } };

      expect(isLastCommitPublished.current).toBe(false);
    });

    test('reports a finished build as published, whatever the message said', () => {
      setLastCommitPublishHint(false);
      recordDeployment('ready');

      expect(isLastCommitPublished.current).toBe(true);
    });

    test('reports a running build as published, so the user isn’t asked to trigger another', () => {
      setLastCommitPublishHint(false);
      recordDeployment('pending');

      expect(isLastCommitPublished.current).toBe(true);
    });

    test('reports a failed build as unpublished, so it can be retried', () => {
      setLastCommitPublishHint(true);
      recordDeployment('error');

      expect(isLastCommitPublished.current).toBe(false);
    });

    test('falls back to the hint when the provider reported nothing', () => {
      setLastCommitPublishHint(false);
      recordDeployment('unknown');

      expect(isLastCommitPublished.current).toBe(false);
    });

    test('falls back to the hint while a commit is being looked up', () => {
      setLastCommitPublishHint(false);
      recordDeployment('checking', 0);

      expect(isLastCommitPublished.current).toBe(false);
    });

    test('ignores a deployment read before the hint was recorded', () => {
      // The user has just asked for a failed build to be retried, and the provider hasn’t been
      // asked about the new run yet
      recordDeployment('error', NOW - 1000);
      setLastCommitPublishHint(true);

      expect(isLastCommitPublished.current).toBe(true);
    });
  });
});
