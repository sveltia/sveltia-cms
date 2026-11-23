import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { mergeRefusedPullRequest } from '$lib/services/backends/git/github/auto-merge';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));
vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ values: true }),
);
vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

/**
 * Create the error `fetchAPI` throws for a failed request.
 * @param {number} status HTTP status code.
 * @returns {Error} Error.
 */
const createError = (status) =>
  new Error('Server responded with an error', {
    cause: { status, message: 'Pull Request is not mergeable' },
  });

/**
 * Create the pull request node the merge readiness query returns.
 * @param {Record<string, any>} [overrides] Properties to override.
 * @param {string | null} [checkState] Rollup state of the head commit’s checks, or `null` for a
 * commit without checks.
 * @returns {{ repository: { pullRequest: Record<string, any> } }} Query result.
 */
const createReadiness = (overrides = {}, checkState = 'PENDING') => ({
  repository: {
    pullRequest: {
      id: 'PR_1',
      state: 'OPEN',
      merged: false,
      mergeStateStatus: 'BLOCKED',
      reviewDecision: null,
      viewerCanEnableAutoMerge: true,
      autoMergeRequest: null,
      commits: {
        nodes: [{ commit: { statusCheckRollup: checkState ? { state: checkState } : null } }],
      },
      ...overrides,
    },
  },
});

const autoMergeOn = { autoMergeRequest: { enabledAt: '2026-01-01T00:00:00Z' } };

describe('mergeRefusedPullRequest()', () => {
  const pullRequest = /** @type {any} */ ({
    number: 1,
    branch: 'cms/posts/hello',
    title: 'Create Post',
    headSHA: 'abc123',
  });

  /** The 405 error GitHub refused the first merge with. */
  const refusal = createError(405);
  /** Function to merge the pull request right away. */
  const merge = vi.fn();

  /**
   * Call {@link mergeRefusedPullRequest} with the test’s pull request, refusal and merge function.
   * @param {object} [args] Arguments.
   * @param {Record<string, any>} [args.overrides] Pull request properties to override.
   * @param {boolean} [args.squash] Whether to squash the commits.
   * @returns {Promise<void>} Result.
   */
  const run = ({ overrides = {}, squash = false } = {}) =>
    mergeRefusedPullRequest({
      pullRequest: { ...pullRequest, ...overrides },
      squash,
      merge,
      refusal,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    merge.mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
  });

  test('takes a pull request merged on GitHub meanwhile as published', async () => {
    // Everything that stops a merge, this one included, comes back as a 405
    vi.mocked(fetchGraphQL).mockResolvedValueOnce(
      createReadiness({ state: 'MERGED', merged: true }, 'SUCCESS'),
    );

    await run();

    expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('mergeStateStatus'), {
      owner: 'owner',
      repo: 'repo',
      number: 1,
    });
    expect(merge).not.toHaveBeenCalled();
  });

  test.each([
    ['a conflict', { mergeStateStatus: 'DIRTY' }, 'PENDING'],
    ['a branch that must be updated first', { mergeStateStatus: 'BEHIND' }, 'PENDING'],
    ['a failed check', {}, 'FAILURE'],
    ['a check that errored', {}, 'ERROR'],
    ['a commit without checks', {}, null],
    ['a review still required', { reviewDecision: 'REVIEW_REQUIRED' }, 'PENDING'],
    ['changes requested', { reviewDecision: 'CHANGES_REQUESTED' }, 'PENDING'],
    ['a repository without auto-merge', { viewerCanEnableAutoMerge: false }, 'PENDING'],
    ['a closed pull request', { state: 'CLOSED' }, 'PENDING'],
  ])('reports a refusal because of %s', async (_label, overrides, checkState) => {
    vi.mocked(fetchGraphQL).mockResolvedValueOnce(createReadiness(overrides, checkState));

    await expect(run()).rejects.toBe(refusal);
    // Auto-merge isn’t touched, nor is the merge made again
    expect(fetchGraphQL).toHaveBeenCalledOnce();
    expect(merge).not.toHaveBeenCalled();
  });

  test('reports a refusal for a pull request that can’t be found', async () => {
    vi.mocked(fetchGraphQL).mockResolvedValueOnce({ repository: { pullRequest: null } });

    await expect(run()).rejects.toBe(refusal);
    expect(merge).not.toHaveBeenCalled();
  });

  describe('while GitHub is still checking whether it can be merged', () => {
    const unknown = { mergeStateStatus: 'UNKNOWN' };

    test('merges once the pull request turns out mergeable', async () => {
      // GitHub works out mergeability in the background after a push, and refuses the merge until
      // it’s done
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness(unknown, 'SUCCESS'))
        .mockResolvedValueOnce(createReadiness(unknown, 'SUCCESS'))
        .mockResolvedValueOnce(createReadiness({ mergeStateStatus: 'CLEAN' }, 'SUCCESS'));

      await run();

      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(1000);
      expect(merge).toHaveBeenCalledOnce();
    });

    test.each([
      ['CLEAN', 'SUCCESS'],
      ['HAS_HOOKS', 'SUCCESS'],
      ['UNSTABLE', 'FAILURE'],
    ])('merges a pull request found %s straight away', async (mergeStateStatus, checkState) => {
      vi.mocked(fetchGraphQL).mockResolvedValueOnce(
        createReadiness({ mergeStateStatus }, checkState),
      );

      await run();

      expect(sleep).not.toHaveBeenCalled();
      expect(merge).toHaveBeenCalledOnce();
    });

    test('reports a refusal of the merge made once it turns out mergeable', async () => {
      merge.mockRejectedValueOnce(new Error('Still not mergeable'));
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness(unknown, 'SUCCESS'))
        .mockResolvedValueOnce(createReadiness({ mergeStateStatus: 'CLEAN' }, 'SUCCESS'));

      await expect(run()).rejects.toThrow('Still not mergeable');
      expect(merge).toHaveBeenCalledOnce();
    });

    test('sets the pull request to auto-merge once a required check turns out running', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness(unknown))
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(createReadiness({ merged: true }, 'SUCCESS'));

      await run();

      expect(fetchGraphQL).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('enablePullRequestAutoMerge'),
        {
          input: {
            pullRequestId: 'PR_1',
            mergeMethod: 'MERGE',
            commitHeadline: 'Create Post',
            expectedHeadOid: 'abc123',
          },
        },
      );
      // No merge is made here
      expect(merge).not.toHaveBeenCalled();
    });

    test('reports a refusal once a conflict turns up', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness(unknown))
        .mockResolvedValueOnce(createReadiness({ mergeStateStatus: 'DIRTY' }));

      await expect(run()).rejects.toBe(refusal);
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(merge).not.toHaveBeenCalled();
    });

    test('takes a pull request merged on GitHub meanwhile as published', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness(unknown))
        // GitHub doesn’t work out the mergeability of a merged pull request
        .mockResolvedValueOnce(
          createReadiness({ ...unknown, state: 'MERGED', merged: true }, 'SUCCESS'),
        );

      await run();

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(merge).not.toHaveBeenCalled();
    });

    test('reports a refusal for a pull request closed meanwhile', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness(unknown))
        .mockResolvedValueOnce(createReadiness({ ...unknown, state: 'CLOSED' }));

      await expect(run()).rejects.toBe(refusal);
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(merge).not.toHaveBeenCalled();
    });

    test('reports a failure once the check runs out of time', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue(createReadiness(unknown, 'SUCCESS'));

      const error = await run().catch((ex) => ex);

      expect(error.message).toBe(
        'Timed out waiting for GitHub to check whether pull request #1 can be merged',
      );
      expect(error.cause).toBe(refusal);
      expect(fetchGraphQL).toHaveBeenCalledTimes(10);
      expect(sleep).toHaveBeenCalledTimes(9);
      // Neither a merge nor an auto-merge is attempted
      expect(merge).not.toHaveBeenCalled();
    });
  });

  // @see https://github.com/sveltia/sveltia-cms/issues/1094
  describe('while a required check is running', () => {
    test('sets the pull request to auto-merge and waits for the merge', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness({}, 'EXPECTED'))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(createReadiness(autoMergeOn, 'PENDING'))
        .mockResolvedValueOnce(createReadiness(autoMergeOn, 'SUCCESS'))
        .mockResolvedValueOnce(
          createReadiness({ ...autoMergeOn, state: 'MERGED', merged: true }, 'SUCCESS'),
        );

      await run({ squash: true });

      // Pinned to the commit the entry was checked at, as the REST merge is
      expect(fetchGraphQL).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('enablePullRequestAutoMerge'),
        {
          input: {
            pullRequestId: 'PR_1',
            mergeMethod: 'SQUASH',
            commitHeadline: 'Create Post',
            expectedHeadOid: 'abc123',
          },
        },
      );
      expect(fetchGraphQL).toHaveBeenCalledTimes(5);
      expect(sleep).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledWith(10000);
      expect(merge).not.toHaveBeenCalled();
    });

    test('uses a regular merge, unpinned without a known head', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(createReadiness({ merged: true }, 'SUCCESS'));

      await run({ overrides: { headSHA: undefined } });

      expect(fetchGraphQL).toHaveBeenNthCalledWith(2, expect.any(String), {
        input: { pullRequestId: 'PR_1', mergeMethod: 'MERGE', commitHeadline: 'Create Post' },
      });
    });

    test('waits for an auto-merge that’s already on without setting it again', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness({ ...autoMergeOn, viewerCanEnableAutoMerge: false }))
        .mockResolvedValueOnce(createReadiness({ merged: true }, 'SUCCESS'));

      await run();

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(fetchGraphQL).not.toHaveBeenCalledWith(
        expect.stringContaining('enablePullRequestAutoMerge'),
        expect.anything(),
      );
    });

    test('merges right away if the checks pass before auto-merge is set', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockRejectedValueOnce(new Error('Pull request is in clean status'))
        .mockResolvedValueOnce(createReadiness({}, 'SUCCESS'));

      await run();

      expect(merge).toHaveBeenCalledOnce();
      expect(sleep).not.toHaveBeenCalled();
    });

    test('waits for an auto-merge turned on despite a lost response', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce(createReadiness(autoMergeOn))
        .mockResolvedValueOnce(createReadiness({ merged: true }, 'SUCCESS'));

      await run();

      // No second merge, which GitHub would refuse while the checks run
      expect(merge).not.toHaveBeenCalled();
      expect(fetchGraphQL).toHaveBeenCalledTimes(4);
    });

    test('takes an auto-merge that landed despite a lost response as published', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce(createReadiness({ merged: true }, 'SUCCESS'));

      await run();

      expect(sleep).not.toHaveBeenCalled();
      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
      expect(merge).not.toHaveBeenCalled();
    });

    test('reports a refusal of the merge that follows a failed auto-merge', async () => {
      merge.mockRejectedValueOnce(new Error('Still not mergeable'));
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockRejectedValueOnce(new Error('Pull request is in clean status'))
        .mockResolvedValueOnce({ repository: { pullRequest: null } });

      await expect(run()).rejects.toThrow('Still not mergeable');
      expect(merge).toHaveBeenCalledOnce();
    });

    test.each([
      ['a check fails', { ...autoMergeOn }, 'FAILURE', true],
      ['the pull request is closed', { ...autoMergeOn, state: 'CLOSED' }, 'PENDING', false],
      ['the auto-merge is cancelled', {}, 'PENDING', false],
    ])('reports a failure once %s', async (_label, overrides, checkState, cancels) => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(createReadiness(overrides, checkState));

      await expect(run()).rejects.toThrow('Pull request #1 was not merged');

      if (cancels) {
        // The auto-merge GitHub keeps armed is cancelled, so a re-run check can’t merge the entry
        // behind the CMS’s back
        expect(fetchGraphQL).toHaveBeenLastCalledWith(
          expect.stringContaining('disablePullRequestAutoMerge'),
          { input: { pullRequestId: 'PR_1' } },
        );
      } else {
        expect(fetchGraphQL).toHaveBeenCalledTimes(3);
      }

      expect(merge).not.toHaveBeenCalled();
    });

    test('reports a failure once the pull request is gone', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ repository: null });

      await expect(run()).rejects.toThrow('Pull request #1 was not merged: undefined');
    });

    test('keeps waiting through a failed read', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(createError(502))
        .mockRejectedValueOnce(createError(429))
        .mockResolvedValueOnce(createReadiness({ merged: true }, 'SUCCESS'));

      await run();

      expect(warn).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledWith(
        'Failed to read pull request #1, still waiting.',
        expect.any(Error),
      );
      warn.mockRestore();
    });

    test('gives up on a client error', async () => {
      const unauthorized = createError(401);

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(unauthorized);

      await expect(run()).rejects.toBe(unauthorized);
      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
    });

    test('gives up and cancels the auto-merge once the wait runs out', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(0);

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(createReadiness())
        .mockResolvedValueOnce({})
        .mockImplementationOnce(async () => {
          now.mockReturnValue(60 * 60 * 1000);

          return createReadiness(autoMergeOn, 'PENDING');
        })
        .mockRejectedValueOnce(new Error('Not allowed'));

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(run()).rejects.toThrow('Timed out waiting for pull request #1 to be merged');
      // A failure to cancel is only logged
      expect(fetchGraphQL).toHaveBeenLastCalledWith(
        expect.stringContaining('disablePullRequestAutoMerge'),
        { input: { pullRequestId: 'PR_1' } },
      );
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
      now.mockRestore();
    });
  });
});
