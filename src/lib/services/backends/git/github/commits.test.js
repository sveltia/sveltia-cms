import { encodeBase64 } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/github/commits';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/commits', () => ({
  createCommitMessage: vi.fn().mockReturnValue('Test commit message'),
}));
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Translation message'),
}));
vi.mock('svelte/store', () => ({
  get: vi.fn().mockReturnValue({}),
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
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        authorAvatarURL: 'https://example.com/alice.png',
        authorLogin: 'alice',
        date: new Date('2024-06-01T12:00:00Z'),
      });
      expect(result[1]).toEqual({
        sha: 'def456',
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

    test('handles missing history nodes gracefully', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          history_0: {},
        },
      });

      const result = await fetchFileCommits(['file.md']);

      expect(result).toEqual([]);
    });
  });
});
