import { getPathInfo } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/gitlab/commits';
import {
  fetchBlob,
  fetchCommits,
  fetchFileContents,
  fetchFileList,
  fetchFiles,
} from '$lib/services/backends/git/gitlab/files';
import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';

// Mock dependencies
vi.mock('@sveltia/utils/file');
vi.mock('$lib/services/backends/git/gitlab/commits');
vi.mock('$lib/services/backends/git/gitlab/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/fetch');
vi.mock('$lib/services/contents');

describe('GitLab files service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default repository state
    vi.mocked(repository).repo = 'test-repo';
    vi.mocked(repository).branch = 'main';
    vi.mocked(repository).owner = 'test-owner';
  });

  describe('fetchFileList', () => {
    test('fetches all files with pagination', async () => {
      const mockFirstPage = {
        project: {
          repository: {
            tree: {
              blobs: {
                nodes: [
                  { type: 'blob', path: 'file1.md', sha: 'sha1' },
                  { type: 'blob', path: 'file2.md', sha: 'sha2' },
                ],
                pageInfo: {
                  endCursor: 'cursor1',
                  hasNextPage: true,
                },
              },
            },
          },
        },
      };

      const mockSecondPage = {
        project: {
          repository: {
            tree: {
              blobs: {
                nodes: [{ type: 'blob', path: 'file3.md', sha: 'sha3' }],
                pageInfo: {
                  endCursor: 'cursor2',
                  hasNextPage: false,
                },
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(mockFirstPage)
        .mockResolvedValueOnce(mockSecondPage);

      vi.mocked(getPathInfo)
        .mockReturnValueOnce({ basename: 'file1.md', filename: 'file1', extension: 'md' })
        .mockReturnValueOnce({ basename: 'file2.md', filename: 'file2', extension: 'md' })
        .mockReturnValueOnce({ basename: 'file3.md', filename: 'file3', extension: 'md' });

      const result = await fetchFileList();

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!, $cursor: String!)'),
        { cursor: '' },
      );
      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!, $cursor: String!)'),
        { cursor: 'cursor1' },
      );

      expect(result).toEqual([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
        { path: 'file2.md', sha: 'sha2', size: 0, name: 'file2.md' },
        { path: 'file3.md', sha: 'sha3', size: 0, name: 'file3.md' },
      ]);
    });

    test('filters out non-blob entries', async () => {
      const mockResponse = {
        project: {
          repository: {
            tree: {
              blobs: {
                nodes: [
                  { type: 'blob', path: 'file.md', sha: 'sha1' },
                  { type: 'tree', path: 'folder', sha: 'sha2' },
                ],
                pageInfo: {
                  hasNextPage: false,
                },
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);
      vi.mocked(getPathInfo).mockReturnValue({
        basename: 'file.md',
        filename: 'file',
        extension: 'md',
      });

      const result = await fetchFileList();

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('file.md');
    });
  });

  describe('fetchCommits', () => {
    test('fetches commits for files in batches', async () => {
      const paths = ['file1.md', 'file2.md'];

      const mockResponse = {
        project: {
          repository: {
            tree1: {
              lastCommit: {
                author: { id: 'user1', username: 'testuser' },
                authorName: 'Test User',
                authorEmail: 'test@example.com',
                committedDate: '2023-01-01T00:00:00Z',
              },
            },
            tree2: {
              lastCommit: {
                author: null,
                authorName: 'Anonymous',
                authorEmail: 'anon@example.com',
                committedDate: '2023-01-02T00:00:00Z',
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      const result = await fetchCommits(paths);

      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          author: { id: 'user1', username: 'testuser' },
          authorName: 'Test User',
          authorEmail: 'test@example.com',
          committedDate: '2023-01-01T00:00:00Z',
        },
        {
          author: null,
          authorName: 'Anonymous',
          authorEmail: 'anon@example.com',
          committedDate: '2023-01-02T00:00:00Z',
        },
      ]);
    });

    test('handles large number of paths with multiple batches', async () => {
      const paths = Array.from({ length: 20 }, (_, i) => `file${i}.md`);

      const mockResponse1 = {
        project: {
          repository: Array.from({ length: 13 }, (_, i) => ({
            [`tree${i + 1}`]: {
              lastCommit: {
                author: null,
                authorName: `Author ${i + 1}`,
                authorEmail: `author${i + 1}@example.com`,
                committedDate: '2023-01-01T00:00:00Z',
              },
            },
          })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        },
      };

      const mockResponse2 = {
        project: {
          repository: Array.from({ length: 7 }, (_, i) => ({
            [`tree${i + 1}`]: {
              lastCommit: {
                author: null,
                authorName: `Author ${i + 14}`,
                authorEmail: `author${i + 14}@example.com`,
                committedDate: '2023-01-01T00:00:00Z',
              },
            },
          })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        },
      };

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await fetchCommits(paths);

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(20);
    });
  });

  describe('fetchFileContents', () => {
    test('fetches file contents with small file count including commits', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const mockBlobResponse = {
        project: {
          repository: {
            blobs: {
              nodes: [{ size: 100, rawTextBlob: 'file content' }],
            },
          },
        },
      };

      const mockCommit = {
        author: { id: 'user1', username: 'testuser' },
        authorName: 'Test User',
        authorEmail: 'test@example.com',
        committedDate: '2023-01-01T00:00:00Z',
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockBlobResponse);

      // Mock fetchCommits by creating a spy on the module
      const fetchCommitsSpy = vi.fn().mockResolvedValue([mockCommit]);

      vi.doMock(
        '$lib/services/backends/git/gitlab/files',
        async (/** @type {any} */ importOriginal) => {
          const mod = /** @type {any} */ (await importOriginal());

          return {
            ...mod,
            fetchCommits: fetchCommitsSpy,
          };
        },
      );

      const result = await fetchFileContents(files);

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!, $paths: [String!]!)'),
        { paths: ['file1.md'] },
      );

      // Since this is a complex function that calls other internal functions,
      // we mainly test that the GraphQL call is made with correct parameters
      expect(result).toBeDefined();
    });

    test('fetches file contents with large file count without commits', async () => {
      const files = /** @type {any} */ (
        Array.from({ length: 150 }, (_, i) => ({
          path: `file${i}.md`,
          sha: `sha${i}`,
          size: 0,
          name: `file${i}.md`,
        }))
      );

      const mockBlobResponse = {
        project: {
          repository: {
            blobs: {
              nodes: files.map(() => ({ size: 100, rawTextBlob: 'content' })),
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockBlobResponse);

      const result = await fetchFileContents(files);

      // Should make multiple GraphQL calls for batches
      expect(fetchGraphQL).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('handles commit with null author in file contents', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const mockBlobResponse = {
        project: {
          repository: {
            blobs: {
              nodes: [{ size: 100, rawTextBlob: 'file content' }],
            },
          },
        },
      };

      const mockCommit = {
        author: null, // No author object
        authorName: 'Test User',
        authorEmail: 'test@example.com',
        committedDate: '2023-01-01T00:00:00Z',
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockBlobResponse);

      // Mock fetchCommits by creating a spy on the module
      const fetchCommitsSpy = vi.fn().mockResolvedValue([mockCommit]);

      vi.doMock(
        '$lib/services/backends/git/gitlab/files',
        async (/** @type {any} */ importOriginal) => {
          const mod = /** @type {any} */ (await importOriginal());

          return {
            ...mod,
            fetchCommits: fetchCommitsSpy,
          };
        },
      );

      const result = await fetchFileContents(files);

      expect(result).toBeDefined();
    });

    test('handles commit with non-numeric author id in file contents', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const mockBlobResponse = {
        project: {
          repository: {
            blobs: {
              nodes: [{ size: 100, rawTextBlob: 'file content' }],
            },
          },
        },
      };

      const mockCommit = {
        author: { id: 'non-numeric-id', username: 'testuser' }, // Non-numeric ID
        authorName: 'Test User',
        authorEmail: 'test@example.com',
        committedDate: '2023-01-01T00:00:00Z',
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockBlobResponse);

      // Mock fetchCommits by creating a spy on the module
      const fetchCommitsSpy = vi.fn().mockResolvedValue([mockCommit]);

      vi.doMock(
        '$lib/services/backends/git/gitlab/files',
        async (/** @type {any} */ importOriginal) => {
          const mod = /** @type {any} */ (await importOriginal());

          return {
            ...mod,
            fetchCommits: fetchCommitsSpy,
          };
        },
      );

      const result = await fetchFileContents(files);

      expect(result).toBeDefined();
    });
  });

  describe('fetchFiles', () => {
    test('orchestrates full file fetching process', async () => {
      vi.mocked(checkRepositoryAccess).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      expect(checkRepositoryAccess).toHaveBeenCalled();
      expect(fetchAndParseFiles).toHaveBeenCalledWith({
        repository,
        fetchDefaultBranchName,
        fetchLastCommit,
        fetchFileList,
        fetchFileContents: expect.any(Function),
      });
    });

    test('throws error when repository access fails', async () => {
      const error = new Error('Access denied');

      vi.mocked(checkRepositoryAccess).mockRejectedValue(error);

      await expect(fetchFiles()).rejects.toThrow('Access denied');
      expect(fetchAndParseFiles).not.toHaveBeenCalled();
    });
  });

  describe('fetchBlob', () => {
    test('fetches blob data for asset', async () => {
      const asset = /** @type {any} */ ({ path: 'image.png' });
      const mockBlob = new Blob(['image data'], { type: 'image/png' });

      vi.mocked(fetchAPI).mockResolvedValue(mockBlob);

      const result = await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/files/image.png/raw?lfs=true&ref=main',
        { responseType: 'blob' },
      );
      expect(result).toBe(mockBlob);
    });

    test('handles assets with complex paths', async () => {
      const asset = /** @type {any} */ ({ path: 'folder/sub folder/file with spaces.jpg' });
      const mockBlob = new Blob(['image data']);

      vi.mocked(fetchAPI).mockResolvedValue(mockBlob);

      await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/files/folder%2Fsub%20folder%2Ffile%20with%20spaces.jpg/raw?lfs=true&ref=main',
        { responseType: 'blob' },
      );
    });

    test('handles missing branch', async () => {
      // Set repository branch to undefined
      vi.mocked(repository).branch = '';

      const asset = /** @type {any} */ ({ path: 'file.txt' });
      const mockBlob = new Blob(['content']);

      vi.mocked(fetchAPI).mockResolvedValue(mockBlob);

      await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/files/file.txt/raw?lfs=true&ref=',
        { responseType: 'blob' },
      );
    });
  });
});
