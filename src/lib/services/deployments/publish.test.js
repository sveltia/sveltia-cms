import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import {
  deployments,
  lastCommitPublishHint,
  productionSHA,
  resetDeployments,
} from '$lib/services/deployments';
import {
  canTriggerDeployment,
  isLastCommitPublished,
  setLastCommitPublishHint,
  triggerDeployment,
} from '$lib/services/deployments/publish';
import { prefs } from '$lib/services/user/prefs.svelte';

vi.mock('$lib/services/backends', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { backend: createRawState(undefined) };
});

vi.mock('$lib/services/user/prefs.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { prefs: createState({}) };
});

/**
 * Replace the preferences with the given ones.
 * @param {Record<string, any>} newPrefs Preferences.
 */
const setPrefs = (newPrefs) => {
  Object.keys(prefs).forEach((key) => {
    delete (/** @type {any} */ (prefs)[key]);
  });
  Object.assign(prefs, newPrefs);
};

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

  describe('canTriggerDeployment', () => {
    beforeEach(() => {
      /** @type {any} */ (backend).current = undefined;
      setPrefs({});
      setLastCommitPublishHint(false);
    });

    test('is false when there is no way to trigger a deployment', () => {
      expect(canTriggerDeployment.current).toBe(false);
    });

    test('is true with a deploy hook URL and an undeployed commit', () => {
      setPrefs({ deployHookURL: 'https://example.com/hook' });
      expect(canTriggerDeployment.current).toBe(true);
    });

    test('is true with a backend that can trigger a deployment', () => {
      /** @type {any} */ (backend).current = /** @type {any} */ ({ triggerDeployment: vi.fn() });
      expect(canTriggerDeployment.current).toBe(true);
    });

    test('is false once the last commit has been deployed', () => {
      setPrefs({ deployHookURL: 'https://example.com/hook' });
      setLastCommitPublishHint(true);
      expect(canTriggerDeployment.current).toBe(false);
    });
  });

  describe('triggerDeployment', () => {
    /** @type {import('vitest').Mock} */
    let fetchMock;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      /** @type {any} */ (backend).current = undefined;
      setPrefs({});
      setLastCommitPublishHint(false);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test('rejects an insecure deploy hook URL without calling it', async () => {
      setPrefs({ deployHookURL: 'http://example.com/hook' });

      await expect(triggerDeployment()).rejects.toThrow('HTTPS');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(lastCommitPublishHint.current.published).toBe(false);
    });

    test('posts to the deploy hook without credentials in `no-cors` mode', async () => {
      setPrefs({ deployHookURL: 'https://example.com/hook' });
      // An opaque response reports status `0`
      fetchMock.mockResolvedValue({ ok: false, status: 0 });

      await triggerDeployment();

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/hook', {
        method: 'POST',
        mode: 'no-cors',
        headers: {},
      });
      expect(lastCommitPublishHint.current.published).toBe(true);
    });

    test('posts to the deploy hook with the auth header in `cors` mode', async () => {
      setPrefs({ deployHookURL: 'https://example.com/hook', deployHookAuthHeader: 'Bearer x' });
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      await triggerDeployment();

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/hook', {
        method: 'POST',
        mode: 'cors',
        headers: { Authorization: 'Bearer x' },
      });
      expect(lastCommitPublishHint.current.published).toBe(true);
    });

    test('rejects a failed deploy hook request', async () => {
      setPrefs({ deployHookURL: 'https://example.com/hook', deployHookAuthHeader: 'Bearer x' });
      fetchMock.mockResolvedValue({ ok: false, status: 401 });

      await expect(triggerDeployment()).rejects.toThrow('401');
      expect(lastCommitPublishHint.current.published).toBe(false);
    });

    test('rejects an opaque failure when credentials were sent', async () => {
      setPrefs({ deployHookURL: 'https://example.com/hook', deployHookAuthHeader: 'Bearer x' });
      fetchMock.mockResolvedValue({ ok: false, status: 0 });

      await expect(triggerDeployment()).rejects.toThrow('0');
    });

    test('falls back to the backend’s own trigger', async () => {
      const trigger = vi.fn().mockResolvedValue({ ok: true, status: 201 });

      /** @type {any} */ (backend).current = /** @type {any} */ ({ triggerDeployment: trigger });

      await triggerDeployment();

      expect(trigger).toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(lastCommitPublishHint.current.published).toBe(true);
    });

    test('rejects when there is nothing to trigger a deployment with', async () => {
      await expect(triggerDeployment()).rejects.toThrow('undefined');
      expect(lastCommitPublishHint.current.published).toBe(false);
    });
  });
});
