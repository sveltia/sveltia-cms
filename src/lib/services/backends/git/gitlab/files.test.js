import { getPathInfo } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/gitlab/commits';
import {
  fetchBlob,
  fetchBlobs,
  fetchCommits,
  fetchFileContents,
  fetchFileList,
  fetchFiles,
  parseFileContents,
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

    // Create window object with mocked setInterval and clearInterval
    vi.stubGlobal('window', {
      setInterval: vi.fn(() => /** @type {any} */ (1)),
      clearInterval: vi.fn(),
    });
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
    test('fetches commits for files and returns Record mapping paths to commits', async () => {
      const paths = ['file1.md', 'file2.md'];

      const mockResponse = {
        project: {
          repository: {
            tree_0: {
              lastCommit: {
                author: { id: 'user1', username: 'testuser' },
                authorName: 'Test User',
                authorEmail: 'test@example.com',
                committedDate: '2023-01-01T00:00:00Z',
              },
            },
            tree_1: {
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
      expect(result['file1.md']).toEqual({
        author: { id: 'user1', username: 'testuser' },
        authorName: 'Test User',
        authorEmail: 'test@example.com',
        committedDate: '2023-01-01T00:00:00Z',
      });
      expect(result['file2.md']).toEqual({
        author: null,
        authorName: 'Anonymous',
        authorEmail: 'anon@example.com',
        committedDate: '2023-01-02T00:00:00Z',
      });
    });

    test('handles large number of paths with multiple batches', async () => {
      const paths = Array.from({ length: 20 }, (_, i) => `file${i}.md`);

      const mockResponse1 = {
        project: {
          repository: Array.from({ length: 13 }, (_, i) => ({
            [`tree_${i}`]: {
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
            [`tree_${i}`]: {
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
      expect(Object.keys(result)).toHaveLength(20);
      expect(result['file0.md']).toBeDefined();
      expect(result['file19.md']).toBeDefined();
    });
  });

  describe('parseFileContents', () => {
    test('parses file contents with commit metadata', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = { 'file1.md': { size: '100' } };
      const blobs = { 'file1.md': { rawTextBlob: 'file content' } };

      const commits = {
        'file1.md': {
          author: { id: 'gid://gitlab/User/123', username: 'testuser' },
          authorName: 'Test User',
          authorEmail: 'test@example.com',
          committedDate: '2023-01-01T00:00:00Z',
        },
      };

      const result = await parseFileContents({ fetchingFiles, sizes, blobs, commits });

      expect(result['file1.md']).toEqual({
        sha: 'sha1',
        size: 100,
        text: 'file content',
        meta: {
          commitAuthor: {
            name: 'Test User',
            email: 'test@example.com',
            id: 123,
            login: 'testuser',
          },
          committedDate: new Date('2023-01-01T00:00:00Z'),
        },
      });
    });

    test('parses file contents with null author', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = { 'file1.md': { size: '200' } };
      const blobs = { 'file1.md': { rawTextBlob: 'content' } };
      const result = await parseFileContents({ fetchingFiles, sizes, blobs });

      expect(result['file1.md']).toEqual({
        sha: 'sha1',
        size: 200,
        text: 'content',
        meta: {},
      });
    });

    test('handles multiple files with mixed commit data', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
        { path: 'file2.md', sha: 'sha2', size: 0, name: 'file2.md' },
      ]);

      const sizes = {
        'file1.md': { size: '100' },
        'file2.md': { size: '200' },
      };

      const blobs = {
        'file1.md': { rawTextBlob: 'content1' },
        'file2.md': { rawTextBlob: 'content2' },
      };

      const result = await parseFileContents({ fetchingFiles, sizes, blobs });

      expect(result['file1.md']).toBeDefined();
      expect(result['file2.md']).toBeDefined();
      expect(result['file1.md'].size).toBe(100);
      expect(result['file2.md'].size).toBe(200);
    });

    test('parses file contents without commits', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = { 'file1.md': { size: '50' } };
      const blobs = { 'file1.md': { rawTextBlob: 'minimal' } };
      const commits = /** @type {Record<string, any>} */ ({});
      const result = await parseFileContents({ fetchingFiles, sizes, blobs, commits });

      expect(result['file1.md']).toEqual({
        sha: 'sha1',
        size: 50,
        text: 'minimal',
        meta: {},
      });
    });

    test('handles conversion of size from string to number', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = { 'file1.md': { size: '12345' } };
      const blobs = { 'file1.md': { rawTextBlob: 'content' } };
      const result = await parseFileContents({ fetchingFiles, sizes, blobs });

      expect(result['file1.md'].size).toBe(12345);
      expect(typeof result['file1.md'].size).toBe('number');
    });

    test('handles invalid author id with non-numeric characters', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = { 'file1.md': { size: '100' } };
      const blobs = { 'file1.md': { rawTextBlob: 'content' } };

      const commits = {
        'file1.md': {
          author: { id: 'invalid-non-numeric-id', username: 'testuser' },
          authorName: 'Test User',
          authorEmail: 'test@example.com',
          committedDate: '2023-01-01T00:00:00Z',
        },
      };

      const result = await parseFileContents({ fetchingFiles, sizes, blobs, commits });

      expect(result['file1.md']?.meta?.commitAuthor?.id).toBeUndefined();
      expect(result['file1.md']?.meta?.commitAuthor?.login).toBe('testuser');
    });

    test('handles missing blob text for file', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = { 'file1.md': { size: '100' } };
      const blobs = /** @type {Record<string, any>} */ ({});
      const result = await parseFileContents({ fetchingFiles, sizes, blobs });

      expect(result['file1.md'].text).toBeUndefined();
      expect(result['file1.md'].size).toBe(100);
    });

    test('handles missing size for file and defaults to 0', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
      ]);

      const sizes = /** @type {Record<string, any>} */ ({});
      const blobs = { 'file1.md': { rawTextBlob: 'content' } };
      const result = await parseFileContents({ fetchingFiles, sizes, blobs });

      expect(result['file1.md'].size).toBe(0);
      expect(result['file1.md'].text).toBe('content');
    });
  });

  describe('fetchBlobs', () => {
    test('returns empty object without API call when paths are empty', async () => {
      const paths = /** @type {any[]} */ ([]);
      const query = 'query { test }';
      const result = await fetchBlobs(paths, query);

      expect(fetchGraphQL).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    test('fetches blobs in batches of 100 for non-self-hosted and returns Record mapping paths to blobs', async () => {
      vi.mocked(repository).isSelfHosted = false;

      const paths = Array.from({ length: 250 }, (_, i) => `file${i}.md`);
      const query = 'query { blobs { nodes { rawTextBlob } } }';

      const mockResponse1 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 100 }, (_, i) => ({
                rawTextBlob: `content${i}`,
              })),
            },
          },
        },
      };

      const mockResponse2 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 100 }, (_, i) => ({
                rawTextBlob: `content${i + 100}`,
              })),
            },
          },
        },
      };

      const mockResponse3 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 50 }, (_, i) => ({
                rawTextBlob: `content${i + 200}`,
              })),
            },
          },
        },
      };

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)
        .mockResolvedValueOnce(mockResponse3);

      const result = await fetchBlobs(paths, query);

      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
      expect(Object.keys(result)).toHaveLength(250);
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]?.paths).toHaveLength(100);
      expect(vi.mocked(fetchGraphQL).mock.calls[1][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[1][1]?.paths).toHaveLength(100);
      expect(vi.mocked(fetchGraphQL).mock.calls[2][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[2][1]?.paths).toHaveLength(50);
      expect(result['file0.md']).toEqual({ rawTextBlob: 'content0' });
      expect(result['file249.md']).toEqual({ rawTextBlob: 'content249' });
    });

    test('fetches blobs in batches of 20 for self-hosted instances', async () => {
      vi.mocked(repository).isSelfHosted = true;

      const paths = Array.from({ length: 50 }, (_, i) => `file${i}.md`);
      const query = 'query { blobs { nodes { rawTextBlob } } }';

      const mockResponse1 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 20 }, (_, i) => ({
                rawTextBlob: `content${i}`,
              })),
            },
          },
        },
      };

      const mockResponse2 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 20 }, (_, i) => ({
                rawTextBlob: `content${i + 20}`,
              })),
            },
          },
        },
      };

      const mockResponse3 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 10 }, (_, i) => ({
                rawTextBlob: `content${i + 40}`,
              })),
            },
          },
        },
      };

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)
        .mockResolvedValueOnce(mockResponse3);

      const result = await fetchBlobs(paths, query);

      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
      expect(Object.keys(result)).toHaveLength(50);
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]?.paths).toHaveLength(20);
      expect(vi.mocked(fetchGraphQL).mock.calls[1][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[1][1]?.paths).toHaveLength(20);
      expect(vi.mocked(fetchGraphQL).mock.calls[2][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[2][1]?.paths).toHaveLength(10);
      expect(result['file0.md']).toEqual({ rawTextBlob: 'content0' });
      expect(result['file49.md']).toEqual({ rawTextBlob: 'content49' });
    });

    test('fetches all paths in single batch when under 100 and returns Record', async () => {
      vi.mocked(repository).isSelfHosted = false;

      const paths = Array.from({ length: 30 }, (_, i) => `file${i}.md`);
      const query = 'query { blobs { nodes { rawTextBlob } } }';

      const mockResponse = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 30 }, (_, i) => ({
                rawTextBlob: `content${i}`,
              })),
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      const result = await fetchBlobs(paths, query);

      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
      expect(Object.keys(result)).toHaveLength(30);
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]).toBeDefined();
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]?.paths).toHaveLength(30);
      expect(result['file0.md']).toEqual({ rawTextBlob: 'content0' });
      expect(result['file29.md']).toEqual({ rawTextBlob: 'content29' });
    });
  });

  describe('fetchFileContents', () => {
    test('fetches file contents for entry files', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', type: 'entry', size: 0, name: 'file1.md' },
      ]);

      const mockBlobResponse = {
        project: {
          repository: {
            blobs: {
              nodes: [{ rawTextBlob: 'file content' }],
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValueOnce(mockBlobResponse);

      const result = await fetchFileContents(files);

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!, $paths: [String!]!)'),
        { paths: ['file1.md'] },
      );
      expect(result).toBeDefined();
      expect(result['file1.md']).toBeDefined();
      expect(result['file1.md'].text).toBe('file content');
      expect(result['file1.md'].sha).toBe('sha1');
      expect(result['file1.md'].size).toBe(0);
    });

    test('fetches file contents with large file count in multiple batches', async () => {
      vi.mocked(repository).isSelfHosted = false;

      const files = /** @type {any} */ (
        Array.from({ length: 150 }, (_, i) => ({
          path: `file${i}.md`,
          sha: `sha${i}`,
          type: 'entry',
          size: 0,
          name: `file${i}.md`,
        }))
      );

      const mockBlobResponse1 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 100 }, (_, i) => ({
                rawTextBlob: `content${i}`,
              })),
            },
          },
        },
      };

      const mockBlobResponse2 = {
        project: {
          repository: {
            blobs: {
              nodes: Array.from({ length: 50 }, (_, i) => ({
                rawTextBlob: `content${i + 100}`,
              })),
            },
          },
        },
      };

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(mockBlobResponse1)
        .mockResolvedValueOnce(mockBlobResponse2);

      const result = await fetchFileContents(files);

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBe(150);
      expect(result['file0.md'].text).toBe('content0');
      expect(result['file149.md'].text).toBe('content149');
    });

    test('handles assets without fetching text blobs', async () => {
      const files = /** @type {any} */ ([
        { path: 'image.png', sha: 'sha1', type: 'asset', size: 0, name: 'image.png' },
      ]);

      const result = await fetchFileContents(files);

      // fetchGraphQL should not be called for assets only
      expect(fetchGraphQL).not.toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result['image.png']).toBeDefined();
      expect(result['image.png'].size).toBe(0);
      expect(result['image.png'].text).toBeUndefined();
    });

    test('handles mixed entry and asset files', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', type: 'entry', size: 0, name: 'file1.md' },
        { path: 'image.png', sha: 'sha2', type: 'asset', size: 0, name: 'image.png' },
        { path: 'file2.md', sha: 'sha3', type: 'entry', size: 0, name: 'file2.md' },
      ]);

      const mockBlobResponse = {
        project: {
          repository: {
            blobs: {
              nodes: [{ rawTextBlob: 'content1' }, { rawTextBlob: 'content2' }],
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValueOnce(mockBlobResponse);

      const result = await fetchFileContents(files);

      // Only entry files should be fetched
      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!, $paths: [String!]!)'),
        { paths: ['file1.md', 'file2.md'] },
      );
      expect(result['file1.md'].text).toBe('content1');
      expect(result['file2.md'].text).toBe('content2');
      expect(result['image.png'].text).toBeUndefined();
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
