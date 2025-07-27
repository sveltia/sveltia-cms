import { encodeBase64 } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges, fetchLastCommit } from '$lib/services/backends/git/github/commits';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/commits', () => ({
  createCommitMessage: vi.fn().mockReturnValue('Test commit message'),
}));
vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn(),
    set: vi.fn(),
  },
  get: vi.fn().mockImplementation(() => () => 'Translation message'),
}));
vi.mock('svelte/store', () => ({
  get: vi.fn().mockImplementation((store) => {
    // Mock the _ store to return a translation function
    if (store && store.subscribe) {
      return () => 'Translation message';
    }

    return {};
  }),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
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
    Object.assign(repository, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
    });
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

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'));
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
  });
});
