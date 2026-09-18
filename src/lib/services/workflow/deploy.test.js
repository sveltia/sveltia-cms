// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { canResolveDeployments } from '$lib/services/deployments/resolve';
import {
  deployingEntries,
  productionBuildDone,
  resetDeployingEntries,
  trackDeployingEntry,
} from '$lib/services/workflow/deploy';

// A factory rather than an automock, which would import the real module and its `prefs`
// dependency, whose effect needs `matchMedia`
vi.mock('$lib/services/deployments/resolve', () => ({ canResolveDeployments: vi.fn() }));

/**
 * Create a minimal entry as published, with the workflow properties.
 * @param {string} branch Branch name.
 * @param {string} [status] Workflow status.
 * @returns {any} Entry.
 */
const createEntry = (branch, status = 'pending_publish') => ({
  id: branch,
  slug: 'hello',
  subPath: 'hello',
  locales: {},
  workflow: {
    pullRequest: { branch, number: 1, status, updatedDate: new Date(0) },
    status,
    collectionName: 'posts',
  },
});

/**
 * Record the given deploy state for the production commit.
 * @param {string} state Deploy state.
 */
const setProductionState = (state) => {
  deployments.current = {
    ...deployments.current,
    [productionSHA.current]: /** @type {any} */ ({ state, checkedTime: Date.now() }),
  };
};

describe('workflow/deploy', () => {
  beforeEach(() => {
    vi.mocked(canResolveDeployments).mockReturnValue(true);
    resetDeployingEntries();
    deployments.current = {};
    productionSHA.current = 'sha1';
    deployPollTimedOut.current = false;
  });

  describe('productionBuildDone', () => {
    test.each([
      ['nothing is known about the commit', undefined, false],
      ['the commit is being looked up', 'checking', false],
      ['the build is running', 'pending', false],
      ['the build has failed', 'error', false],
      ['the build has finished', 'ready', true],
      ['nothing reports on the commit', 'unknown', true],
    ])('is %s → %s', (_label, state, expected) => {
      if (state) {
        setProductionState(state);
      }

      expect(productionBuildDone.current).toBe(expected);
    });

    test('is not concluded by the re-checks giving up', () => {
      setProductionState('pending');
      deployPollTimedOut.current = true;

      expect(productionBuildDone.current).toBe(false);
    });

    test('is not done without a production commit', () => {
      productionSHA.current = '';

      expect(productionBuildDone.current).toBe(false);
    });
  });

  describe('trackDeployingEntry', () => {
    test('lists the entry until the site has caught up', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-16T12:00:00Z'));

      try {
        const entry = createEntry('cms/posts/hello');

        trackDeployingEntry(entry);

        expect(deployingEntries.current).toHaveLength(1);

        const [{ entry: tracked, sha }] = deployingEntries.current;

        // The workflow properties travel along, with the merge time as the date
        expect(sha).toBe('sha1');
        expect(tracked.workflow.status).toBe('pending_publish');
        expect(tracked.workflow.pullRequest.updatedDate).toEqual(new Date('2026-09-16T12:00:00Z'));

        setProductionState('pending');
        expect(deployingEntries.current).toHaveLength(1);

        setProductionState('ready');
        expect(deployingEntries.current).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    test('keeps a deletion listed as well', () => {
      trackDeployingEntry(createEntry('cms/posts/hello', 'pending_deletion'));

      expect(deployingEntries.current[0].entry.workflow.status).toBe('pending_deletion');
    });

    test('keeps the entry listed while the build has failed', () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      setProductionState('error');

      expect(deployingEntries.current).toHaveLength(1);

      // Deployed again by hand
      setProductionState('ready');

      expect(deployingEntries.current).toEqual([]);
    });

    test('lists every merge until the one build they wait for is done', () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      setProductionState('pending');

      // A second merge moves the branch head, and the new build carries both changes
      productionSHA.current = 'sha2';
      trackDeployingEntry(createEntry('cms/posts/world'));

      expect(deployingEntries.current.map(({ entry: { id } }) => id)).toEqual([
        'cms/posts/hello',
        'cms/posts/world',
      ]);

      setProductionState('ready');

      expect(deployingEntries.current).toEqual([]);
    });

    test('keeps an entry the site has caught up with out of the list for good', () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      setProductionState('ready');

      expect(deployingEntries.current).toEqual([]);

      // The next merge is on its way, but the earlier one has been live since its own build
      productionSHA.current = 'sha2';
      trackDeployingEntry(createEntry('cms/posts/world'));

      expect(deployingEntries.current.map(({ entry: { id } }) => id)).toEqual(['cms/posts/world']);
    });

    test('concludes a superseded build with a later one', () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      setProductionState('pending');

      // The branch head moves on while the first build is still running, and the loop stops
      // following that build, so its state never changes
      productionSHA.current = 'sha2';
      trackDeployingEntry(createEntry('cms/posts/world'));
      productionSHA.current = 'sha3';
      trackDeployingEntry(createEntry('cms/posts/again'));

      // The middle build finishing carries the first change, but not the last
      deployments.current = {
        ...deployments.current,
        sha2: /** @type {any} */ ({ state: 'ready', checkedTime: Date.now() }),
      };

      expect(deployingEntries.current.map(({ entry: { id } }) => id)).toEqual(['cms/posts/again']);

      // A direct commit moves the head past every recorded merge
      productionSHA.current = 'sha4';
      setProductionState('ready');

      expect(deployingEntries.current).toEqual([]);
    });

    test('replaces the record of an entry published again', () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      trackDeployingEntry(createEntry('cms/posts/hello', 'pending_deletion'));

      expect(deployingEntries.current).toHaveLength(1);
      expect(deployingEntries.current[0].entry.workflow.status).toBe('pending_deletion');
    });

    test('records nothing when the backend can’t report deployments', () => {
      vi.mocked(canResolveDeployments).mockReturnValue(false);
      trackDeployingEntry(createEntry('cms/posts/hello'));

      expect(deployingEntries.current).toEqual([]);
    });

    test('records nothing without a production commit', () => {
      productionSHA.current = '';
      trackDeployingEntry(createEntry('cms/posts/hello'));

      expect(deployingEntries.current).toEqual([]);
    });

    test('lets the entries go for good once the re-checks have given up', async () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      setProductionState('pending');
      deployPollTimedOut.current = true;
      // The effect runs on the next tick
      await new Promise((resolve) => {
        setTimeout(resolve);
      });

      expect(deployingEntries.current).toEqual([]);

      // A save restarts the re-checks, which clears the flag; the entries mustn’t come back
      deployPollTimedOut.current = false;

      expect(deployingEntries.current).toEqual([]);

      // A merge made after that is on its way like any other
      productionSHA.current = 'sha2';
      trackDeployingEntry(createEntry('cms/posts/world'));

      expect(deployingEntries.current.map(({ entry: { id } }) => id)).toEqual(['cms/posts/world']);
    });

    test('is reset on sign-out', () => {
      trackDeployingEntry(createEntry('cms/posts/hello'));
      resetDeployingEntries();

      expect(deployingEntries.current).toEqual([]);
    });
  });
});
