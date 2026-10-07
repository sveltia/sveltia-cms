import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkMergedBranch,
  checkPublishAllowed,
  checkStatusAllowed,
  createDraftPullRequest,
  ensureForkPermission,
  pollForFork,
  resolveWorkflowRepository,
  runOpenAuthoringSetUp,
} from '$lib/services/backends/git/shared/fork';
import {
  ENTRY_ALREADY_PUBLISHED,
  forkedRepository,
  openAuthoringInitialized,
  requestForkPermission,
} from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
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
