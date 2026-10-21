import { encodeBase64 } from '@sveltia/utils/file';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { saveProgress } from '$lib/services/backends/commit-progress';
import {
  commitChanges,
  estimateRemainingCommits,
  fetchFileCommits,
  fetchLastCommit,
  getNextPayloadSize,
  getPayloadSize,
  INITIAL_COMMIT_PAYLOAD_SIZE,
  isUploadFailure,
  MAX_COMMIT_PAYLOAD_SIZE,
  MIN_COMMIT_PAYLOAD_SIZE,
  sortAdditions,
  takeAdditions,
} from '$lib/services/backends/git/github/commits';
import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/fork');
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/commits', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  createCommitMessage: vi.fn().mockReturnValue('Test commit message'),
}));
vi.mock('$lib/services/backends/git/shared/head', () => ({
  repositoryHead: { current: '' },
}));
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Translation message'),
}));
vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn().mockResolvedValue('base64content'),
}));

// Mock global FileReader
Object.defineProperty(global, 'FileReader', {
  value: vi.fn().mockImplementation(() => ({
    readAsText: vi.fn(),
    result: '',
    onload: null,
    onerror: null,
  })),
});

describe('GitHub commits service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(encodeBase64).mockResolvedValue('base64content');
    Object.assign(repository, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
    });
    forkedRepository.current = undefined;
    repositoryHead.current = '';
    vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
  });

  describe('fetchLastCommit', () => {
    test('fetches last commit successfully', async () => {
      const mockCommit = {
        repository: {
          ref: {
            target: {
              history: {
                nodes: [
                  {
                    oid: 'abc123def456',
                    message: 'Test commit message',
                  },
                ],
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockCommit);

      const result = await fetchLastCommit();

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'), {
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(result).toEqual({
        hash: 'abc123def456',
        message: 'Test commit message',
      });
    });

    test('fetches last commit on an Editorial Workflow branch', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          ref: {
            target: {
              history: { nodes: [{ oid: 'abc123def456', message: 'Test commit message' }] },
            },
          },
        },
      });

      const result = await fetchLastCommit('cms/posts/hello');

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'), {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'cms/posts/hello',
      });

      expect(result).toEqual({
        hash: 'abc123def456',
        message: 'Test commit message',
      });
    });

    test('handles commit without author', async () => {
      const mockCommit = {
        repository: {
          ref: {
            target: {
              history: {
                nodes: [
                  {
                    oid: 'abc123def456',
                    message: 'Test commit',
                  },
                ],
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockCommit);

      const result = await fetchLastCommit();

      expect(result).toEqual({
        hash: 'abc123def456',
        message: 'Test commit',
      });
    });

    test('throws error when repository not found', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: null });

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });

    test('throws error when branch not found', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: { ref: null },
      });

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });
  });

  describe('commitChanges', () => {
    test('commits changes successfully', async () => {
      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'content/test-entry.md',
          data: 'title: Test Entry\ncontent: Test content',
        },
        {
          action: 'update',
          path: 'content/updated-entry.md',
          data: 'title: Updated Entry\ncontent: Updated content',
        },
        {
          action: 'delete',
          path: 'content/deleted-entry.md',
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
        commitMessage: 'Add new entry',
        currentUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // Mock fetchLastCommit
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-commit-sha', message: 'Base commit' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'new-commit-sha',
              committedDate: '2023-01-01T00:00:00Z',
              file_0: { oid: 'file-sha-1' },
              file_1: { oid: 'file-sha-2' },
            },
          },
        });

      const result = await commitChanges(changes, options);

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        sha: 'new-commit-sha',
        date: new Date('2023-01-01T00:00:00Z'),
        files: {
          'content/test-entry.md': { sha: 'file-sha-1' },
          'content/updated-entry.md': { sha: 'file-sha-2' },
        },
      });
    });

    test('skips the head lookup when the caller already knows it', async () => {
      const changes = /** @type {any[]} */ ([]);

      const options = /** @type {any} */ ({
        commitType: 'create',
        branch: 'cms/posts/hello',
        headOid: 'known-head-sha',
      });

      vi.mocked(fetchGraphQL).mockResolvedValueOnce({
        createCommitOnBranch: {
          commit: { oid: 'new-commit-sha', committedDate: '2023-01-01T00:00:00Z' },
        },
      });

      await commitChanges(changes, options);

      // Only the commit mutation, with no request to look the branch head up first
      expect(fetchGraphQL).toHaveBeenCalledTimes(1);

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('createCommitOnBranch'), {
        input: expect.objectContaining({ expectedHeadOid: 'known-head-sha' }),
      });
    });

    test('expects the head the loaded site data reflects on the configured branch', async () => {
      repositoryHead.current = 'loaded-head-sha';

      vi.mocked(fetchGraphQL).mockResolvedValueOnce({
        createCommitOnBranch: {
          commit: { oid: 'new-commit-sha', committedDate: '2023-01-01T00:00:00Z' },
        },
      });

      await commitChanges([], /** @type {any} */ ({ commitType: 'update' }));

      // No lookup: the known head is what the commit must go on top of
      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('createCommitOnBranch'), {
        input: expect.objectContaining({ expectedHeadOid: 'loaded-head-sha' }),
      });
    });

    test('still looks the head up for a workflow branch', async () => {
      repositoryHead.current = 'loaded-head-sha';

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: { target: { history: { nodes: [{ oid: 'branch-head-sha', message: '' }] } } },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: { oid: 'new-commit-sha', committedDate: '2023-01-01T00:00:00Z' },
          },
        });

      await commitChanges([], /** @type {any} */ ({ commitType: 'update', branch: 'cms/posts/a' }));

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(fetchGraphQL).toHaveBeenLastCalledWith(
        expect.stringContaining('createCommitOnBranch'),
        { input: expect.objectContaining({ expectedHeadOid: 'branch-head-sha' }) },
      );
    });

    test('reports a commit refused because the branch has moved', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const apiError = new Error('Server responded with an error', {
        cause: { status: 200, message: 'Expected branch to point to "loaded-head-sha"' },
      });

      vi.mocked(fetchGraphQL)
        .mockRejectedValueOnce(apiError)
        // The head lookup that follows finds a different commit
        .mockResolvedValueOnce({
          repository: {
            ref: { target: { history: { nodes: [{ oid: 'someone-elses-sha', message: '' }] } } },
          },
        });

      await expect(
        commitChanges([], /** @type {any} */ ({ commitType: 'update' })),
      ).rejects.toThrow('The branch has moved since the site data was loaded.');
    });

    test('passes any other failure on when the head is where it was expected', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const apiError = new Error('Server responded with an error', { cause: { status: 500 } });

      vi.mocked(fetchGraphQL)
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce({
          repository: {
            ref: { target: { history: { nodes: [{ oid: 'loaded-head-sha', message: '' }] } } },
          },
        });

      await expect(commitChanges([], /** @type {any} */ ({ commitType: 'update' }))).rejects.toBe(
        apiError,
      );
    });

    test('passes the failure on when the head can’t be looked up afterwards', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const apiError = new Error('Server responded with an error', { cause: { status: 500 } });

      vi.mocked(fetchGraphQL)
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(new Error('Failed to send the request'));

      await expect(commitChanges([], /** @type {any} */ ({ commitType: 'update' }))).rejects.toBe(
        apiError,
      );
    });

    test('passes a failure on a workflow branch on without a head lookup', async () => {
      const apiError = new Error('Server responded with an error', { cause: { status: 500 } });

      vi.mocked(fetchGraphQL).mockRejectedValueOnce(apiError);

      await expect(
        commitChanges(
          [],
          /** @type {any} */ ({ commitType: 'update', branch: 'cms/posts/a', headOid: 'known' }),
        ),
      ).rejects.toBe(apiError);
      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
    });

    test('handles empty changes', async () => {
      const changes = /** @type {any[]} */ ([]);

      const options = /** @type {any} */ ({
        commitType: 'update',
        commitMessage: 'No changes',
        currentUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // Mock fetchLastCommit and commitChanges
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-commit-sha', message: 'Base commit' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'empty-commit-sha',
              committedDate: '2023-01-01T00:00:00Z',
            },
          },
        });

      const result = await commitChanges(changes, options);

      expect(result.sha).toBe('empty-commit-sha');
    });

    test('handles API errors', async () => {
      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'content/test-entry.md',
          data: 'title: Test Entry',
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
        commitMessage: 'Add new entry',
        currentUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      const error = new Error('API Error');

      vi.mocked(fetchGraphQL).mockRejectedValue(error);

      await expect(commitChanges(changes, options)).rejects.toThrow('API Error');
    });

    test('builds correct GraphQL mutation', async () => {
      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'new-file.md',
          data: 'content',
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
        commitMessage: 'Add new file',
        currentUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // Mock fetchLastCommit and commitChanges
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-sha', message: 'Base' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'test-sha',
              committedDate: '2023-01-01T00:00:00Z',
              file_0: { oid: 'file-sha' },
            },
          },
        });

      await commitChanges(changes, options);

      expect(fetchGraphQL).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('mutation'),
        expect.objectContaining({
          input: expect.objectContaining({
            branch: {
              repositoryNameWithOwner: 'test-owner/test-repo',
              branchName: 'main',
            },
            expectedHeadOid: 'base-sha',
          }),
        }),
      );
    });

    test('handles changes with undefined data', async () => {
      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'empty-file.md',
          data: undefined, // This should trigger the data ?? '' fallback
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
        commitMessage: 'Add empty file',
        currentUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // Mock fetchLastCommit and commitChanges
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-sha', message: 'Base' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'empty-file-sha',
              committedDate: '2023-01-01T00:00:00Z',
              file_0: { oid: 'empty-content-sha' },
            },
          },
        });

      const result = await commitChanges(changes, options);

      expect(result.sha).toBe('empty-file-sha');
      // Verify that encodeBase64 was called with empty string
      expect(vi.mocked(encodeBase64)).toHaveBeenCalledWith('');
    });

    test('skips OID query for files over 10 MB', async () => {
      const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large-file.pdf', {
        type: 'application/pdf',
      });

      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'content/small-entry.md',
          data: 'title: Small Entry',
        },
        {
          action: 'create',
          path: 'public/files/large-file.pdf',
          data: largeFile,
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
      });

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-sha', message: 'Base' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'commit-sha',
              committedDate: '2023-01-01T00:00:00Z',
              file_0: { oid: 'small-file-sha' },
              // file_1 is not present because the large file OID query was skipped
            },
          },
        });

      const result = await commitChanges(changes, options);
      // Verify the mutation query only includes OID lookup for the small file
      const mutationCall = vi.mocked(fetchGraphQL).mock.calls[1];
      const query = /** @type {string} */ (mutationCall[0]);

      expect(query).toContain('file_0: file(path: "content/small-entry.md") { oid }');
      expect(query).not.toContain('file_1: file(path:');

      expect(result.files).toEqual({
        'content/small-entry.md': { sha: 'small-file-sha' },
        'public/files/large-file.pdf': { sha: undefined, file: largeFile },
      });
    });

    test('skips OID query when all files are over 10 MB', async () => {
      const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.bin', {
        type: 'application/octet-stream',
      });

      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'public/files/large.bin',
          data: largeFile,
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
      });

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-sha', message: 'Base' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'commit-sha',
              committedDate: '2023-01-01T00:00:00Z',
            },
          },
        });

      const result = await commitChanges(changes, options);
      const mutationCall = vi.mocked(fetchGraphQL).mock.calls[1];
      const query = /** @type {string} */ (mutationCall[0]);

      expect(query).not.toContain('file(path:');
      expect(result.files).toEqual({
        'public/files/large.bin': { sha: undefined, file: largeFile },
      });
    });

    test('includes OID query for files at exactly 10 MB', async () => {
      const exactFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'exact.bin', {
        type: 'application/octet-stream',
      });

      const changes = /** @type {any[]} */ ([
        {
          action: 'create',
          path: 'public/files/exact.bin',
          data: exactFile,
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
      });

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: [{ oid: 'base-sha', message: 'Base' }],
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'commit-sha',
              committedDate: '2023-01-01T00:00:00Z',
              file_0: { oid: 'exact-file-sha' },
            },
          },
        });

      const result = await commitChanges(changes, options);
      const mutationCall = vi.mocked(fetchGraphQL).mock.calls[1];
      const query = /** @type {string} */ (mutationCall[0]);

      expect(query).toContain('file_0: file(path: "public/files/exact.bin") { oid }');
      expect(result.files).toEqual({
        'public/files/exact.bin': { sha: 'exact-file-sha' },
      });
    });
  });

  describe('sortAdditions', () => {
    /**
     * Create a file addition.
     * @param {number} index Index.
     * @param {boolean} [isText] Whether the file is a text file, like an entry.
     * @returns {any} File addition.
     */
    const addition = (index, isText = false) => ({
      index,
      path: `file-${index}`,
      contents: 'a',
      data: isText ? 'text' : new Blob(['x']),
    });

    test('puts text files last', () => {
      const entry = addition(0, true);
      const image1 = addition(1);
      const image2 = addition(2);

      expect(sortAdditions([entry, image1, image2])).toEqual({
        queue: [image1, image2, entry],
        addedAgain: [],
      });
    });

    test('sets aside a file deleted and added again at the same path', () => {
      const addedAgain = addition(0);
      const image = addition(1);

      expect(sortAdditions([addedAgain, image], new Set(['file-0']))).toEqual({
        queue: [image],
        addedAgain: [addedAgain],
      });
    });
  });

  describe('takeAdditions', () => {
    /**
     * Create a file addition.
     * @param {number} index Index.
     * @param {number} size Size of the encoded contents.
     * @returns {any} File addition.
     */
    const addition = (index, size) => ({
      index,
      path: `file-${index}`,
      contents: 'a'.repeat(size),
    });

    test('takes as many additions as fit', () => {
      const queue = [addition(0, 40), addition(1, 60), addition(2, 1)];

      expect(takeAdditions(queue, 100)).toEqual([addition(0, 40), addition(1, 60)]);
      expect(queue).toEqual([addition(2, 1)]);
    });

    test('takes a single addition over the size on its own', () => {
      const queue = [addition(0, 200), addition(1, 1)];

      expect(takeAdditions(queue, 100)).toEqual([addition(0, 200)]);
      expect(queue).toEqual([addition(1, 1)]);
    });

    test('takes nothing from an empty queue', () => {
      expect(takeAdditions([], 100)).toEqual([]);
    });
  });

  describe('getPayloadSize', () => {
    test('adds up the size of the encoded contents', () => {
      expect(getPayloadSize(/** @type {any[]} */ ([{ contents: 'abc' }, { contents: 'de' }]))).toBe(
        5,
      );
    });

    test('takes no additions for an empty payload', () => {
      expect(getPayloadSize([])).toBe(0);
    });
  });

  describe('estimateRemainingCommits', () => {
    test('divides the payload by the commit size, rounding up', () => {
      const queue = /** @type {any[]} */ ([{ contents: 'a'.repeat(150) }, { contents: 'a' }]);

      expect(estimateRemainingCommits(queue, 100)).toBe(2);
      expect(estimateRemainingCommits(queue, 50)).toBe(4);
    });

    test('counts the last commit even without additions left', () => {
      expect(estimateRemainingCommits([], 100)).toBe(1);
    });
  });

  describe('getNextPayloadSize', () => {
    test('targets five seconds of upload at the measured speed', () => {
      // 6 MB in 12 seconds is 0.5 MB a second
      expect(getNextPayloadSize(6 * 1024 * 1024, 12000)).toBe(2.5 * 1024 * 1024);
    });

    test('stays within the limits', () => {
      expect(getNextPayloadSize(1024, 10000)).toBe(MIN_COMMIT_PAYLOAD_SIZE);
      expect(getNextPayloadSize(MAX_COMMIT_PAYLOAD_SIZE, 1000)).toBe(MAX_COMMIT_PAYLOAD_SIZE);
      expect(getNextPayloadSize(1024 * 1024, 0)).toBe(MAX_COMMIT_PAYLOAD_SIZE);
    });
  });

  describe('isUploadFailure', () => {
    test('tells a request that took too long from other failures', () => {
      expect(isUploadFailure(new Error('Failed to send the request'))).toBe(true);

      [408, 413, 499, 502, 504].forEach((status) => {
        expect(
          isUploadFailure(new Error('Server responded with an error', { cause: { status } })),
        ).toBe(true);
      });

      expect(
        isUploadFailure(new Error('Server responded with an error', { cause: { status: 422 } })),
      ).toBe(false);
      expect(isUploadFailure(new Error('Failed to fetch'))).toBe(false);
      expect(isUploadFailure(undefined)).toBe(false);
    });
  });

  describe('commitChanges with a large changeset', () => {
    test('commits the changes in several commits, each on top of the previous one', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const half = 'a'.repeat(MAX_COMMIT_PAYLOAD_SIZE / 2 + 1);

      vi.mocked(encodeBase64).mockImplementation(async (data) =>
        typeof data === 'string' ? 'entry' : half,
      );

      const image1 = new File(['1'], 'image1.webp');
      const image2 = new File(['2'], 'image2.webp');

      const changes = /** @type {any[]} */ ([
        { action: 'update', path: 'content/entry.json', data: '{}' },
        { action: 'create', path: 'images/image1.webp', data: image1 },
        { action: 'create', path: 'images/image2.webp', data: image2 },
        { action: 'delete', path: 'images/old.webp' },
      ]);

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: { oid: 'sha-1', committedDate: '2023-01-01T00:00:00Z', file_1: { oid: 'i1' } },
          },
        })
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: {
              oid: 'sha-2',
              committedDate: '2023-01-02T00:00:00Z',
              file_0: { oid: 'e' },
              file_2: { oid: 'i2' },
            },
          },
        });

      const result = await commitChanges(changes, /** @type {any} */ ({ commitType: 'update' }));
      const { calls } = vi.mocked(fetchGraphQL).mock;

      expect(calls).toHaveLength(2);

      const [firstQuery, { input: firstInput }] = /** @type {any} */ (calls[0]);
      const [secondQuery, { input: secondInput }] = /** @type {any} */ (calls[1]);

      // The first image goes on its own, on top of the loaded head
      expect(firstInput.expectedHeadOid).toBe('loaded-head-sha');
      expect(firstInput.fileChanges).toEqual({
        additions: [{ path: 'images/image1.webp', contents: half }],
        deletions: [],
      });
      expect(firstQuery).toContain('file_1: file(path: "images/image1.webp") { oid }');
      expect(firstQuery).not.toContain('file_0');

      // The entry comes last along with the deletion, on top of the first commit
      expect(secondInput.expectedHeadOid).toBe('sha-1');
      expect(secondInput.fileChanges).toEqual({
        additions: [
          { path: 'images/image2.webp', contents: half },
          { path: 'content/entry.json', contents: 'entry' },
        ],
        deletions: [{ path: 'images/old.webp' }],
      });
      expect(secondQuery).toContain('file_0: file(path: "content/entry.json") { oid }');
      expect(secondQuery).toContain('file_2: file(path: "images/image2.webp") { oid }');

      expect(result).toEqual({
        sha: 'sha-2',
        date: new Date('2023-01-02T00:00:00Z'),
        files: {
          'content/entry.json': { sha: 'e' },
          'images/image1.webp': { sha: 'i1' },
          'images/image2.webp': { sha: 'i2' },
        },
      });
    });

    test('reports the commits made until the save ends', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const half = 'a'.repeat(MAX_COMMIT_PAYLOAD_SIZE / 2 + 1);

      vi.mocked(encodeBase64).mockImplementation(async (data) =>
        typeof data === 'string' ? 'entry' : half,
      );

      /** @type {any[]} */
      const reported = [];
      let count = 0;

      vi.mocked(fetchGraphQL).mockImplementation(async () => {
        reported.push(saveProgress.current);
        count += 1;

        return {
          createCommitOnBranch: {
            commit: { oid: `sha-${count}`, committedDate: '2023-01-01T00:00:00Z' },
          },
        };
      });

      await commitChanges(
        /** @type {any[]} */ ([
          { action: 'update', path: 'content/entry.json', data: '{}' },
          { action: 'create', path: 'images/image1.webp', data: new File(['1'], 'image1.webp') },
          { action: 'create', path: 'images/image2.webp', data: new File(['2'], 'image2.webp') },
        ]),
        /** @type {any} */ ({ commitType: 'update' }),
      );

      expect(reported).toHaveLength(2);
      expect(reported[0]).toMatchObject({ phase: 'committing', done: 0, approximate: true });
      expect(reported[0].total).toBeGreaterThanOrEqual(2);
      expect(reported[1]).toMatchObject({ phase: 'committing', done: 1, total: 2 });
      expect(saveProgress.current).toBeUndefined();
    });

    test('clears the progress when a commit fails', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const half = 'a'.repeat(MAX_COMMIT_PAYLOAD_SIZE / 2 + 1);

      vi.mocked(encodeBase64).mockResolvedValue(half);
      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Bad request'));

      await expect(
        commitChanges(
          /** @type {any[]} */ ([
            { action: 'create', path: 'images/image1.webp', data: new File(['1'], 'image1.webp') },
            { action: 'create', path: 'images/image2.webp', data: new File(['2'], 'image2.webp') },
          ]),
          /** @type {any} */ ({ commitType: 'update' }),
        ),
      ).rejects.toThrow('Bad request');

      expect(saveProgress.current).toBeUndefined();
    });

    test('stops at the first commit that fails, before the entry is committed', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const half = 'a'.repeat(MAX_COMMIT_PAYLOAD_SIZE / 2 + 1);

      vi.mocked(encodeBase64).mockImplementation(async (data) =>
        typeof data === 'string' ? 'entry' : half,
      );

      const apiError = new Error('Failed to fetch');

      vi.mocked(fetchGraphQL)
        .mockRejectedValueOnce(apiError)
        // The head lookup that follows finds the head where it was expected
        .mockResolvedValueOnce({
          repository: {
            ref: { target: { history: { nodes: [{ oid: 'loaded-head-sha', message: '' }] } } },
          },
        });

      const changes = /** @type {any[]} */ ([
        { action: 'update', path: 'content/entry.json', data: '{}' },
        { action: 'create', path: 'images/image1.webp', data: new File(['1'], 'image1.webp') },
        { action: 'create', path: 'images/image2.webp', data: new File(['2'], 'image2.webp') },
      ]);

      await expect(
        commitChanges(changes, /** @type {any} */ ({ commitType: 'update' })),
      ).rejects.toBe(apiError);
      expect(
        vi
          .mocked(fetchGraphQL)
          .mock.calls.filter(([query]) => query.includes('createCommitOnBranch')),
      ).toHaveLength(1);
      // Nothing has landed, so the known head stays where it was
      expect(repositoryHead.current).toBe('loaded-head-sha');
    });

    test('takes the last commit made as the head when a later commit fails', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const half = 'a'.repeat(MAX_COMMIT_PAYLOAD_SIZE / 2 + 1);

      vi.mocked(encodeBase64).mockImplementation(async (data) =>
        typeof data === 'string' ? 'entry' : half,
      );

      const apiError = new Error('Failed to fetch');

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: { oid: 'sha-1', committedDate: '2023-01-01T00:00:00Z' },
          },
        })
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce({
          repository: {
            ref: { target: { history: { nodes: [{ oid: 'sha-1', message: '' }] } } },
          },
        });

      const changes = /** @type {any[]} */ ([
        { action: 'update', path: 'content/entry.json', data: '{}' },
        { action: 'create', path: 'images/image1.webp', data: new File(['1'], 'image1.webp') },
        { action: 'create', path: 'images/image2.webp', data: new File(['2'], 'image2.webp') },
      ]);

      await expect(
        commitChanges(changes, /** @type {any} */ ({ commitType: 'update' })),
      ).rejects.toBe(apiError);
      expect(repositoryHead.current).toBe('sha-1');
    });

    test('leaves the known head alone when a later commit on a workflow branch fails', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const half = 'a'.repeat(MAX_COMMIT_PAYLOAD_SIZE / 2 + 1);

      vi.mocked(encodeBase64).mockImplementation(async (data) =>
        typeof data === 'string' ? 'entry' : half,
      );

      const apiError = new Error('Failed to fetch');

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          createCommitOnBranch: {
            commit: { oid: 'sha-1', committedDate: '2023-01-01T00:00:00Z' },
          },
        })
        .mockRejectedValueOnce(apiError);

      const changes = /** @type {any[]} */ ([
        { action: 'update', path: 'content/entry.json', data: '{}' },
        { action: 'create', path: 'images/image1.webp', data: new File(['1'], 'image1.webp') },
        { action: 'create', path: 'images/image2.webp', data: new File(['2'], 'image2.webp') },
      ]);

      await expect(
        commitChanges(
          changes,
          /** @type {any} */ ({ commitType: 'update', branch: 'cms/posts/a', headOid: 'known' }),
        ),
      ).rejects.toBe(apiError);
      expect(repositoryHead.current).toBe('loaded-head-sha');
    });
  });

  describe('commitChanges on a slow connection', () => {
    const MB = 1024 * 1024;
    const uploadFailure = new Error('Failed to send the request');

    /**
     * Create changes adding images, whose encoded contents are 1 MB each, and an entry.
     * @param {number} count Number of images.
     * @returns {any[]} File changes.
     */
    const createChanges = (count) => [
      { action: 'update', path: 'content/entry.json', data: '{}' },
      ...Array.from({ length: count }, (_, index) => ({
        action: 'create',
        path: `images/${index}.webp`,
        data: new File([String(index)], `${index}.webp`),
      })),
    ];

    /**
     * Get the size of the encoded contents added by a commit mutation.
     * @param {any} input Mutation input.
     * @returns {number} Size.
     */
    const getInputPayloadSize = ({ fileChanges }) =>
      fileChanges.additions.reduce(
        (/** @type {number} */ total, /** @type {any} */ { contents }) => total + contents.length,
        0,
      );

    /**
     * Mock the API. Every commit uploads at the given speed, and the head lookup finds the last
     * commit made, or the loaded head before any.
     * @param {object} args Arguments.
     * @param {number} [args.speed] Upload speed, in MB per second.
     * @param {number} [args.failAbove] Payload size above which a commit times out.
     * @param {number} [args.failAt] Number of the commit that fails, counting from 1.
     * @param {Error} [args.error] Error the commit fails with.
     * @param {string} [args.head] Head the lookup finds instead.
     * @returns {any[]} Inputs of the commit mutations sent, including those that failed.
     */
    const mockAPI = ({
      speed = 1,
      failAbove = Infinity,
      failAt = 0,
      error = uploadFailure,
      head = undefined,
    } = {}) => {
      /** @type {any[]} */
      const inputs = [];
      let now = 0;
      let lastOid = 'loaded-head-sha';

      vi.spyOn(performance, 'now').mockImplementation(() => now);

      vi.mocked(fetchGraphQL).mockImplementation(async (query, variables) => {
        if (!query.includes('createCommitOnBranch')) {
          return {
            repository: {
              ref: { target: { history: { nodes: [{ oid: head ?? lastOid, message: '' }] } } },
            },
          };
        }

        const { input } = /** @type {any} */ (variables);

        inputs.push(input);
        now += (getInputPayloadSize(input) / (speed * MB)) * 1000;

        if (getInputPayloadSize(input) > failAbove || inputs.length === failAt) {
          throw error;
        }

        lastOid = `sha-${inputs.length}`;

        return { createCommitOnBranch: { commit: { oid: lastOid, committedDate: '2023-01-01' } } };
      });

      return inputs;
    };

    /**
     * Get the paths added by each commit mutation.
     * @param {any[]} inputs Inputs of the commit mutations.
     * @returns {string[][]} Paths.
     */
    const getPaths = (inputs) =>
      inputs.map(({ fileChanges }) =>
        fileChanges.additions.map((/** @type {any} */ { path }) => path),
      );

    beforeEach(() => {
      repositoryHead.current = 'loaded-head-sha';
      vi.mocked(encodeBase64).mockImplementation(async (data) =>
        typeof data === 'string' ? 'entry' : 'a'.repeat(MB),
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('commits a changeset under the initial size at once', async () => {
      const inputs = mockAPI();

      await commitChanges(createChanges(1), /** @type {any} */ ({ commitType: 'update' }));

      expect(INITIAL_COMMIT_PAYLOAD_SIZE).toBe(2 * MB);
      expect(getPaths(inputs)).toEqual([['images/0.webp', 'content/entry.json']]);
    });

    test('sizes each commit after the speed of the previous one', async () => {
      // 2 MB in 8 seconds makes the next commit 1.25 MB, which takes a single image
      const inputs = mockAPI({ speed: 0.25 });

      const result = await commitChanges(
        createChanges(4),
        /** @type {any} */ ({ commitType: 'update' }),
      );

      expect(getPaths(inputs)).toEqual([
        ['images/0.webp', 'images/1.webp'],
        ['images/2.webp'],
        ['images/3.webp', 'content/entry.json'],
      ]);
      expect(inputs.map(({ expectedHeadOid }) => expectedHeadOid)).toEqual([
        'loaded-head-sha',
        'sha-1',
        'sha-2',
      ]);
      expect(inputs.at(-1).fileChanges.deletions).toEqual([]);
      expect(result.sha).toBe('sha-3');
    });

    test('retries a commit that has timed out with half of the files', async () => {
      const inputs = mockAPI({
        failAbove: 1.5 * MB,
      });

      const result = await commitChanges(
        createChanges(2),
        /** @type {any} */ ({
          commitType: 'update',
          branch: 'cms/posts/a',
          headOid: 'loaded-head-sha',
        }),
      );

      expect(getPaths(inputs)).toEqual([
        ['images/0.webp', 'images/1.webp'],
        ['images/0.webp'],
        ['images/1.webp', 'content/entry.json'],
      ]);
      expect(inputs.map(({ expectedHeadOid }) => expectedHeadOid)).toEqual([
        'loaded-head-sha',
        'loaded-head-sha',
        'sha-2',
      ]);
      expect(result.sha).toBe('sha-3');
    });

    test('keeps the commits below the size that has timed out for the rest of the save', async () => {
      // A 1 MB commit takes a second, which suggests 5 MB, but 2 MB has timed out already
      const inputs = mockAPI({ failAbove: 1.5 * MB });

      const result = await commitChanges(
        createChanges(4),
        /** @type {any} */ ({ commitType: 'update' }),
      );

      expect(getPaths(inputs)).toEqual([
        ['images/0.webp', 'images/1.webp'],
        ['images/0.webp'],
        ['images/1.webp'],
        ['images/2.webp'],
        ['images/3.webp', 'content/entry.json'],
      ]);
      expect(result.sha).toBe('sha-5');
    });

    test('grows the commits again on a connection that has never timed out', async () => {
      // 2 MB in a second suggests 10 MB, which takes every remaining file
      const inputs = mockAPI({ speed: 2 });

      await commitChanges(createChanges(6), /** @type {any} */ ({ commitType: 'update' }));

      expect(getPaths(inputs)).toEqual([
        ['images/0.webp', 'images/1.webp'],
        ['images/2.webp', 'images/3.webp', 'images/4.webp', 'images/5.webp', 'content/entry.json'],
      ]);
    });

    test('doesn’t retry when the branch has moved after a timed-out commit', async () => {
      const inputs = mockAPI({ failAt: 1, head: 'other-sha' });

      await expect(
        commitChanges(
          createChanges(2),
          /** @type {any} */ ({
            commitType: 'update',
            branch: 'cms/posts/a',
            headOid: 'loaded-head-sha',
          }),
        ),
      ).rejects.toBe(uploadFailure);
      expect(inputs).toHaveLength(1);
    });

    test('doesn’t retry when the branch can’t be looked up after a timed-out commit', async () => {
      const inputs = mockAPI({ failAt: 1 });
      const mockCommit = vi.mocked(fetchGraphQL).getMockImplementation();

      vi.mocked(fetchGraphQL).mockImplementation(async (query, variables) => {
        if (!query.includes('createCommitOnBranch')) {
          throw new Error('Failed to send the request');
        }

        return /** @type {any} */ (mockCommit)(query, variables);
      });

      await expect(
        commitChanges(createChanges(2), /** @type {any} */ ({ commitType: 'update' })),
      ).rejects.toBe(uploadFailure);
      expect(inputs).toHaveLength(1);
    });

    test('doesn’t retry a timed-out commit of a single file', async () => {
      const inputs = mockAPI({ failAt: 1 });

      await expect(
        commitChanges(createChanges(0), /** @type {any} */ ({ commitType: 'update' })),
      ).rejects.toBe(uploadFailure);
      expect(inputs).toHaveLength(1);
    });

    test('keeps the assets committed before a later failure on the configured branch', async () => {
      const apiError = new Error('Failed to fetch');

      // The second of three commits fails
      const inputs = mockAPI({
        speed: 0.25,
        failAt: 2,
        error: apiError,
      });

      await expect(
        commitChanges(createChanges(4), /** @type {any} */ ({ commitType: 'update' })),
      ).rejects.toBe(apiError);
      expect(getPaths(inputs)).toEqual([['images/0.webp', 'images/1.webp'], ['images/2.webp']]);
      // The retry of the save goes on top of the first commit
      expect(repositoryHead.current).toBe('sha-1');
    });
  });

  describe('fetchFileCommits', () => {
    test('fetches and returns commits for a single path', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          history_0: {
            target: {
              history: {
                nodes: [
                  {
                    oid: 'abc123',
                    messageHeadline: 'Update Post “hello”',
                    author: {
                      name: 'Alice',
                      email: 'alice@example.com',
                      avatarUrl: 'https://example.com/alice.png',
                      user: { login: 'alice' },
                    },
                    committedDate: '2024-06-01T12:00:00Z',
                  },
                  {
                    oid: 'def456',
                    author: {
                      name: 'Bob',
                      email: 'bob@example.com',
                      avatarUrl: 'https://example.com/bob.png',
                      user: null,
                    },
                    committedDate: '2024-05-01T10:00:00Z',
                  },
                ],
              },
            },
          },
        },
      });

      const result = await fetchFileCommits(['content/en/post.md']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sha: 'abc123',
        message: 'Update Post “hello”',
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        authorAvatarURL: 'https://example.com/alice.png',
        authorLogin: 'alice',
        date: new Date('2024-06-01T12:00:00Z'),
      });
      expect(result[1]).toEqual({
        sha: 'def456',
        // The headline is missing from an incomplete response
        message: '',
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        authorAvatarURL: 'https://example.com/bob.png',
        authorLogin: undefined,
        date: new Date('2024-05-01T10:00:00Z'),
      });
    });

    test('deduplicates commits across multiple paths', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          history_0: {
            target: {
              history: {
                nodes: [
                  {
                    oid: 'abc123',
                    author: {
                      name: 'Alice',
                      email: 'alice@example.com',
                      avatarUrl: 'https://example.com/alice.png',
                      user: { login: 'alice' },
                    },
                    committedDate: '2024-06-01T12:00:00Z',
                  },
                ],
              },
            },
          },
          history_1: {
            target: {
              history: {
                nodes: [
                  {
                    oid: 'abc123',
                    author: {
                      name: 'Alice',
                      email: 'alice@example.com',
                      avatarUrl: 'https://example.com/alice.png',
                      user: { login: 'alice' },
                    },
                    committedDate: '2024-06-01T12:00:00Z',
                  },
                  {
                    oid: 'xyz789',
                    author: {
                      name: 'Carol',
                      email: 'carol@example.com',
                      avatarUrl: 'https://example.com/carol.png',
                      user: { login: 'carol' },
                    },
                    committedDate: '2024-04-01T08:00:00Z',
                  },
                ],
              },
            },
          },
        },
      });

      const result = await fetchFileCommits(['content/en/post.md', 'content/fr/post.md']);

      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('abc123');
      expect(result[1].sha).toBe('xyz789');
    });

    test('returns sorted commits in descending date order', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          history_0: {
            target: {
              history: {
                nodes: [
                  {
                    oid: 'oldest',
                    author: {
                      name: 'A',
                      email: 'a@test.com',
                      avatarUrl: '',
                      user: null,
                    },
                    committedDate: '2024-01-01T00:00:00Z',
                  },
                  {
                    oid: 'newest',
                    author: {
                      name: 'B',
                      email: 'b@test.com',
                      avatarUrl: '',
                      user: null,
                    },
                    committedDate: '2024-12-01T00:00:00Z',
                  },
                ],
              },
            },
          },
        },
      });

      const result = await fetchFileCommits(['file.md']);

      expect(result[0].sha).toBe('newest');
      expect(result[1].sha).toBe('oldest');
    });

    test('keeps the history when a commit has no author', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          history_0: {
            target: {
              history: {
                nodes: [
                  { oid: 'no-author', author: null, committedDate: '2024-01-02T00:00:00Z' },
                  {
                    oid: 'with-author',
                    author: { name: 'Alice', email: 'alice@example.com', user: null },
                    committedDate: '2024-01-01T00:00:00Z',
                  },
                ],
              },
            },
          },
        },
      });

      const result = await fetchFileCommits(['file.md']);

      expect(result).toEqual([
        {
          sha: 'no-author',
          message: '',
          authorName: '',
          authorEmail: undefined,
          authorAvatarURL: undefined,
          authorLogin: undefined,
          date: new Date('2024-01-02T00:00:00Z'),
        },
        {
          sha: 'with-author',
          message: '',
          authorName: 'Alice',
          authorEmail: 'alice@example.com',
          authorAvatarURL: undefined,
          authorLogin: undefined,
          date: new Date('2024-01-01T00:00:00Z'),
        },
      ]);
    });

    test('handles missing history nodes gracefully', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          history_0: {},
        },
      });

      const result = await fetchFileCommits(['file.md']);

      expect(result).toEqual([]);
    });

    test('splits a long path list into several queries', async () => {
      vi.mocked(fetchGraphQL).mockImplementation(async (query) => ({
        repository: Object.fromEntries(
          [.../** @type {string} */ (query).matchAll(/history_(\d+):/g)].map(([, i]) => [
            `history_${i}`,
            {
              target: {
                history: {
                  nodes: [
                    {
                      oid: `sha${i}`,
                      author: { name: 'A', email: 'a@example.com', avatarUrl: '', user: null },
                      committedDate: '2023-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          ]),
        ),
      }));

      const result = await fetchFileCommits(Array.from({ length: 60 }, (_, i) => `file${i}.md`));

      // 60 paths / 50 per query = 2 requests
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($owner: String!, $repo: String!, $branch: String!)'),
        {},
      );
      expect(result).toHaveLength(60);
    });
  });
  describe('Open Authoring', () => {
    beforeEach(() => {
      forkedRepository.current = { owner: 'contributor', repo: 'test-repo' };
      vi.mocked(getWorkflowRepository).mockReturnValue({
        owner: 'contributor',
        repo: 'test-repo',
      });
    });

    test('looks up the last commit on a workflow branch in the fork', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          ref: { target: { history: { nodes: [{ oid: 'abc', message: 'm' }] } } },
        },
      });

      await fetchLastCommit('cms/contributor/test-repo/posts/hello');

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'), {
        owner: 'contributor',
        repo: 'test-repo',
        branch: 'cms/contributor/test-repo/posts/hello',
      });
    });

    test('commits to the fork on a workflow branch', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        createCommitOnBranch: { commit: { oid: 'sha', committedDate: '2026-01-01T00:00:00Z' } },
      });

      await commitChanges([{ action: 'create', path: 'content/posts/hello.md', data: 'x' }], {
        commitType: 'create',
        branch: 'cms/contributor/test-repo/posts/hello',
        headOid: 'abc',
      });

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('createCommitOnBranch'),
        expect.objectContaining({
          input: expect.objectContaining({
            branch: {
              repositoryNameWithOwner: 'contributor/test-repo',
              branchName: 'cms/contributor/test-repo/posts/hello',
            },
          }),
        }),
      );
    });

    test('refuses a change that would bypass review', async () => {
      await expect(
        commitChanges([{ action: 'create', path: 'static/image.png', data: 'x' }], {
          commitType: 'uploadMedia',
        }),
      ).rejects.toThrow('Cannot commit directly to the configured repository');

      expect(fetchGraphQL).not.toHaveBeenCalled();
    });
  });
});
