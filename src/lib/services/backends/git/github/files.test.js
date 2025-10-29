import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/github/commits';
import {
  fetchBlob,
  fetchFileContents,
  fetchFileList,
  fetchFiles,
  getFileContentsQuery,
  parseFileContents,
} from '$lib/services/backends/git/github/files';
import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { dataLoadedProgress } from '$lib/services/contents';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/commits');
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/fetch');
vi.mock('$lib/services/contents');
vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));
vi.mock('mime', () => ({ default: { getType: vi.fn() } }));

// Mock global window
Object.defineProperty(global, 'window', {
  value: {
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
  },
});

describe('GitHub files service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(repository, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
    });
  });

  describe('fetchFileList', () => {
    test('fetches file list successfully', async () => {
      const mockTree = {
        tree: [
          { type: 'blob', path: 'file1.txt', sha: 'sha1', size: 100 },
          { type: 'blob', path: 'folder/file2.md', sha: 'sha2', size: 200 },
          { type: 'tree', path: 'folder', sha: 'sha3', size: 0 }, // Should be filtered out
        ],
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockTree);

      const result = await fetchFileList();

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/trees/main?recursive=1',
      );
      expect(result).toEqual([
        { path: 'file1.txt', sha: 'sha1', size: 100, name: 'file1.txt' },
        { path: 'folder/file2.md', sha: 'sha2', size: 200, name: 'file2.md' },
      ]);
    });

    test('fetches file list with custom hash', async () => {
      const mockTree = { tree: [] };
      const customHash = 'custom-hash';

      vi.mocked(fetchAPI).mockResolvedValue(mockTree);

      await fetchFileList(customHash);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/repos/test-owner/test-repo/git/trees/${customHash}?recursive=1`,
      );
    });
  });

  describe('getFileContentsQuery', () => {
    test('generates GraphQL query for file contents', () => {
      const chunk = [
        { type: 'blob', path: 'file1.txt', sha: 'sha1' },
        { type: 'blob', path: 'file2.md', sha: 'sha2' },
      ];

      const result = getFileContentsQuery(chunk, 0);

      expect(result).toContain('query');
      expect(result).toContain('repository');
      expect(result).toContain('content_0: object(oid: "sha1")');
      expect(result).toContain('content_1: object(oid: "sha2")');
      expect(result).toContain('commit_0: ref(qualifiedName: $branch)');
      expect(result).toContain('commit_1: ref(qualifiedName: $branch)');
    });

    test('generates query with start index offset', () => {
      const chunk = [{ type: 'blob', path: 'file.txt', sha: 'sha1' }];
      const startIndex = 10;
      const result = getFileContentsQuery(chunk, startIndex);

      expect(result).toContain('content_10:');
      expect(result).toContain('commit_10:');
    });

    test('skips content query for asset types', () => {
      const chunk = [
        { type: 'asset', path: 'image.jpg', sha: 'sha1' },
        { type: 'blob', path: 'file.txt', sha: 'sha2' },
      ];

      const result = getFileContentsQuery(chunk, 0);

      expect(result).not.toContain('content_0:');
      expect(result).toContain('content_1:');
      expect(result).toContain('commit_0:');
      expect(result).toContain('commit_1:');
    });

    test('handles mixed asset and blob types with correct indices', () => {
      const chunk = [
        { type: 'asset', path: 'image.png', sha: 'sha1' },
        { type: 'asset', path: 'video.mp4', sha: 'sha2' },
        { type: 'blob', path: 'doc.md', sha: 'sha3' },
      ];

      const result = getFileContentsQuery(chunk, 5);

      expect(result).not.toContain('content_5:');
      expect(result).not.toContain('content_6:');
      expect(result).toContain('content_7:');
      expect(result).toContain('commit_5:');
      expect(result).toContain('commit_6:');
      expect(result).toContain('commit_7:');
    });
  });

  describe('parseFileContents', () => {
    test('parses file contents successfully', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.txt', sha: 'sha1', size: 100, name: 'file1.txt' },
        { path: 'file2.md', sha: 'sha2', size: 200, name: 'file2.md' },
      ]);

      const results = {
        content_0: { text: 'Content of file1' },
        content_1: { text: 'Content of file2' },
        commit_0: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'Author 1',
                    email: 'author1@example.com',
                    user: { id: 'user1', login: 'author1' },
                  },
                  committedDate: '2023-01-01T00:00:00Z',
                },
              ],
            },
          },
        },
        commit_1: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'Author 2',
                    email: 'author2@example.com',
                    user: { id: 'user2', login: 'author2' },
                  },
                  committedDate: '2023-01-02T00:00:00Z',
                },
              ],
            },
          },
        },
      };

      const result = await parseFileContents(fetchingFiles, results);

      expect(result).toEqual({
        'file1.txt': {
          sha: 'sha1',
          size: 100,
          text: 'Content of file1',
          meta: {
            commitAuthor: {
              name: 'Author 1',
              email: 'author1@example.com',
              id: 'user1',
              login: 'author1',
            },
            commitDate: new Date('2023-01-01T00:00:00Z'),
          },
        },
        'file2.md': {
          sha: 'sha2',
          size: 200,
          text: 'Content of file2',
          meta: {
            commitAuthor: {
              name: 'Author 2',
              email: 'author2@example.com',
              id: 'user2',
              login: 'author2',
            },
            commitDate: new Date('2023-01-02T00:00:00Z'),
          },
        },
      });
    });

    test('handles missing text content', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'binary.jpg', sha: 'sha1', size: 1000 },
      ]);

      const results = {
        commit_0: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'Author',
                    email: 'author@example.com',
                    user: null,
                  },
                  committedDate: '2023-01-01T00:00:00Z',
                },
              ],
            },
          },
        },
      };

      const result = await parseFileContents(fetchingFiles, results);

      expect(result['binary.jpg'].text).toBeUndefined();
      expect(result['binary.jpg']?.meta?.commitAuthor?.id).toBeUndefined();
      expect(result['binary.jpg']?.meta?.commitAuthor?.login).toBeUndefined();
    });

    test('handles multiple files with mixed user data', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.txt', sha: 'sha1', size: 100 },
        { path: 'file2.txt', sha: 'sha2', size: 100 },
        { path: 'file3.txt', sha: 'sha3', size: 100 },
      ]);

      const results = {
        content_0: { text: 'Content 1' },
        content_1: { text: 'Content 2' },
        content_2: { text: 'Content 3' },
        commit_0: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'Author 1',
                    email: 'author1@example.com',
                    user: { id: 'u1', login: 'author1' },
                  },
                  committedDate: '2023-01-01T00:00:00Z',
                },
              ],
            },
          },
        },
        commit_1: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'Author 2',
                    email: 'author2@example.com',
                    user: null,
                  },
                  committedDate: '2023-01-02T00:00:00Z',
                },
              ],
            },
          },
        },
        commit_2: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'Author 3',
                    email: 'author3@example.com',
                    user: { id: 'u3', login: 'author3' },
                  },
                  committedDate: '2023-01-03T00:00:00Z',
                },
              ],
            },
          },
        },
      };

      const result = await parseFileContents(fetchingFiles, results);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['file1.txt']?.meta?.commitAuthor?.id).toBe('u1');
      expect(result['file2.txt']?.meta?.commitAuthor?.id).toBeUndefined();
      expect(result['file3.txt']?.meta?.commitAuthor?.login).toBe('author3');
    });

    test('preserves all file metadata correctly', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'path/to/file.txt', sha: 'abc123def456', size: 12345 },
      ]);

      const results = {
        content_0: { text: 'File content here' },
        commit_0: {
          target: {
            history: {
              nodes: [
                {
                  author: {
                    name: 'John Doe',
                    email: 'john@example.com',
                    user: { id: '12345', login: 'johndoe' },
                  },
                  committedDate: '2024-06-15T10:30:45Z',
                },
              ],
            },
          },
        },
      };

      const result = await parseFileContents(fetchingFiles, results);
      const parsed = result['path/to/file.txt'];

      expect(parsed.sha).toBe('abc123def456');
      expect(parsed.size).toBe(12345);
      expect(parsed.text).toBe('File content here');
      expect(parsed?.meta?.commitAuthor?.name).toBe('John Doe');
      expect(parsed?.meta?.commitAuthor?.email).toBe('john@example.com');
      expect(parsed?.meta?.commitDate).toEqual(new Date('2024-06-15T10:30:45Z'));
    });
  });

  describe('fetchFileContents', () => {
    test('fetches and parses file contents', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.txt', sha: 'sha1', size: 100 },
        { path: 'file2.md', sha: 'sha2', size: 200 },
      ]);

      const mockResults = {
        repository: {
          content_0: { text: 'Content 1' },
          content_1: { text: 'Content 2' },
          commit_0: {
            target: {
              history: {
                nodes: [
                  {
                    author: {
                      name: 'Author',
                      email: 'author@example.com',
                      user: { id: 'user1', login: 'author' },
                    },
                    committedDate: '2023-01-01T00:00:00Z',
                  },
                ],
              },
            },
          },
          commit_1: {
            target: {
              history: {
                nodes: [
                  {
                    author: {
                      name: 'Author',
                      email: 'author@example.com',
                      user: { id: 'user1', login: 'author' },
                    },
                    committedDate: '2023-01-01T00:00:00Z',
                  },
                ],
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResults);

      // Mock dataLoadedProgress store
      const mockSet = vi.fn();
      const mockUpdate = vi.fn();

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      const result = await fetchFileContents(fetchingFiles);

      expect(mockSet).toHaveBeenCalledWith(0);
      expect(mockSet).toHaveBeenCalledWith(undefined);
      expect(window.setInterval).toHaveBeenCalled();
      expect(window.clearInterval).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('handles large file lists with chunking', async () => {
      // Create a large file list that exceeds chunk size
      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 300 }, (_, i) => ({
          path: `file${i}.txt`,
          sha: `sha${i}`,
          size: 100,
        }))
      );

      const mockResults = {
        repository: Object.fromEntries(
          Array.from({ length: 300 }, (_, i) => [
            `commit_${i}`,
            {
              target: {
                history: {
                  nodes: [
                    {
                      author: {
                        name: 'Author',
                        email: 'author@example.com',
                        user: { id: 'user1', login: 'author' },
                      },
                      committedDate: '2023-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          ]),
        ),
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResults);

      const mockSet = vi.fn();
      const mockUpdate = vi.fn();

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      await fetchFileContents(fetchingFiles);

      // Should make 2 GraphQL requests (300 files / 250 chunk size = 2 chunks)
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
    });

    test('applies delays between chunk requests', async () => {
      const { sleep: mockSleep } = await import('@sveltia/utils/misc');

      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 500 }, (_, i) => ({
          path: `file${i}.txt`,
          sha: `sha${i}`,
          size: 100,
        }))
      );

      const mockResults = {
        repository: Object.fromEntries(
          Array.from({ length: 500 }, (_, i) => [
            `commit_${i}`,
            {
              target: {
                history: {
                  nodes: [
                    {
                      author: {
                        name: 'Author',
                        email: 'author@example.com',
                        user: { id: 'user1', login: 'author' },
                      },
                      committedDate: '2023-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          ]),
        ),
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResults);

      const mockSet = vi.fn();
      const mockUpdate = vi.fn();

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      await fetchFileContents(fetchingFiles);

      // Should make 2 GraphQL requests (300 files / 250 chunk size = 2 chunks)
      // First request has index 0 (no delay), second has index 1 (500ms delay)
      expect(mockSleep).toHaveBeenCalledWith(0);
      expect(mockSleep).toHaveBeenCalledWith(500);
    });

    test('handles empty file list', async () => {
      const fetchingFiles = /** @type {any[]} */ ([]);
      const mockSet = vi.fn();
      const mockUpdate = vi.fn();

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      const result = await fetchFileContents(fetchingFiles);

      expect(result).toEqual({});
      expect(mockSet).toHaveBeenCalledWith(0);
      expect(mockSet).toHaveBeenCalledWith(undefined);
    });

    test('handles exactly chunk size boundary', async () => {
      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 250 }, (_, i) => ({
          path: `file${i}.txt`,
          sha: `sha${i}`,
          size: 100,
        }))
      );

      const mockResults = {
        repository: Object.fromEntries(
          Array.from({ length: 250 }, (_, i) => [
            `commit_${i}`,
            {
              target: {
                history: {
                  nodes: [
                    {
                      author: {
                        name: 'Author',
                        email: 'author@example.com',
                        user: { id: 'user1', login: 'author' },
                      },
                      committedDate: '2023-01-01T00:00:00Z',
                    },
                  ],
                },
              },
            },
          ]),
        ),
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResults);

      const mockSet = vi.fn();
      const mockUpdate = vi.fn();

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      await fetchFileContents(fetchingFiles);

      // Should make exactly 1 GraphQL request
      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
    });

    test('progress interval callback is executed', async () => {
      const fetchingFiles = /** @type {any[]} */ ([{ path: 'file.txt', sha: 'sha1', size: 100 }]);

      const mockResults = {
        repository: {
          content_0: { text: 'Content' },
          commit_0: {
            target: {
              history: {
                nodes: [
                  {
                    author: {
                      name: 'Author',
                      email: 'author@example.com',
                      user: { id: 'user1', login: 'author' },
                    },
                    committedDate: '2023-01-01T00:00:00Z',
                  },
                ],
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResults);

      const mockSet = vi.fn();
      const mockUpdate = vi.fn();
      /** @type {any} */
      let intervalCallback = null;

      // Capture the callback function passed to setInterval
      vi.mocked(window.setInterval).mockImplementation((callback) => {
        intervalCallback = callback;
        return /** @type {any} */ (1);
      });

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      await fetchFileContents(fetchingFiles);

      // Verify interval callback was captured and can be executed
      expect(intervalCallback).toBeDefined();

      if (intervalCallback) {
        intervalCallback();
        expect(mockUpdate).toHaveBeenCalledWith(expect.any(Function));
      }
    });

    test('progress update receives correct initial value in callback', async () => {
      const fetchingFiles = /** @type {any[]} */ ([{ path: 'file.txt', sha: 'sha1', size: 100 }]);

      const mockResults = {
        repository: {
          content_0: { text: 'Content' },
          commit_0: {
            target: {
              history: {
                nodes: [
                  {
                    author: {
                      name: 'Author',
                      email: 'author@example.com',
                      user: { id: 'user1', login: 'author' },
                    },
                    committedDate: '2023-01-01T00:00:00Z',
                  },
                ],
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResults);

      const mockSet = vi.fn();
      const mockUpdate = vi.fn((fn) => fn(0));
      /** @type {any} */
      let intervalCallback = null;

      vi.mocked(window.setInterval).mockImplementation((callback) => {
        intervalCallback = callback;
        return /** @type {any} */ (1);
      });

      vi.mocked(dataLoadedProgress).set = mockSet;
      vi.mocked(dataLoadedProgress).update = mockUpdate;

      await fetchFileContents(fetchingFiles);

      if (intervalCallback) {
        intervalCallback();

        expect(mockUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('fetchFiles', () => {
    test('fetches files through shared fetch function', async () => {
      vi.mocked(checkRepositoryAccess).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      expect(checkRepositoryAccess).toHaveBeenCalled();
      expect(fetchAndParseFiles).toHaveBeenCalledWith({
        repository,
        fetchDefaultBranchName,
        fetchLastCommit,
        fetchFileList,
        fetchFileContents,
      });
    });
  });

  describe('fetchBlob', () => {
    test('fetches blob as binary content', async () => {
      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'image.jpg',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'application/octet-stream']]),
        blob: vi.fn().mockResolvedValue(new Blob(['binary data'])),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/git/blobs/test-sha', {
        headers: { Accept: 'application/vnd.github.raw' },
        responseType: 'raw',
      });
      expect(mockResponse.blob).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
    });

    test('handles text content with correct MIME type', async () => {
      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'file.svg',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'image/svg+xml']]),
        text: vi.fn().mockResolvedValue('<svg></svg>'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue('image/svg+xml');

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(mockResponse.text).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/svg+xml');
    });

    test('falls back to text/plain for unknown MIME types', async () => {
      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'file.unknown',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'text/plain']]),
        text: vi.fn().mockResolvedValue('text content'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue(null);

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(result.type).toBe('text/plain');
    });

    test('handles text files with JSON content', async () => {
      const asset = /** @type {any} */ ({
        sha: 'json-sha',
        path: 'data.json',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'application/json']]),
        text: vi.fn().mockResolvedValue('{"key":"value"}'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue('application/json');

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(result.type).toBe('application/json');
    });

    test('handles text files with Markdown content', async () => {
      const asset = /** @type {any} */ ({
        sha: 'md-sha',
        path: 'README.md',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'text/markdown']]),
        text: vi.fn().mockResolvedValue('# Readme'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue('text/markdown');

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(result.type).toBe('text/markdown');
    });

    test('calls fetchAPI with correct repository and asset SHA', async () => {
      const asset = /** @type {any} */ ({
        sha: 'custom-sha-123',
        path: 'path/to/file.bin',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'application/octet-stream']]),
        blob: vi.fn().mockResolvedValue(new Blob()),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/blobs/custom-sha-123',
        expect.objectContaining({
          headers: { Accept: 'application/vnd.github.raw' },
          responseType: 'raw',
        }),
      );
    });
  });
});
