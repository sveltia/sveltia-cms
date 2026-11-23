// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { forkedRepository, openAuthoringInitialized } from '$lib/services/workflow/open-authoring';

import { fetchRepositoryFiles } from './files';

vi.mock('$lib/services/backends/git/shared/fetch');

describe('fetchRepositoryFiles()', () => {
  const repository = { owner: 'owner', repo: 'repo', branch: 'main' };
  const lastCommit = { hash: 'abc', message: 'Update' };

  /**
   * Create the arguments.
   * @param {boolean} [openAuthoring] Whether Open Authoring is configured.
   * @returns {any} Arguments.
   */
  const createArgs = (openAuthoring = false) => ({
    isOpenAuthoringConfigured: vi.fn(() => openAuthoring),
    initOpenAuthoring: vi.fn().mockResolvedValue(undefined),
    repository,
    checkAccess: vi.fn(),
    checkBranchAccess: vi.fn(),
    fetchDefaultBranchName: vi.fn(),
    fetchLastCommit: vi.fn(),
    lastCommit,
    fetchFileList: vi.fn(),
    fetchFileContents: vi.fn(),
  });

  beforeEach(() => {
    forkedRepository.current = undefined;
    openAuthoringInitialized.current = false;
    vi.mocked(fetchAndParseFiles).mockResolvedValue(undefined);
  });

  test('hands the access checks and the rest of the arguments over', async () => {
    const args = createArgs();
    const fetchFileMetadata = vi.fn();

    await fetchRepositoryFiles({ ...args, fetchFileMetadata });

    expect(args.initOpenAuthoring).not.toHaveBeenCalled();
    expect(fetchAndParseFiles).toHaveBeenCalledWith({
      repository,
      checkAccess: args.checkAccess,
      checkBranchAccess: args.checkBranchAccess,
      fetchDefaultBranchName: args.fetchDefaultBranchName,
      fetchLastCommit: args.fetchLastCommit,
      lastCommit,
      fetchFileList: args.fetchFileList,
      fetchFileContents: args.fetchFileContents,
      fetchFileMetadata,
    });
    expect(vi.mocked(fetchAndParseFiles).mock.calls[0][0]).not.toHaveProperty(
      'isOpenAuthoringConfigured',
    );
  });

  test('sets the fork up before the files are fetched, skipping the access check', async () => {
    const args = createArgs(true);

    await fetchRepositoryFiles(args);

    expect(args.initOpenAuthoring).toHaveBeenCalledBefore(vi.mocked(fetchAndParseFiles));
    expect(fetchAndParseFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        checkAccess: undefined,
        checkBranchAccess: args.checkBranchAccess,
      }),
    );
  });

  test('leaves the fork alone once it has been set up', async () => {
    const args = createArgs(true);

    openAuthoringInitialized.current = true;
    await fetchRepositoryFiles(args);

    expect(args.initOpenAuthoring).not.toHaveBeenCalled();
    expect(fetchAndParseFiles).toHaveBeenCalledWith(
      expect.objectContaining({ checkAccess: undefined }),
    );
  });

  test('skips the branch check for a contributor, whose changes go to their fork', async () => {
    const args = createArgs(true);

    openAuthoringInitialized.current = true;
    forkedRepository.current = { owner: 'contributor', repo: 'fork' };
    await fetchRepositoryFiles(args);

    expect(fetchAndParseFiles).toHaveBeenCalledWith(
      expect.objectContaining({ checkBranchAccess: undefined }),
    );
  });
});
