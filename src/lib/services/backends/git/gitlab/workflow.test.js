import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import gitlabWorkflow, {
  discard,
  publish,
  savePullRequest,
  updateStatus,
} from '$lib/services/backends/git/gitlab/workflow';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));
vi.mock('$lib/services/backends/git/gitlab/commits');
vi.mock('$lib/services/backends/git/gitlab/repository', () => {
  const mockRepository = { owner: 'group/sub', repo: 'project', branch: 'main' };

  return {
    repository: mockRepository,
    /**
     * Get the project ID the same way the real module does.
     * @returns {string} URL-encoded project path.
     */
    getProjectId: () => encodeURIComponent(`${mockRepository.owner}/${mockRepository.repo}`),
  };
});
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

const PROJECT_ID = encodeURIComponent('group/sub/project');
/** Path to cancel the auto-merge on merge request !1. */
const CANCEL_PATH = `/projects/${PROJECT_ID}/merge_requests/1/cancel_merge_when_pipeline_succeeds`;
/**
 * Get the request body passed to the given `fetchAPI` call.
 * @param {number} [index] Call index.
 * @returns {any} Request body.
 */
const getRequestBody = (index = 0) => vi.mocked(fetchAPI).mock.calls[index][1]?.body;

/**
 * Create a raw merge request as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Merge request.
 */
const createItem = (overrides = {}) => ({
  id: 900,
  iid: 1,
  title: 'Draft: Create Post “hello”',
  web_url: 'https://gitlab.com/group/sub/project/-/merge_requests/1',
  source_branch: 'cms/posts/hello',
  sha: 'abc123',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  author: { id: 7, name: 'Me', username: 'me' },
  labels: ['sveltia-cms/draft'],
  ...overrides,
});

describe('GitLab Editorial Workflow service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitlab' } });
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
  });

  test('exports the expected service structure', () => {
    expect(gitlabWorkflow).toEqual({
      fetchPullRequests: expect.any(Function),
      savePullRequest: expect.any(Function),
      updateStatus: expect.any(Function),
      publish: expect.any(Function),
      discard: expect.any(Function),
    });
  });

  describe('savePullRequest', () => {
    const args = /** @type {any} */ ({
      changes: [],
      options: { commitType: 'create' },
      branch: 'cms/posts/hello',
      title: 'Create Post “hello”',
    });

    test('lets the commit create the branch on the first save', async () => {
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });
      vi.mocked(fetchAPI).mockResolvedValueOnce({
        id: 900,
        iid: 5,
        web_url: 'u',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const result = await savePullRequest(args);

      expect(commitChanges).toHaveBeenCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
        startBranch: 'main',
      });

      // Only the merge request is created here; the branch comes with the commit
      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/merge_requests`, {
        method: 'POST',
        body: expect.objectContaining({ source_branch: 'cms/posts/hello' }),
      });

      expect(result.pullRequest.number).toBe(5);
    });

    test('reuses an existing merge request without creating a branch', async () => {
      const pullRequest = /** @type {any} */ ({ number: 5, branch: 'cms/posts/hello' });

      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });

      const result = await savePullRequest({ ...args, pullRequest });

      expect(fetchAPI).not.toHaveBeenCalled();
      expect(commitChanges).toHaveBeenCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
      });

      expect(result.pullRequest).toBe(pullRequest);
    });

    /** GitLab’s response to `start_branch` when the branch already exists. */
    const branchExists = new Error('A branch called “cms/posts/hello” already exists', {
      cause: { status: 400 },
    });

    /** Merge request as returned by the REST API on creation. */
    const createdMergeRequest = {
      id: 900,
      iid: 5,
      web_url: 'u',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    test('starts over from the configured branch when the branch was left over', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      vi.mocked(fetchAPI)
        // No open merge request from the branch
        .mockResolvedValueOnce([])
        // Branch deletion
        .mockResolvedValueOnce(new Response())
        .mockResolvedValueOnce(createdMergeRequest);

      const result = await savePullRequest(args);

      // The branch is left over from a merge request closed on GitLab rather than discarded in
      // the CMS. Starting from it as it stands would carry that work into the new merge request,
      // so it’s deleted and created afresh from the configured branch by the retried commit
      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        `/projects/${PROJECT_ID}/merge_requests` +
          '?state=opened&source_branch=cms%2Fposts%2Fhello&per_page=100',
      );
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        { method: 'DELETE', responseType: 'text' },
      );
      expect(commitChanges).toHaveBeenCalledTimes(2);
      expect(commitChanges).toHaveBeenLastCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
        startBranch: 'main',
      });
      expect(result.pullRequest.number).toBe(5);
    });

    /** The merge request open from the branch, which the load skipped. */
    const openItem = createItem({ iid: 7, source_project_id: 1, target_project_id: 1 });

    test('commits onto the branch when it has an open merge request the load missed', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      vi.mocked(fetchAPI).mockResolvedValueOnce([openItem]);

      const result = await savePullRequest({ ...args, status: 'draft' });

      // The merge request sits beyond the number fetched, but it’s someone’s work in progress,
      // which is committed onto rather than wiped
      expect(fetchAPI).not.toHaveBeenCalledWith(expect.anything(), {
        method: 'DELETE',
        responseType: 'text',
      });
      expect(commitChanges).toHaveBeenLastCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
      });

      // GitLab refuses to open a second merge request from the same branch, so the commit goes
      // into the one that’s open, which keeps its status
      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(result.pullRequest).toEqual(
        expect.objectContaining({ number: 7, title: 'Create Post “hello”', status: 'draft' }),
      );
    });

    test('puts an open merge request that has lost its label back on the board', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce([{ ...openItem, title: 'Create Post “hello”', labels: ['bug'] }])
        .mockResolvedValueOnce({});

      const result = await savePullRequest({ ...args, status: 'draft' });

      // Labelled and marked as a draft again, rather than opened a second time
      expect(fetchAPI).toHaveBeenCalledTimes(2);
      expect(fetchAPI).toHaveBeenLastCalledWith(`/projects/${PROJECT_ID}/merge_requests/7`, {
        method: 'PUT',
        body: expect.objectContaining({
          title: 'Draft: Create Post “hello”',
          add_labels: 'sveltia-cms/draft',
        }),
      });
      expect(result.pullRequest).toEqual(expect.objectContaining({ number: 7, status: 'draft' }));
    });

    test('starts over when the only open merge request comes from a fork', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      vi.mocked(fetchAPI)
        // A fork can have a branch of the same name, but its merge request isn’t this branch’s
        .mockResolvedValueOnce([{ ...openItem, source_project_id: 2 }])
        .mockResolvedValueOnce(new Response())
        .mockResolvedValueOnce(createdMergeRequest);

      const result = await savePullRequest(args);

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        { method: 'DELETE', responseType: 'text' },
      );
      expect(result.pullRequest.number).toBe(5);
    });

    test('rethrows a commit failure that isn’t about the branch existing', async () => {
      vi.mocked(commitChanges).mockRejectedValue(
        new Error('Forbidden', { cause: { status: 403 } }),
      );

      await expect(savePullRequest(args)).rejects.toThrow('Forbidden');
      expect(fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    const pullRequest = /** @type {any} */ ({
      number: 1,
      title: 'Create Post “hello”',
      status: 'draft',
    });

    test('removes the draft prefix and swaps the label', async () => {
      const result = await updateStatus(pullRequest, 'pending_publish');

      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/merge_requests/1`, {
        method: 'PUT',
        body: {
          title: 'Create Post “hello”',
          add_labels: 'sveltia-cms/pending_publish',
          remove_labels: expect.stringContaining('sveltia-cms/draft'),
        },
      });

      // The new label must not be in the removal list
      expect(getRequestBody().remove_labels).not.toContain('sveltia-cms/pending_publish');

      expect(result.status).toBe('pending_publish');
    });

    test('adds the draft prefix when going back to the draft status', async () => {
      await updateStatus({ ...pullRequest, status: 'pending_review' }, 'draft');

      expect(getRequestBody().title).toBe('Draft: Create Post “hello”');
    });

    test('removes the Netlify/Decap CMS labels as well', async () => {
      await updateStatus(pullRequest, 'pending_review');

      const { remove_labels: removeLabels } = getRequestBody();

      expect(removeLabels).toContain('decap-cms/draft');
      expect(removeLabels).toContain('netlify-cms/draft');
    });
  });

  describe('publish', () => {
    test('merges the merge request and deletes the branch', async () => {
      await publish(
        /** @type {any} */ ({
          number: 1,
          branch: 'cms/posts/hello',
          title: 'Create Post',
          headSHA: 'abc123',
        }),
      );

      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        `/projects/${PROJECT_ID}/merge_requests/1/merge`,
        {
          method: 'PUT',
          body: {
            squash: false,
            should_remove_source_branch: true,
            sha: 'abc123',
            merge_commit_message: 'Create Post',
          },
        },
      );

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('omits the sha when the merge request has no head SHA on record', async () => {
      await publish(
        /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 'Create Post' }),
      );

      expect(getRequestBody().sha).toBeUndefined();
    });

    test('uses a squash merge when configured', async () => {
      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitlab', squash_merges: true } });

      await publish(
        /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't', headSHA: 'sha1' }),
      );

      expect(getRequestBody()).toEqual({
        squash: true,
        should_remove_source_branch: true,
        sha: 'sha1',
        squash_commit_message: 't',
      });
    });

    test('falls back to a regular merge without the config', async () => {
      cmsConfig.current = undefined;

      await publish(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't' }));

      expect(getRequestBody().squash).toBe(false);
    });

    describe('when the pipeline must succeed', () => {
      const pullRequest = /** @type {any} */ ({
        number: 1,
        branch: 'cms/posts/hello',
        title: 'Create Post',
        headSHA: 'abc123',
      });

      /**
       * Create the error `fetchAPI` throws for a failed request.
       * @param {number} status HTTP status code.
       * @returns {Error} Error.
       */
      const createError = (status) =>
        new Error('Request failed', { cause: { status, message: `${status}` } });

      /**
       * A merge request read while GitLab waits for the pipeline.
       * @param {object} [overrides] Properties to override.
       * @returns {any} Merge request.
       */
      const createWaitingItem = (overrides = {}) => ({
        state: 'opened',
        merge_when_pipeline_succeeds: true,
        detailed_merge_status: 'ci_still_running',
        ...overrides,
      });

      /** A merge request that has been merged. */
      const mergedItem = { state: 'merged', merge_when_pipeline_succeeds: false };

      test('sets the merge request to auto-merge while the pipeline is running', async () => {
        vi.mocked(fetchAPI)
          .mockRejectedValueOnce(createError(405))
          .mockResolvedValueOnce({ detailed_merge_status: 'ci_still_running' })
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce(mergedItem);

        await publish(pullRequest);

        // The failed merge, the status read, the auto-merge, and the read that found it merged
        expect(fetchAPI).toHaveBeenCalledTimes(4);

        expect(fetchAPI).toHaveBeenNthCalledWith(2, `/projects/${PROJECT_ID}/merge_requests/1`);

        expect(fetchAPI).toHaveBeenNthCalledWith(
          3,
          `/projects/${PROJECT_ID}/merge_requests/1/merge`,
          {
            method: 'PUT',
            body: {
              squash: false,
              should_remove_source_branch: true,
              sha: 'abc123',
              merge_commit_message: 'Create Post',
              auto_merge: true,
              merge_when_pipeline_succeeds: true,
            },
          },
        );

        // The branch is removed by GitLab once merged; deleting it now would close the request
        expect(fetchAPI).not.toHaveBeenCalledWith(
          expect.stringContaining('/repository/branches/'),
          expect.anything(),
        );
      });

      test('waits for a queued mergeability check before deciding', async () => {
        vi.mocked(fetchAPI)
          .mockRejectedValueOnce(createError(405))
          .mockResolvedValueOnce({ detailed_merge_status: 'preparing' })
          .mockResolvedValueOnce({ detailed_merge_status: 'unchecked' })
          .mockResolvedValueOnce({ detailed_merge_status: 'checking' })
          .mockResolvedValueOnce({ detailed_merge_status: 'ci_still_running' })
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce(mergedItem);

        await publish(pullRequest);

        expect(sleep).toHaveBeenCalledTimes(4);
        expect(sleep).toHaveBeenNthCalledWith(3, 1000);
        expect(fetchAPI).toHaveBeenCalledTimes(7);
        expect(getRequestBody(5).auto_merge).toBe(true);
      });

      describe('once the merge request is set to auto-merge', () => {
        beforeEach(() => {
          vi.mocked(fetchAPI)
            .mockRejectedValueOnce(createError(405))
            .mockResolvedValueOnce({ detailed_merge_status: 'ci_still_running' })
            .mockResolvedValueOnce({});
        });

        test('resolves only once the merge has landed', async () => {
          vi.mocked(fetchAPI)
            .mockResolvedValueOnce(createWaitingItem())
            .mockResolvedValueOnce(createWaitingItem({ detailed_merge_status: 'checking' }))
            .mockResolvedValueOnce(
              createWaitingItem({ detailed_merge_status: 'approvals_syncing' }),
            )
            .mockResolvedValueOnce(createWaitingItem({ detailed_merge_status: 'mergeable' }))
            .mockResolvedValueOnce(createWaitingItem({ state: 'locked' }))
            .mockResolvedValueOnce(mergedItem);

          await publish(pullRequest);

          // The reads are spaced out, because a pipeline takes minutes
          expect(sleep).toHaveBeenCalledTimes(6);
          expect(sleep).toHaveBeenCalledWith(10000);
          expect(fetchAPI).toHaveBeenCalledTimes(9);

          expect(fetchAPI).toHaveBeenLastCalledWith(`/projects/${PROJECT_ID}/merge_requests/1`);

          // GitLab removes the branch along with the merge
          expect(fetchAPI).not.toHaveBeenCalledWith(
            expect.stringContaining('/repository/branches/'),
            expect.anything(),
          );
        });

        test('fails once the pipeline has failed, cancelling the auto-merge', async () => {
          vi.mocked(fetchAPI)
            .mockResolvedValueOnce(createWaitingItem())
            .mockResolvedValueOnce(createWaitingItem({ detailed_merge_status: 'ci_must_pass' }));

          await expect(publish(pullRequest)).rejects.toThrow(
            'Merge request !1 was not merged: opened, ci_must_pass, auto-merge on',
          );

          // GitLab would otherwise still merge once a job is retried by hand, behind the CMS’s
          // back
          expect(fetchAPI).toHaveBeenCalledTimes(6);
          expect(fetchAPI).toHaveBeenLastCalledWith(CANCEL_PATH, { method: 'POST' });
        });

        test('reports the failure even if the auto-merge can’t be cancelled', async () => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const error = createError(406);

          vi.mocked(fetchAPI)
            .mockResolvedValueOnce(createWaitingItem({ detailed_merge_status: 'conflict' }))
            .mockRejectedValueOnce(error);

          await expect(publish(pullRequest)).rejects.toThrow(
            'Merge request !1 was not merged: opened, conflict, auto-merge on',
          );

          expect(warn).toHaveBeenCalledWith(
            'Failed to cancel the auto-merge on merge request !1.',
            error,
          );
        });

        test('fails once a new commit has cancelled the auto-merge', async () => {
          vi.mocked(fetchAPI).mockResolvedValueOnce(
            createWaitingItem({ merge_when_pipeline_succeeds: false }),
          );

          await expect(publish(pullRequest)).rejects.toThrow(
            'Merge request !1 was not merged: opened, ci_still_running, auto-merge off',
          );

          // Nothing left to cancel
          expect(fetchAPI).toHaveBeenCalledTimes(4);
        });

        test('fails once the merge request has been closed', async () => {
          vi.mocked(fetchAPI).mockResolvedValueOnce(
            createWaitingItem({ state: 'closed', detailed_merge_status: 'not_open' }),
          );

          await expect(publish(pullRequest)).rejects.toThrow(
            'Merge request !1 was not merged: closed, not_open, auto-merge on',
          );

          expect(fetchAPI).toHaveBeenCalledTimes(4);
        });

        test.each([
          ['a network error', new Error('Network error')],
          ['a server error', createError(502)],
          ['the request limit', createError(429)],
        ])('keeps waiting when a read fails with %s', async (_label, error) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

          vi.mocked(fetchAPI).mockRejectedValueOnce(error).mockResolvedValueOnce(mergedItem);

          await publish(pullRequest);

          expect(fetchAPI).toHaveBeenCalledTimes(5);
          expect(warn).toHaveBeenCalledWith(
            'Failed to read merge request !1, still waiting.',
            error,
          );
        });

        test.each([401, 403, 404])('gives up when a read fails with a %i', async (status) => {
          const error = createError(status);

          vi.mocked(fetchAPI).mockRejectedValueOnce(error);

          await expect(publish(pullRequest)).rejects.toBe(error);

          // The session has ended or the merge request is gone, so nothing else is tried
          expect(fetchAPI).toHaveBeenCalledTimes(4);
          expect(sleep).toHaveBeenCalledTimes(1);
        });

        test('gives up after an hour, cancelling the auto-merge', async () => {
          vi.useFakeTimers();

          try {
            vi.setSystemTime(0);
            vi.mocked(fetchAPI).mockResolvedValue(createWaitingItem());
            // Every read takes a while, so the wait runs out after a few of them
            vi.mocked(sleep).mockImplementation(async () => {
              vi.advanceTimersByTime(20 * 60 * 1000);
            });

            await expect(publish(pullRequest)).rejects.toThrow(
              'Timed out waiting for merge request !1 to be merged',
            );

            // The three reads within the hour, after the three requests that set the auto-merge,
            // then the cancellation
            expect(fetchAPI).toHaveBeenCalledTimes(7);
            expect(fetchAPI).toHaveBeenLastCalledWith(CANCEL_PATH, { method: 'POST' });
          } finally {
            vi.useRealTimers();
          }
        });
      });

      test('gives up on a mergeability check that never settles', async () => {
        const error = createError(405);

        vi.mocked(fetchAPI)
          .mockRejectedValueOnce(error)
          .mockResolvedValue({ detailed_merge_status: 'checking' });

        await expect(publish(pullRequest)).rejects.toBe(error);

        // The failed merge, then ten status reads
        expect(fetchAPI).toHaveBeenCalledTimes(11);
        expect(sleep).toHaveBeenCalledTimes(9);
      });

      test('keeps failing when something other than the pipeline blocks the merge', async () => {
        const error = createError(405);

        vi.mocked(fetchAPI)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ detailed_merge_status: 'conflict' });

        await expect(publish(pullRequest)).rejects.toBe(error);

        expect(fetchAPI).toHaveBeenCalledTimes(2);
      });

      test('keeps failing without checking the status on any other error', async () => {
        const error = createError(422);

        vi.mocked(fetchAPI).mockRejectedValueOnce(error);

        await expect(publish(pullRequest)).rejects.toBe(error);

        expect(fetchAPI).toHaveBeenCalledTimes(1);
      });

      test('keeps failing on an error without a status', async () => {
        const error = new Error('Network error');

        vi.mocked(fetchAPI).mockRejectedValueOnce(error);

        await expect(publish(pullRequest)).rejects.toBe(error);

        expect(fetchAPI).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('discard', () => {
    test('closes the merge request and deletes the branch', async () => {
      await discard(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `/projects/${PROJECT_ID}/merge_requests/1`, {
        method: 'PUT',
        body: { state_event: 'close' },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
