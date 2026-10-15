import { _ } from '@sveltia/i18n';
import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkDirectCommitAllowed,
  checkMergedBranch,
  checkPublishAllowed,
  checkStatusAllowed,
  createDraftPullRequest,
  createForkError,
  ensureForkPermission,
  isOpenAuthoringConfiguredFor,
  pollForFork,
  pruneForkBranches,
  requestForkWithFallbackName,
  resolveWorkflowRepository,
  runOpenAuthoringSetUp,
  setUpForkFor,
  updateForkStatusWith,
} from '$lib/services/backends/git/shared/fork';
import { cmsConfig } from '$lib/services/config';
import {
  ENTRY_ALREADY_PUBLISHED,
  forkedRepository,
  openAuthoringInitialized,
  requestForkPermission,
} from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/i18n', async () => (await import('$lib/test/i18n')).createI18nMock());
vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));
vi.mock('$lib/services/workflow/open-authoring', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  requestForkPermission: vi.fn(),
}));

describe('shared fork service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forkedRepository.current = undefined;
    openAuthoringInitialized.current = false;
  });

  describe('isOpenAuthoringConfiguredFor', () => {
    test('is on with the option for the given backend', () => {
      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea', open_authoring: true } });
      expect(isOpenAuthoringConfiguredFor('gitea')).toBe(true);
    });

    test('is off without the option, with another backend, or without a config', () => {
      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea' } });
      expect(isOpenAuthoringConfiguredFor('gitea')).toBe(false);

      cmsConfig.current = /** @type {any} */ ({
        backend: { name: 'gitea', open_authoring: 'true' },
      });
      expect(isOpenAuthoringConfiguredFor('gitea')).toBe(false);

      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea', open_authoring: true } });
      expect(isOpenAuthoringConfiguredFor('github')).toBe(false);

      cmsConfig.current = undefined;
      expect(isOpenAuthoringConfiguredFor('gitea')).toBe(false);
    });
  });

  describe('resolveWorkflowRepository', () => {
    /** @type {any} */
    const repository = { owner: 'owner', repo: 'repo', branch: 'main' };

    test('is the configured repository without a fork', () => {
      expect(resolveWorkflowRepository(repository)).toEqual({ owner: 'owner', repo: 'repo' });
    });

    test('is the fork while contributing', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };
      expect(resolveWorkflowRepository(repository)).toEqual({
        owner: 'contributor',
        repo: 'repo',
      });
    });
  });

  describe('ensureForkPermission', () => {
    test('returns once the user agrees', async () => {
      vi.mocked(requestForkPermission).mockResolvedValue(true);

      await expect(
        ensureForkPermission({ repoPath: 'owner/repo', allowForking: true }),
      ).resolves.toBeUndefined();

      expect(requestForkPermission).toHaveBeenCalledWith('owner/repo');
    });

    test('stops when the service doesn’t allow forks', async () => {
      await expect(
        ensureForkPermission({ repoPath: 'owner/repo', allowForking: false }),
      ).rejects.toThrow('The repository does not allow forking');

      expect(requestForkPermission).not.toHaveBeenCalled();
    });

    test('stops when the user declines', async () => {
      vi.mocked(requestForkPermission).mockResolvedValue(false);

      await expect(
        ensureForkPermission({ repoPath: 'owner/repo', allowForking: true }),
      ).rejects.toThrow('Permission to fork the repository was declined');
    });
  });

  describe('createForkError', () => {
    test('logs the failure and creates an error naming the repository', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ex = new Error('Forbidden');
      const result = createForkError('owner/repo', ex);

      expect(result.message).toBe('Failed to fork the repository.');
      expect(result.cause).toEqual(
        expect.objectContaining({ message: 'open_authoring.fork_failed' }),
      );
      expect(_).toHaveBeenCalledWith('open_authoring.fork_failed', {
        values: { repo: 'owner/repo' },
      });
      expect(error).toHaveBeenCalledWith('Failed to fork the repository.', ex);
    });
  });

  describe('requestForkWithFallbackName', () => {
    const fork = { full_name: 'me/repo' };
    const renamedFork = { full_name: 'me/owner-repo' };
    /**
     * Create an error carrying the given HTTP status, as `fetchAPI` throws.
     * @param {number} status HTTP status code.
     * @returns {Error} Error.
     */
    const createError = (status) => new Error('Request failed', { cause: { status } });

    /**
     * Build the arguments, with mocked functions.
     * @param {object} [overrides] Properties to override.
     * @returns {any} Arguments.
     */
    const createArgs = (overrides = {}) => ({
      repoPath: 'owner/repo',
      requestFork: vi.fn().mockResolvedValue(fork),
      requestRenamedFork: vi.fn().mockResolvedValue(renamedFork),
      conflictStatuses: [400, 409],
      isNameTaken: vi.fn().mockResolvedValue(true),
      ...overrides,
    });

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('returns the fork created at the default name', async () => {
      const args = createArgs();

      await expect(requestForkWithFallbackName(args)).resolves.toBe(fork);
      expect(args.isNameTaken).not.toHaveBeenCalled();
      expect(args.requestRenamedFork).not.toHaveBeenCalled();
    });

    test.each([400, 409])('falls back to another name on a %i name conflict', async (status) => {
      const args = createArgs({ requestFork: vi.fn().mockRejectedValue(createError(status)) });

      await expect(requestForkWithFallbackName(args)).resolves.toBe(renamedFork);
      expect(args.isNameTaken).toHaveBeenCalledOnce();
    });

    test('throws on any other failure without retrying', async () => {
      const args = createArgs({ requestFork: vi.fn().mockRejectedValue(createError(403)) });

      await expect(requestForkWithFallbackName(args)).rejects.toThrow(
        'Failed to fork the repository.',
      );
      expect(args.isNameTaken).not.toHaveBeenCalled();
      expect(args.requestRenamedFork).not.toHaveBeenCalled();
    });

    test('throws on a conflict when the default name is free', async () => {
      const args = createArgs({
        requestFork: vi.fn().mockRejectedValue(createError(409)),
        isNameTaken: vi.fn().mockResolvedValue(false),
      });

      await expect(requestForkWithFallbackName(args)).rejects.toThrow(
        'Failed to fork the repository.',
      );
      expect(args.requestRenamedFork).not.toHaveBeenCalled();
    });

    test('throws when the fork at the fallback name fails too', async () => {
      const retryError = createError(422);

      const args = createArgs({
        requestFork: vi.fn().mockRejectedValue(createError(409)),
        requestRenamedFork: vi.fn().mockRejectedValue(retryError),
      });

      await expect(requestForkWithFallbackName(args)).rejects.toThrow(
        'Failed to fork the repository.',
      );
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledWith('Failed to fork the repository.', retryError);
    });
  });

  describe('pollForFork', () => {
    test('returns as soon as the fork is ready', async () => {
      const checkFork = vi.fn().mockResolvedValue('ready');

      await expect(pollForFork({ repoPath: 'me/repo', checkFork })).resolves.toBeUndefined();
      expect(checkFork).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    test('waits between attempts until the copy is done', async () => {
      const checkFork = vi.fn().mockResolvedValueOnce('pending').mockResolvedValueOnce('ready');

      await pollForFork({ repoPath: 'me/repo', checkFork });
      expect(checkFork).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    test('gives up as soon as the service says the copy failed', async () => {
      const checkFork = vi.fn().mockResolvedValue('failed');

      await expect(pollForFork({ repoPath: 'me/repo', checkFork })).rejects.toThrow(
        'The fork could not be created.',
      );

      expect(checkFork).toHaveBeenCalledTimes(1);
    });

    test('gives up after the last attempt', async () => {
      const checkFork = vi.fn().mockResolvedValue('pending');

      await expect(
        pollForFork({ repoPath: 'me/repo', checkFork, attemptsLeft: 2 }),
      ).rejects.toThrow('Timed out waiting for the fork to be created.');

      expect(checkFork).toHaveBeenCalledTimes(2);
    });
  });

  describe('runOpenAuthoringSetUp', () => {
    test('flags the set-up as done', async () => {
      const setUp = vi.fn(async () => {
        forkedRepository.current = { owner: 'contributor', repo: 'repo' };
      });

      await runOpenAuthoringSetUp(setUp);
      expect(forkedRepository.current).toEqual({ owner: 'contributor', repo: 'repo' });
      expect(openAuthoringInitialized.current).toBe(true);
    });

    test('clears a fork left over from an earlier session', async () => {
      forkedRepository.current = { owner: 'previous', repo: 'repo' };
      openAuthoringInitialized.current = true;

      // A maintainer’s set-up records no fork
      await runOpenAuthoringSetUp(async () => {});
      expect(forkedRepository.current).toBeUndefined();
      expect(openAuthoringInitialized.current).toBe(true);
    });

    test('leaves the set-up unflagged when it fails', async () => {
      await expect(
        runOpenAuthoringSetUp(async () => {
          throw new Error('No access to the repository');
        }),
      ).rejects.toThrow('No access to the repository');

      expect(openAuthoringInitialized.current).toBe(false);
    });
  });

  describe('setUpForkFor', () => {
    const fork = { owner: 'contributor', repo: 'repo' };

    /**
     * Create the set-up hooks.
     * @param {object} [options] Options.
     * @param {boolean} [options.canWrite] Whether the user can write to the repository.
     * @param {{ owner: string, repo: string }} [options.existingFork] Existing fork.
     * @returns {any} Arguments.
     */
    const createArgs = ({ canWrite = false, existingFork = undefined } = {}) => ({
      repoPath: 'owner/repo',
      fetchAccess: vi.fn(async () => ({ canWrite, allowForking: true })),
      prepare: vi.fn(async () => {}),
      fetchFork: vi.fn(async () => existingFork),
      prepareFork: vi.fn(async () => {}),
      fetchForkingAllowed: vi.fn(({ allowForking }) => allowForking),
      createFork: vi.fn(async () => fork),
    });

    test('leaves a maintainer on the configured repository', async () => {
      const args = createArgs({ canWrite: true });

      await setUpForkFor(args);
      expect(args.prepare).not.toHaveBeenCalled();
      expect(args.fetchFork).not.toHaveBeenCalled();
      expect(forkedRepository.current).toBeUndefined();
    });

    test('takes an existing fork once it’s prepared', async () => {
      const args = createArgs({ existingFork: fork });

      await setUpForkFor(args);
      expect(args.prepare).toHaveBeenCalledOnce();
      expect(args.prepareFork).toHaveBeenCalledWith(fork);
      expect(args.createFork).not.toHaveBeenCalled();
      expect(forkedRepository.current).toEqual(fork);
    });

    test('creates a fork with the user’s permission', async () => {
      const args = createArgs();

      vi.mocked(requestForkPermission).mockResolvedValue(true);
      await setUpForkFor(args);
      expect(args.fetchForkingAllowed).toHaveBeenCalledWith({
        canWrite: false,
        allowForking: true,
      });
      expect(requestForkPermission).toHaveBeenCalledWith('owner/repo');
      expect(args.prepareFork).not.toHaveBeenCalled();
      expect(forkedRepository.current).toEqual(fork);
    });

    test('works without the optional hooks', async () => {
      const args = createArgs({ existingFork: fork });

      delete args.prepare;
      delete args.prepareFork;

      await setUpForkFor(args);
      expect(forkedRepository.current).toEqual(fork);
    });

    test('creates no fork when the user declines', async () => {
      const args = createArgs();

      vi.mocked(requestForkPermission).mockResolvedValue(false);
      await expect(setUpForkFor(args)).rejects.toThrow(
        'Permission to fork the repository was declined',
      );
      expect(args.createFork).not.toHaveBeenCalled();
      expect(forkedRepository.current).toBeUndefined();
    });
  });

  describe('checkPublishAllowed', () => {
    test('lets a maintainer publish', () => {
      expect(() => checkPublishAllowed()).not.toThrow();
    });

    test('stops a contributor', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(() => checkPublishAllowed()).toThrow(
        'Cannot publish as an Open Authoring contributor',
      );
    });
  });

  describe('checkDirectCommitAllowed', () => {
    test('lets a maintainer commit anywhere', () => {
      expect(() => checkDirectCommitAllowed({ commitType: 'create' })).not.toThrow();
      expect(() =>
        checkDirectCommitAllowed({ commitType: 'create', branch: 'cms/posts/hello' }),
      ).not.toThrow();
    });

    test('lets a contributor commit to a workflow branch', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(() =>
        checkDirectCommitAllowed({ commitType: 'create', branch: 'cms/posts/hello' }),
      ).not.toThrow();
    });

    test('stops a contributor committing to the configured branch', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(() => checkDirectCommitAllowed({ commitType: 'create' })).toThrow(
        'Cannot commit directly to the configured repository',
      );
    });
  });

  describe('checkStatusAllowed', () => {
    test('allows the stages a contributor has', () => {
      expect(() => checkStatusAllowed('draft')).not.toThrow();
      expect(() => checkStatusAllowed('pending_review')).not.toThrow();
    });

    test('stops the stage that publishes', () => {
      expect(() => checkStatusAllowed('pending_publish')).toThrow(
        'Cannot mark an entry ready to publish as an Open Authoring contributor',
      );
    });
  });

  describe('checkMergedBranch', () => {
    const branch = 'cms/contributor/repo/posts/hello';
    const deleteBranch = vi.fn();

    test('deletes a branch still at the merged head and reports the entry as published', async () => {
      const fetchBranchHead = vi.fn().mockResolvedValue('head1');

      await expect(
        checkMergedBranch({ branch, mergedSHA: 'head1', fetchBranchHead, deleteBranch }),
      ).rejects.toThrow(ENTRY_ALREADY_PUBLISHED);

      expect(fetchBranchHead).toHaveBeenCalledWith(branch);
      expect(deleteBranch).toHaveBeenCalledWith(branch);
    });

    test('carries the localized message for the contributor', async () => {
      const fetchBranchHead = vi.fn().mockResolvedValue('head1');

      await expect(
        checkMergedBranch({ branch, mergedSHA: 'head1', fetchBranchHead, deleteBranch }),
      ).rejects.toMatchObject({
        cause: { message: 'open_authoring.entry_already_published' },
      });
    });

    test('reports a branch that is already gone as published, with nothing to delete', async () => {
      // A maintainer can delete the branch along with the merge
      const fetchBranchHead = vi.fn().mockResolvedValue(undefined);

      await expect(
        checkMergedBranch({ branch, mergedSHA: 'head1', fetchBranchHead, deleteBranch }),
      ).rejects.toThrow(ENTRY_ALREADY_PUBLISHED);

      expect(deleteBranch).not.toHaveBeenCalled();
    });

    test('leaves a branch committed to since the merge alone', async () => {
      // The contributor edited the entry again, which makes it a fresh draft
      const fetchBranchHead = vi.fn().mockResolvedValue('head2');

      await expect(
        checkMergedBranch({ branch, mergedSHA: 'head1', fetchBranchHead, deleteBranch }),
      ).resolves.toBeUndefined();

      expect(deleteBranch).not.toHaveBeenCalled();
    });
  });

  describe('pruneForkBranches', () => {
    test('deletes the leftover branches and returns the parsed rest in order', async () => {
      const deleteBranch = vi.fn().mockResolvedValue(undefined);
      const items = ['a', 'b', 'c', 'd'];

      const classify = vi.fn((/** @type {string} */ name, /** @type {number} */ index) =>
        index % 2
          ? { leftover: `cms/${name}` }
          : { pending: /** @type {any} */ ({ branch: `cms/${name}` }) },
      );

      await expect(pruneForkBranches(items, classify, deleteBranch)).resolves.toEqual([
        { branch: 'cms/a' },
        { branch: 'cms/c' },
      ]);

      expect(classify).toHaveBeenCalledWith('a', 0);
      expect(classify).toHaveBeenCalledWith('d', 3);
      expect(deleteBranch).toHaveBeenCalledTimes(2);
      expect(deleteBranch).toHaveBeenCalledWith('cms/b');
      expect(deleteBranch).toHaveBeenCalledWith('cms/d');
    });

    test('deletes nothing when no branch is left over', async () => {
      const deleteBranch = vi.fn();

      await expect(
        pruneForkBranches(['a'], () => ({ pending: /** @type {any} */ ({}) }), deleteBranch),
      ).resolves.toHaveLength(1);

      expect(deleteBranch).not.toHaveBeenCalled();
    });
  });

  describe('updateForkStatusWith', () => {
    const branch = 'cms/contributor/repo/posts/hello';
    const createRequest = vi.fn();
    const fetchRequest = vi.fn();
    const applyStatus = vi.fn();
    const fetchBranchHead = vi.fn();
    const deleteBranch = vi.fn();

    /**
     * Build a pull request known to the board.
     * @param {Record<string, any>} [props] Properties to override.
     * @returns {any} Pull request.
     */
    const createPullRequest = (props = {}) => ({
      number: 5,
      nodeId: 'PR_5',
      url: 'https://example.com/pull/5',
      title: 'Hello',
      branch,
      status: 'pending_review',
      files: [],
      ...props,
    });

    /**
     * Build the state a backend reads for a request.
     * @param {Record<string, any>} [props] Properties to override.
     * @returns {any} Request state.
     */
    const createState = (props = {}) => ({
      merged: false,
      isEntryRequest: true,
      getMergedSHA: vi.fn().mockResolvedValue('head1'),
      state: 'open',
      draft: false,
      ...props,
    });

    /**
     * Run the function with the mocked callbacks.
     * @param {any} pullRequest Pull request.
     * @param {any} status New status.
     * @param {'number' | 'nodeId'} [requestKey] Identifying property.
     * @returns {Promise<any>} Result.
     */
    const run = (pullRequest, status, requestKey = 'number') =>
      updateForkStatusWith({
        pullRequest,
        status,
        requestKey,
        createRequest,
        fetchRequest,
        applyStatus,
        fetchBranchHead,
        deleteBranch,
      });

    test('stops the stage that publishes before reading anything', async () => {
      await expect(run(createPullRequest(), 'pending_publish')).rejects.toThrow(
        'Cannot mark an entry ready to publish as an Open Authoring contributor',
      );

      expect(fetchRequest).not.toHaveBeenCalled();
    });

    test('keeps a draft without a request as a branch', async () => {
      const pullRequest = createPullRequest({ number: undefined, status: 'draft' });
      const result = await run(pullRequest, 'draft');

      expect(result).toMatchObject({ number: undefined, status: 'draft' });
      expect(result.updatedDate).toBeInstanceOf(Date);
      expect(createRequest).not.toHaveBeenCalled();
      expect(fetchRequest).not.toHaveBeenCalled();
    });

    test('opens a request for a draft moving to review', async () => {
      const created = createPullRequest({ number: 6 });

      createRequest.mockResolvedValue(created);

      await expect(run(createPullRequest({ number: undefined }), 'pending_review')).resolves.toBe(
        created,
      );

      expect(createRequest).toHaveBeenCalledWith({
        branch,
        title: 'Hello',
        status: 'pending_review',
      });
    });

    test('identifies the request by the given property', async () => {
      createRequest.mockResolvedValue(createPullRequest());

      // A pull request with a number but no node ID has nothing opened as far as GitHub goes
      await run(createPullRequest({ nodeId: undefined }), 'pending_review', 'nodeId');

      expect(createRequest).toHaveBeenCalled();
      expect(fetchRequest).not.toHaveBeenCalled();
    });

    test('applies the status to the request in the state it was read in', async () => {
      const pullRequest = createPullRequest();

      fetchRequest.mockResolvedValue(createState({ state: 'closed', draft: true }));

      const result = await run(pullRequest, 'draft');

      expect(fetchRequest).toHaveBeenCalledWith(pullRequest);
      expect(applyStatus).toHaveBeenCalledWith({
        pullRequest,
        status: 'draft',
        state: 'closed',
        draft: true,
      });
      expect(result).toMatchObject({ number: 5, status: 'draft' });
      expect(result.updatedDate).toBeInstanceOf(Date);
    });

    test('carries on with what the entry knows when the request can’t be found', async () => {
      const pullRequest = createPullRequest();

      fetchRequest.mockResolvedValue(undefined);

      await expect(run(pullRequest, 'pending_review')).resolves.toMatchObject({
        number: 5,
        status: 'pending_review',
      });

      expect(applyStatus).toHaveBeenCalledWith({
        pullRequest,
        status: 'pending_review',
        state: undefined,
        draft: undefined,
      });
    });

    test('reports an entry whose request was merged with nothing left as published', async () => {
      const state = createState({ merged: true });

      fetchRequest.mockResolvedValue(state);
      fetchBranchHead.mockResolvedValue('head1');

      await expect(run(createPullRequest(), 'draft')).rejects.toThrow(ENTRY_ALREADY_PUBLISHED);

      expect(state.getMergedSHA).toHaveBeenCalled();
      expect(deleteBranch).toHaveBeenCalledWith(branch);
      expect(applyStatus).not.toHaveBeenCalled();
    });

    test('opens a fresh request for a branch committed to since the merge', async () => {
      const created = createPullRequest({ number: 6 });

      fetchRequest.mockResolvedValue(createState({ merged: true }));
      fetchBranchHead.mockResolvedValue('head2');
      createRequest.mockResolvedValue(created);

      await expect(run(createPullRequest(), 'pending_review')).resolves.toBe(created);

      expect(deleteBranch).not.toHaveBeenCalled();
      expect(applyStatus).not.toHaveBeenCalled();
      expect(createRequest).toHaveBeenCalledWith({
        branch,
        title: 'Hello',
        status: 'pending_review',
      });
    });

    test('drops a request that is no longer the entry’s', async () => {
      const state = createState({ isEntryRequest: false });

      fetchRequest.mockResolvedValue(state);

      const result = await run(createPullRequest(), 'draft');

      expect(result).toMatchObject({
        number: undefined,
        nodeId: undefined,
        url: undefined,
        status: 'draft',
      });
      expect(state.getMergedSHA).not.toHaveBeenCalled();
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(applyStatus).not.toHaveBeenCalled();
    });

    test('doesn’t check the branch of a merged request that isn’t the entry’s', async () => {
      const state = createState({ merged: true, isEntryRequest: false });

      fetchRequest.mockResolvedValue(state);
      createRequest.mockResolvedValue(createPullRequest({ number: 6 }));

      await run(createPullRequest(), 'pending_review');

      expect(state.getMergedSHA).not.toHaveBeenCalled();
      expect(fetchBranchHead).not.toHaveBeenCalled();
      expect(createRequest).toHaveBeenCalled();
    });
  });

  describe('createDraftPullRequest', () => {
    test('stands in for the merge request a draft doesn’t have yet', () => {
      const date = new Date('2026-01-01T00:00:00Z');

      expect(
        createDraftPullRequest({
          commit: /** @type {any} */ ({ date, sha: 'abc' }),
          branch: 'cms/posts/hello',
          title: 'Create Hello',
        }),
      ).toEqual({
        title: 'Create Hello',
        branch: 'cms/posts/hello',
        status: 'draft',
        createdDate: date,
        updatedDate: date,
        files: [],
        canMerge: false,
      });
    });
  });
});
