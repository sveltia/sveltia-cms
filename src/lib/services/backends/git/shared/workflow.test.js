// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

import {
  assertBranchAtHead,
  commitToNewWorkflowBranch,
  deleteRemoteBranch,
  getParentDirs,
  isSquashMergeEnabled,
  openWorkflowPullRequest,
  saveWorkflowBranch,
  toChangedFilesWithModes,
} from './workflow';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => (values ? `${key} ${JSON.stringify(values)}` : key)),
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

const FORK = { owner: 'contributor', repo: 'fork' };

beforeEach(() => {
  forkedRepository.current = undefined;
});

describe('isSquashMergeEnabled()', () => {
  beforeEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns false without a config', () => {
    expect(isSquashMergeEnabled()).toBe(false);
  });

  test('returns false when the option is not set', () => {
    cmsConfig.current = { backend: { name: 'github' } };
    expect(isSquashMergeEnabled()).toBe(false);
  });

  test('returns the option value', () => {
    cmsConfig.current = { backend: { name: 'github', squash_merges: true } };
    expect(isSquashMergeEnabled()).toBe(true);

    cmsConfig.current = { backend: { name: 'gitlab', squash_merges: false } };
    expect(isSquashMergeEnabled()).toBe(false);
  });
});

describe('deleteRemoteBranch()', () => {
  const args = {
    branch: 'cms/posts/hello',
    path: '/branches/cms%2Fposts%2Fhello',
    goneStatuses: [404],
  };

  test('sends a DELETE request to the given path', async () => {
    vi.mocked(fetchAPI).mockResolvedValue('');
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(fetchAPI).toHaveBeenCalledWith('/branches/cms%2Fposts%2Fhello', {
      method: 'DELETE',
      responseType: 'text',
    });
  });

  test('ignores a branch that is already gone without logging it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(fetchAPI).mockRejectedValue(new Error('Error', { cause: { status: 404 } }));
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('ignores any other failure, but logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('Error', { cause: { status: 422 } });

    vi.mocked(fetchAPI).mockRejectedValue(error);
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Failed to delete the cms/posts/hello branch.', error);
    warn.mockRestore();
  });

  test('ignores an error without a status, but logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(fetchAPI).mockRejectedValue(new Error('Network error'));
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('openWorkflowPullRequest()', () => {
  const commit = { sha: 'abc', date: new Date('2026-01-01'), files: {} };
  const created = { number: 1, branch: 'cms/posts/hello', status: 'draft' };

  test('opens a pull request on the service', async () => {
    const createPullRequest = vi.fn().mockResolvedValue(created);
    const args = { branch: 'cms/posts/hello', title: 'Hello', status: 'draft' };

    await expect(openWorkflowPullRequest({ commit, ...args, createPullRequest })).resolves.toBe(
      created,
    );
    expect(createPullRequest).toHaveBeenCalledWith(args);
  });

  test('keeps an Open Authoring draft as a branch without a pull request', async () => {
    const createPullRequest = vi.fn();

    forkedRepository.current = FORK;

    await expect(
      openWorkflowPullRequest({
        commit,
        branch: 'cms/posts/hello',
        title: 'Hello',
        status: 'draft',
        createPullRequest,
      }),
    ).resolves.toEqual({
      title: 'Hello',
      branch: 'cms/posts/hello',
      status: 'draft',
      createdDate: commit.date,
      updatedDate: commit.date,
      files: [],
      canMerge: false,
    });
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  test('opens the pull request of an Open Authoring removal right away', async () => {
    const createPullRequest = vi.fn().mockResolvedValue(created);

    forkedRepository.current = FORK;

    await expect(
      openWorkflowPullRequest({
        commit,
        branch: 'cms/posts/hello',
        title: 'Hello',
        status: 'pending_deletion',
        createPullRequest,
      }),
    ).resolves.toBe(created);
    expect(createPullRequest).toHaveBeenCalledOnce();
  });
});

describe('saveWorkflowBranch()', () => {
  const commit = { sha: 'abc', date: new Date('2026-01-01'), files: {} };
  const changes = [{ action: 'create', path: 'a.md', data: 'a' }];
  const options = { commitType: 'create', collection: undefined };

  /**
   * Create the service-specific functions.
   * @returns {any} Functions.
   */
  const createService = () => ({
    commitToNewBranch: vi.fn().mockResolvedValue(commit),
    commitToExistingBranch: vi.fn().mockResolvedValue(commit),
    createPullRequest: vi.fn().mockResolvedValue({ number: 2 }),
  });

  test('commits onto the branch of an existing pull request', async () => {
    const service = createService();
    const pullRequest = { number: 1, headSHA: 'head' };

    await expect(
      saveWorkflowBranch(
        { changes, options, branch: 'cms/a', title: 'A', status: 'draft', pullRequest },
        service,
      ),
    ).resolves.toEqual({ commit, pullRequest });
    expect(service.commitToExistingBranch).toHaveBeenCalledWith(
      changes,
      { ...options, branch: 'cms/a' },
      pullRequest,
    );
    expect(service.commitToNewBranch).not.toHaveBeenCalled();
    expect(service.createPullRequest).not.toHaveBeenCalled();
  });

  test('commits on a new branch and opens a pull request for it', async () => {
    const service = createService();

    await expect(
      saveWorkflowBranch(
        { changes, options, branch: 'cms/a', title: 'A', status: 'draft' },
        service,
      ),
    ).resolves.toEqual({ commit, pullRequest: { number: 2 } });
    expect(service.commitToNewBranch).toHaveBeenCalledWith(changes, {
      ...options,
      branch: 'cms/a',
    });
    expect(service.createPullRequest).toHaveBeenCalledWith({
      branch: 'cms/a',
      title: 'A',
      status: 'draft',
    });
  });
});

describe('commitToNewWorkflowBranch()', () => {
  const commit = { sha: 'abc', files: {} };
  const branchExists = new Error('Exists', { cause: { status: 422 } });

  /**
   * Create the arguments.
   * @returns {any} Arguments.
   */
  const createArgs = () => ({
    branch: 'cms/a',
    branchExistsStatus: 422,
    commitFromStart: vi.fn().mockResolvedValue(commit),
    commitOnBranch: vi.fn().mockResolvedValue(commit),
    findOpenPullRequest: vi.fn().mockResolvedValue(undefined),
    inUseMessage: 'The workflow branch is in use by another pull request.',
    deleteBranch: vi.fn().mockResolvedValue(undefined),
  });

  test('commits on a branch created from the configured one', async () => {
    const args = createArgs();

    await expect(commitToNewWorkflowBranch(args)).resolves.toBe(commit);
    expect(args.commitFromStart).toHaveBeenCalledOnce();
    expect(args.findOpenPullRequest).not.toHaveBeenCalled();
    expect(args.deleteBranch).not.toHaveBeenCalled();
  });

  test('passes on any failure other than the branch existing', async () => {
    const args = createArgs();
    const failure = new Error('Failed', { cause: { status: 400 } });

    args.commitFromStart.mockRejectedValue(failure);
    await expect(commitToNewWorkflowBranch(args)).rejects.toBe(failure);
    expect(args.findOpenPullRequest).not.toHaveBeenCalled();
  });

  test('passes on a failure without a status', async () => {
    const args = createArgs();
    const failure = new Error('Network error');

    args.commitFromStart.mockRejectedValue(failure);
    await expect(commitToNewWorkflowBranch(args)).rejects.toBe(failure);
  });

  test('commits onto an existing branch with Open Authoring', async () => {
    const args = createArgs();

    forkedRepository.current = FORK;
    args.commitFromStart.mockRejectedValueOnce(branchExists);
    await expect(commitToNewWorkflowBranch(args)).resolves.toBe(commit);
    expect(args.commitOnBranch).toHaveBeenCalledOnce();
    expect(args.findOpenPullRequest).not.toHaveBeenCalled();
    expect(args.deleteBranch).not.toHaveBeenCalled();
  });

  test('refuses a branch a pull request is open from', async () => {
    const args = createArgs();

    args.commitFromStart.mockRejectedValueOnce(branchExists);
    args.findOpenPullRequest.mockResolvedValue('#5');

    const promise = commitToNewWorkflowBranch(args);

    await expect(promise).rejects.toThrow('The workflow branch is in use by another pull request.');
    await promise.catch((ex) => {
      expect(ex.cause.message).toBe('workflow.branch_in_use {"number":"#5"}');
    });
    expect(args.commitFromStart).toHaveBeenCalledOnce();
    expect(args.deleteBranch).not.toHaveBeenCalled();
    expect(args.commitOnBranch).not.toHaveBeenCalled();
  });

  test('deletes a leftover branch and creates it afresh', async () => {
    const args = createArgs();

    args.commitFromStart.mockRejectedValueOnce(branchExists);
    await expect(commitToNewWorkflowBranch(args)).resolves.toBe(commit);
    expect(args.deleteBranch).toHaveBeenCalledWith('cms/a');
    expect(args.commitFromStart).toHaveBeenCalledTimes(2);
    expect(args.commitOnBranch).not.toHaveBeenCalled();
  });
});

describe('assertBranchAtHead()', () => {
  /**
   * Get the repository the branch lives in.
   * @returns {{ owner: string, repo: string }} Repository.
   */
  const getWorkflowRepository = () => ({ owner: 'owner', repo: 'repo' });

  test('returns the head on record when the branch points at it', async () => {
    const fetchBranchHead = vi.fn().mockResolvedValue('head');

    await expect(
      assertBranchAtHead({
        branch: 'cms/a',
        headSHA: 'head',
        fetchBranchHead,
        getWorkflowRepository,
      }),
    ).resolves.toBe('head');
    expect(fetchBranchHead).toHaveBeenCalledWith('cms/a');
  });

  test('refuses a branch that is gone', async () => {
    const promise = assertBranchAtHead({
      branch: 'cms/a',
      headSHA: 'head',
      fetchBranchHead: vi.fn().mockResolvedValue(undefined),
      getWorkflowRepository,
    });

    await expect(promise).rejects.toThrow('Failed to save the changes.');
    await promise.catch((ex) => {
      expect(ex.cause.message).toBe('branch_not_found {"repo":"repo","branch":"cms/a"}');
    });
  });

  test('refuses a branch that has moved', async () => {
    const promise = assertBranchAtHead({
      branch: 'cms/a',
      headSHA: 'head',
      fetchBranchHead: vi.fn().mockResolvedValue('other'),
      getWorkflowRepository,
    });

    await expect(promise).rejects.toThrow(
      'The workflow branch has moved since the entry was loaded.',
    );
    await promise.catch((ex) => {
      expect(ex.cause.message).toBe('save_conflict.branch_moved');
    });
  });

  test('refuses a save without a head on record', async () => {
    await expect(
      assertBranchAtHead({
        branch: 'cms/a',
        headSHA: undefined,
        fetchBranchHead: vi.fn().mockResolvedValue('head'),
        getWorkflowRepository,
      }),
    ).rejects.toThrow('The workflow branch has moved since the entry was loaded.');
  });
});

describe('getParentDirs()', () => {
  test('lists each folder holding the files once, the root as an empty string', () => {
    expect(getParentDirs(['a.md', 'posts/b.md', 'posts/c.md', 'posts/2026/d.md', 'e.md'])).toEqual([
      '',
      'posts',
      'posts/2026',
    ]);
  });

  test('returns an empty list for no files', () => {
    expect(getParentDirs([])).toEqual([]);
  });
});

describe('toChangedFilesWithModes()', () => {
  const statusMap = { added: 'added', deleted: 'removed', renamed: 'renamed' };

  test('converts the files and attaches the modes of all but the removed ones', async () => {
    const fetchFileModes = vi.fn().mockResolvedValue(
      new Map([
        ['a.md', '100644'],
        ['link', '120000'],
        ['c.md', '100644'],
      ]),
    );

    await expect(
      toChangedFilesWithModes(
        [
          { filename: 'a.md', status: 'added' },
          { filename: 'b.md', status: 'deleted' },
          { filename: 'link', status: 'changed', previous_filename: '' },
          { filename: 'c.md', status: 'renamed', previous_filename: 'old/c.md' },
        ],
        { statusMap, headSHA: 'head', fetchFileModes },
      ),
    ).resolves.toStrictEqual([
      { path: 'a.md', status: 'added', previousPath: undefined, mode: '100644' },
      { path: 'b.md', status: 'removed', previousPath: undefined, mode: undefined },
      { path: 'link', status: 'modified', previousPath: undefined, mode: '120000' },
      { path: 'c.md', status: 'renamed', previousPath: 'old/c.md', mode: '100644' },
    ]);
    expect(fetchFileModes).toHaveBeenCalledWith({
      headSHA: 'head',
      paths: ['a.md', 'link', 'c.md'],
    });
  });
});
