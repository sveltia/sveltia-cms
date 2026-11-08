import { getPathInfo } from '@sveltia/utils/file';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/gitlab/commits';
import {
  _resetDirLookup,
  BLOB_CONCURRENCY,
  fetchBlob,
  fetchBlobBatch,
  fetchBlobNodes,
  fetchBlobs,
  fetchDirSHA,
  fetchFileContents,
  fetchFileList,
  fetchFiles,
  fetchTreeListing,
  getNextPageParams,
  parseFileContents,
  SELF_HOSTED_BLOB_CONCURRENCY,
  SELF_HOSTED_TREE_CONCURRENCY,
  TREE_CONCURRENCY,
} from '$lib/services/backends/git/gitlab/files';
import {
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
} from '$lib/services/backends/git/gitlab/fork';
import {
  checkBranchAccess,
  checkRepositoryAccess,
  fetchDefaultBranchName,
  getProjectId,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { getManagedPaths } from '$lib/services/backends/git/shared/managed-paths';
import { startSimulatedProgress } from '$lib/services/backends/git/shared/progress';
import { listTrees } from '$lib/services/backends/git/shared/tree-cache';
import { forkedRepository, openAuthoringInitialized } from '$lib/services/workflow/open-authoring';

// The function returned by `startSimulatedProgress()`, so the tests can verify it’s called
const stopProgress = vi.hoisted(() => vi.fn());

// Mock dependencies
vi.mock('@sveltia/utils/file');

const mockGetRootDir = vi.hoisted(() => vi.fn(() => ''));

vi.mock('$lib/services/backends/root-dir', () => ({
  getRootDir: mockGetRootDir,
  toRepoPath: vi.fn((path) => (mockGetRootDir() ? `${mockGetRootDir()}/${path}` : path)),
}));
vi.mock('$lib/services/backends/git/shared/managed-paths', () => ({
  getManagedPaths: vi.fn(() => undefined),
}));
vi.mock('$lib/services/backends/git/gitlab/commits');
vi.mock('$lib/services/backends/git/gitlab/fork');
vi.mock('$lib/services/backends/git/gitlab/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/fetch');
vi.mock('$lib/services/backends/git/shared/tree-cache');
vi.mock('$lib/services/backends/git/shared/progress', () => ({
  startSimulatedProgress: vi.fn(() => stopProgress),
}));
vi.mock('$lib/services/workflow/open-authoring', () => ({
  forkedRepository: { current: undefined },
  openAuthoringInitialized: { current: false },
}));

describe('GitLab files service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default repository state
    vi.mocked(repository).repo = 'test-repo';
    vi.mocked(repository).branch = 'main';
    vi.mocked(repository).owner = 'test-owner';
    vi.mocked(getProjectId).mockImplementation(({ owner, repo } = repository) =>
      encodeURIComponent(`${owner}/${repo}`),
    );
    vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
    forkedRepository.current = undefined;
    openAuthoringInitialized.current = false;
  });

  describe('fetchDirSHA', () => {
    /**
     * Make a page of the subdirectory listing.
     * @param {{ name: string, sha: string }[]} nodes Subdirectories.
     * @param {boolean} [hasNextPage] Whether there are more pages.
     * @returns {any} Response.
     */
    const makePage = (nodes, hasNextPage = false) => ({
      project: {
        repository: { tree: { trees: { nodes, pageInfo: { endCursor: 'next', hasNextPage } } } },
      },
    });

    beforeEach(() => {
      _resetDirLookup();
      vi.mocked(getPathInfo).mockImplementation((path) => {
        const index = path.lastIndexOf('/');

        return {
          dirname: index > -1 ? path.slice(0, index) : undefined,
          basename: path.slice(index + 1),
          filename: path.slice(index + 1),
        };
      });
    });

    test('finds the directory among the subdirectories of its parent', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(makePage([{ name: 'other', sha: 'x' }], true))
        .mockResolvedValueOnce(makePage([{ name: 'site', sha: 'tree-sha' }], true));

      await expect(fetchDirSHA('abc', 'apps/site')).resolves.toBe('tree-sha');
      expect(fetchGraphQL).toHaveBeenNthCalledWith(1, expect.stringContaining('trees(after:'), {
        ref: 'abc',
        path: 'apps',
        cursor: '',
      });
      expect(fetchGraphQL).toHaveBeenNthCalledWith(2, expect.any(String), {
        ref: 'abc',
        path: 'apps',
        cursor: 'next',
      });
    });

    test('lists the repository root for a top-level directory', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValueOnce(makePage([{ name: 'site', sha: 'tree-sha' }]));

      await expect(fetchDirSHA('abc', 'site')).resolves.toBe('tree-sha');
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.any(String), {
        ref: 'abc',
        path: '',
        cursor: '',
      });
    });

    test('returns `undefined` for a directory that doesn’t exist', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValueOnce(makePage([{ name: 'other', sha: 'x' }]));

      await expect(fetchDirSHA('abc', 'apps/site')).resolves.toBeUndefined();
    });

    test('returns `undefined` when there is no tree', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValueOnce({ project: null });

      await expect(fetchDirSHA('abc', 'apps/site')).resolves.toBeUndefined();
    });

    test('reuses a lookup at a commit, but looks a branch up every time', async () => {
      const commit = 'a'.repeat(40);
      const page = makePage([{ name: 'site', sha: 'tree-sha' }]);

      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce(page)
        .mockResolvedValueOnce(page)
        .mockResolvedValueOnce(page);

      await fetchDirSHA(commit, 'apps/site');
      await expect(fetchDirSHA(commit, 'apps/site')).resolves.toBe('tree-sha');
      expect(fetchGraphQL).toHaveBeenCalledOnce();

      await fetchDirSHA('main', 'apps/site');
      await fetchDirSHA('main', 'apps/site');
      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
    });
  });

  describe('getNextPageParams', () => {
    test('takes the token from the next link', () => {
      expect(
        getNextPageParams(
          '<https://gitlab.com/api/v4/projects/1/repository/tree?page_token=abc&per_page=100>; ' +
            'rel="next", <https://gitlab.com/api/v4/projects/1/repository/tree>; rel="first"',
        ),
      ).toEqual({ page_token: 'abc' });
    });

    test('takes the page number from an offset-paginated next link', () => {
      expect(
        getNextPageParams('<https://gitlab.example.com/api/v4/a?page=2&per_page=100>; rel="next"'),
      ).toEqual({ page: '2' });
    });

    test('returns undefined without a next link or its parameters', () => {
      expect(getNextPageParams(null)).toBeUndefined();
      expect(getNextPageParams('<https://gitlab.com/a?page_token=x>; rel="first"')).toBeUndefined();
      expect(getNextPageParams('<https://gitlab.com/a?per_page=100>; rel="next"')).toBeUndefined();
      expect(getNextPageParams('</a?page_token=x>; rel="next"')).toBeUndefined();
    });
  });

  describe('fetchTreeListing', () => {
    /**
     * Make a raw response holding a page of a tree listing.
     * @param {any[]} entries Tree entries.
     * @param {string} [next] Token of the next page.
     * @returns {Response} Response.
     */
    const makePage = (entries, next) =>
      new Response(JSON.stringify(entries), {
        headers: next
          ? { Link: `<https://gitlab.com/api/v4/x?page_token=${next}&per_page=100>; rel="next"` }
          : {},
      });

    test('lists the subtrees and files of a directory, a page at a time', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(
          makePage(
            [
              { type: 'tree', name: 'album', id: 'tree1' },
              { type: 'blob', name: 'index.md', id: 'blob1' },
            ],
            'next1',
          ),
        )
        .mockResolvedValueOnce(
          makePage([
            { type: 'blob', name: 'photo.jpg', id: 'blob2' },
            { type: 'commit', name: 'theme', id: 'commit1' },
          ]),
        );

      await expect(fetchTreeListing('content/gallery', 'commit-sha')).resolves.toEqual({
        trees: [['album', 'tree1']],
        blobs: [
          ['index.md', 'blob1'],
          ['photo.jpg', 'blob2'],
        ],
      });
      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        '/projects/test-owner%2Ftest-repo/repository/tree' +
          '?path=content%2Fgallery&ref=commit-sha&per_page=100&pagination=keyset',
        { responseType: 'raw' },
      );
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/projects/test-owner%2Ftest-repo/repository/tree' +
          '?path=content%2Fgallery&ref=commit-sha&per_page=100&pagination=keyset&page_token=next1',
        { responseType: 'raw' },
      );
    });

    test('lists the repository root without a path', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce(makePage([]));

      await expect(fetchTreeListing('', 'main')).resolves.toEqual({ trees: [], blobs: [] });
      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/tree' +
          '?ref=main&per_page=100&pagination=keyset',
        { responseType: 'raw' },
      );
    });

    test('returns an empty listing for a directory that doesn’t exist', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce(new Response('', { status: 404 }));

      await expect(fetchTreeListing('missing', 'main')).resolves.toEqual({ trees: [], blobs: [] });
    });

    test('throws when a later page goes missing', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(makePage([{ type: 'blob', name: 'a.jpg', id: 'blob1' }], 'next1'))
        .mockResolvedValueOnce(new Response('Gone', { status: 404 }));

      await expect(fetchTreeListing('content', 'main')).rejects.toThrow(
        'Failed to list the files: Gone',
      );
    });

    test('throws when a request fails', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce(new Response('Oops', { status: 500 }));

      await expect(fetchTreeListing('content', 'main')).rejects.toThrow(
        'Failed to list the files: Oops',
      );
    });
  });

  describe('fetchFileList', () => {
    beforeEach(() => {
      vi.mocked(getPathInfo).mockImplementation((path) => ({
        dirname: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : undefined,
        basename: /** @type {string} */ (path.split('/').pop()),
        filename: '',
      }));
      vi.mocked(listTrees).mockImplementation(async ({ roots }) =>
        roots.map(({ path }) => ({ type: 'blob', path: `${path || 'root'}/a.md`, sha: path })),
      );
      vi.mocked(repository).isSelfHosted = false;
    });

    afterEach(() => {
      mockGetRootDir.mockReturnValue('');
    });

    test('lists the whole repository from its root at the commit it was given', async () => {
      const result = await fetchFileList('last-commit-sha');

      expect(listTrees).toHaveBeenCalledExactlyOnceWith({
        repository,
        roots: [{ path: '' }],
        fetchTreeListing: expect.any(Function),
        cacheable: true,
        concurrency: TREE_CONCURRENCY,
      });
      expect(fetchGraphQL).not.toHaveBeenCalled();
      expect(result).toEqual([{ path: 'root/a.md', sha: '', size: 0, name: 'a.md' }]);

      // A directory is listed at the same commit
      vi.mocked(fetchAPI).mockResolvedValueOnce(new Response('[]'));
      await vi.mocked(listTrees).mock.calls[0][0].fetchTreeListing('content');
      expect(fetchAPI).toHaveBeenCalledWith(
        expect.stringContaining('?path=content&ref=last-commit-sha&'),
        { responseType: 'raw' },
      );
    });

    test('doesn’t cache what it lists on the branch, and lists fewer at once when self-hosted', async () => {
      vi.mocked(repository).isSelfHosted = true;

      await fetchFileList();

      expect(listTrees).toHaveBeenCalledWith(
        expect.objectContaining({ cacheable: false, concurrency: SELF_HOSTED_TREE_CONCURRENCY }),
      );

      vi.mocked(fetchAPI).mockResolvedValueOnce(new Response('[]'));
      await vi.mocked(listTrees).mock.calls[0][0].fetchTreeListing('content');
      expect(fetchAPI).toHaveBeenCalledWith(expect.stringContaining('&ref=main&'), {
        responseType: 'raw',
      });
    });

    test('lists the root directory by its tree ID', async () => {
      mockGetRootDir.mockReturnValue('apps/site');
      vi.mocked(fetchGraphQL).mockResolvedValueOnce({
        project: { repository: { tree: { trees: { nodes: [{ name: 'site', sha: 'tree1' }] } } } },
      });

      await fetchFileList('commit-sha');

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('trees(after:'), {
        ref: 'commit-sha',
        path: 'apps',
        cursor: '',
      });
      expect(listTrees).toHaveBeenCalledWith(
        expect.objectContaining({ roots: [{ path: 'apps/site', sha: 'tree1' }] }),
      );
    });

    describe('with the folders the CMS manages', () => {
      test('lists the folders by their tree IDs, and looks up the files by path', async () => {
        mockGetRootDir.mockReturnValue('site');
        vi.mocked(getManagedPaths).mockReturnValueOnce({
          dirs: ['content', 'static/images', 'missing'],
          files: ['data/settings.yml'],
        });

        vi.mocked(fetchGraphQL).mockImplementation(async (query, variables) => {
          if (query.includes('oid')) {
            return {
              project: {
                repository: {
                  blobs: { nodes: [{ path: 'site/data/settings.yml', oid: 'sha-settings' }] },
                },
              },
            };
          }

          const nodes =
            variables?.path === 'site'
              ? [{ name: 'content', sha: 'tree-content' }]
              : [{ name: 'images', sha: 'tree-images' }];

          return { project: { repository: { tree: { trees: { nodes } } } } };
        });

        const result = await fetchFileList('commit-hash');

        // A folder that doesn’t exist is left out
        expect(listTrees).toHaveBeenCalledWith(
          expect.objectContaining({
            roots: [
              { path: 'site/content', sha: 'tree-content' },
              { path: 'site/static/images', sha: 'tree-images' },
            ],
          }),
        );
        expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('oid'), {
          branch: 'commit-hash',
          paths: ['site/data/settings.yml'],
        });
        expect(result.map(({ path, sha }) => [path, sha])).toEqual([
          ['site/content/a.md', 'site/content'],
          ['site/static/images/a.md', 'site/static/images'],
          ['site/data/settings.yml', 'sha-settings'],
        ]);
      });

      test('looks up the files on the branch without a commit', async () => {
        vi.mocked(getManagedPaths).mockReturnValueOnce({ dirs: [], files: ['site.yml'] });
        vi.mocked(fetchGraphQL).mockResolvedValueOnce({
          project: { repository: { blobs: { nodes: [{ path: 'site.yml', oid: 'sha1' }] } } },
        });

        const result = await fetchFileList();

        expect(fetchGraphQL).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('oid'), {
          paths: ['site.yml'],
        });
        expect(result.map(({ path }) => path)).toEqual(['site.yml']);
      });

      test('lists the whole root directory when there is nothing in them yet', async () => {
        vi.mocked(getManagedPaths).mockReturnValueOnce({ dirs: ['content'], files: [] });
        vi.mocked(fetchGraphQL).mockResolvedValueOnce({
          project: { repository: { tree: { trees: { nodes: [{ name: 'content', sha: 't1' }] } } } },
        });
        vi.mocked(listTrees).mockResolvedValueOnce([]);

        const result = await fetchFileList('commit-sha');

        expect(listTrees).toHaveBeenLastCalledWith(
          expect.objectContaining({ roots: [{ path: '' }] }),
        );
        expect(result.map(({ path }) => path)).toEqual(['root/a.md']);
      });
    });
  });

  describe('parseFileContents', () => {
    test('parses the text contents of the files', () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.md', sha: 'sha1', size: 0, name: 'file1.md' },
        { path: 'file2.md', sha: 'sha2', size: 0, name: 'file2.md' },
      ]);

      const blobs = { 'file1.md': { rawTextBlob: 'content1' }, 'file2.md': { rawTextBlob: '' } };

      expect(parseFileContents({ fetchingFiles, blobs })).toEqual({
        'file1.md': { sha: 'sha1', size: 0, text: 'content1', meta: {} },
        'file2.md': { sha: 'sha2', size: 0, text: '', meta: {} },
      });
    });

    test('leaves the text undefined for a file without a blob', () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'image.png', sha: 'sha1', size: 0, name: 'image.png' },
      ]);

      const blobs = /** @type {Record<string, any>} */ ({ 'image.png': { rawTextBlob: null } });

      expect(parseFileContents({ fetchingFiles, blobs })['image.png'].text).toBeUndefined();
      expect(parseFileContents({ fetchingFiles, blobs: {} })['image.png'].text).toBeUndefined();
    });
    test('leaves an entry without content uncached', () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'binary.md', sha: 'sha1', size: 0, name: 'binary.md', type: 'entry' },
        { path: 'missing.yml', sha: 'sha2', size: 0, name: 'missing.yml', type: 'config' },
        { path: 'image.png', sha: 'sha3', size: 0, name: 'image.png', type: 'asset' },
      ]);

      const blobs = /** @type {Record<string, any>} */ ({ 'binary.md': { rawTextBlob: null } });
      const result = parseFileContents({ fetchingFiles, blobs });

      // Without `meta`, the file isn’t marked as fetched, so it’s requested again on the next load
      expect(result['binary.md']).toEqual({
        sha: 'sha1',
        size: 0,
        text: undefined,
        meta: undefined,
      });
      expect(result['missing.yml'].meta).toBeUndefined();
      // An asset’s content is never requested
      expect(result['image.png'].meta).toEqual({});
    });
  });

  describe('fetchBlobBatch', () => {
    /**
     * Create a GraphQL response holding a node for each of the given paths.
     * @param {string[]} paths File paths.
     * @returns {any} Response.
     */
    const createResponse = (paths) => ({
      project: {
        repository: { blobs: { nodes: paths.map((path) => ({ path, rawTextBlob: path })) } },
      },
    });

    /**
     * Mock the API, rejecting any batch larger than the given number of paths, as the API does when
     * the blobs in a request add up to more than 20 MB.
     * @param {number} maxPaths Largest batch the mock accepts.
     */
    const mockSizeLimit = (maxPaths) => {
      vi.mocked(fetchGraphQL).mockImplementation(async (_query, variables) => {
        const currentPaths = /** @type {string[]} */ (variables?.paths);

        if (currentPaths.length > maxPaths) {
          throw new Error('Server responded with an error');
        }

        return createResponse(currentPaths);
      });
    };

    test('returns the nodes of a batch that fits', async () => {
      const paths = ['file0.md', 'file1.md'];

      vi.mocked(fetchGraphQL).mockResolvedValue(createResponse(paths));

      const result = await fetchBlobBatch(paths, 'query { blobs }', { branch: 'main' });

      expect(fetchGraphQL).toHaveBeenCalledOnce();
      expect(fetchGraphQL).toHaveBeenCalledWith('query { blobs }', { branch: 'main', paths });
      expect(result).toEqual([
        { path: 'file0.md', rawTextBlob: 'file0.md' },
        { path: 'file1.md', rawTextBlob: 'file1.md' },
      ]);
    });

    test('splits an oversized batch in half and keeps the order of the paths', async () => {
      const paths = ['file0.md', 'file1.md', 'file2.md'];

      mockSizeLimit(2);

      const result = await fetchBlobBatch(paths, 'query { blobs }');

      // The failed request, then one for each half
      expect(fetchGraphQL).toHaveBeenCalledTimes(3);
      expect(vi.mocked(fetchGraphQL).mock.calls[1][1]?.paths).toEqual(['file0.md', 'file1.md']);
      expect(vi.mocked(fetchGraphQL).mock.calls[2][1]?.paths).toEqual(['file2.md']);
      expect(result.map(({ path }) => path)).toEqual(paths);
    });

    test('splits repeatedly until every batch is accepted', async () => {
      const paths = Array.from({ length: 8 }, (_, i) => `file${i}.md`);

      // Only a single blob is small enough, which is the size the API always accepts
      mockSizeLimit(1);

      const result = await fetchBlobBatch(paths, 'query { blobs }');

      expect(result.map(({ path }) => path)).toEqual(paths);
    });

    test('throws when a single path fails, with nothing left to split', async () => {
      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Server responded with an error'));

      await expect(fetchBlobBatch(['file0.md'], 'query { blobs }')).rejects.toThrow(
        'Server responded with an error',
      );

      expect(fetchGraphQL).toHaveBeenCalledOnce();
    });

    test('gives up quickly on an error that has nothing to do with the size', async () => {
      const paths = Array.from({ length: 100 }, (_, i) => `file${i}.md`);

      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Unauthorized'));

      await expect(fetchBlobBatch(paths, 'query { blobs }')).rejects.toThrow('Unauthorized');

      // Halving 100 paths reaches a single one in seven steps, and the other half of a failed batch
      // is never requested, so the list isn’t retried path by path
      expect(fetchGraphQL).toHaveBeenCalledTimes(8);
    });

    test('reports a malformed response as is instead of retrying it', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({});

      await expect(fetchBlobBatch(['file0.md', 'file1.md'], 'query { blobs }')).rejects.toThrow(
        TypeError,
      );

      expect(fetchGraphQL).toHaveBeenCalledOnce();
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
                path: `file${i}.md`,
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
                path: `file${i + 100}.md`,
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
                path: `file${i + 200}.md`,
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
      expect(result['file0.md']).toEqual({ path: 'file0.md', rawTextBlob: 'content0' });
      expect(result['file249.md']).toEqual({ path: 'file249.md', rawTextBlob: 'content249' });
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
                path: `file${i}.md`,
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
                path: `file${i + 20}.md`,
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
                path: `file${i + 40}.md`,
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
      expect(result['file0.md']).toEqual({ path: 'file0.md', rawTextBlob: 'content0' });
      expect(result['file49.md']).toEqual({ path: 'file49.md', rawTextBlob: 'content49' });
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
                path: `file${i}.md`,
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
      expect(result['file0.md']).toEqual({ path: 'file0.md', rawTextBlob: 'content0' });
      expect(result['file29.md']).toEqual({ path: 'file29.md', rawTextBlob: 'content29' });
    });
    test('maps the blobs by path, so a path the API skips doesn’t shift the others', async () => {
      vi.mocked(repository).isSelfHosted = false;

      // `b.md` was deleted by a push made while the files were being loaded, so GitLab leaves it
      // out of the response rather than returning an empty node in its place
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: {
          repository: {
            blobs: {
              nodes: [
                { path: 'a.md', rawTextBlob: 'A' },
                { path: 'c.md', rawTextBlob: 'C' },
              ],
            },
          },
        },
      });

      const result = await fetchBlobs(['a.md', 'b.md', 'c.md'], 'query { test }');

      expect(result['a.md']?.rawTextBlob).toBe('A');
      expect(result['b.md']).toBeUndefined();
      expect(result['c.md']?.rawTextBlob).toBe('C');
    });

    test.each([
      { isSelfHosted: false, batchSize: 100, concurrency: BLOB_CONCURRENCY },
      { isSelfHosted: true, batchSize: 20, concurrency: SELF_HOSTED_BLOB_CONCURRENCY },
    ])(
      'requests up to $concurrency batches at once when self-hosted is $isSelfHosted',
      async ({ isSelfHosted, batchSize, concurrency }) => {
        vi.mocked(repository).isSelfHosted = isSelfHosted;

        const paths = Array.from({ length: batchSize * 10 }, (_, i) => `file${i}.md`);
        let inFlight = 0;
        let maxInFlight = 0;

        vi.mocked(fetchGraphQL).mockImplementation(async (_query, variables) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
          inFlight -= 1;

          return {
            project: {
              repository: {
                blobs: {
                  nodes: /** @type {string[]} */ (/** @type {any} */ (variables).paths).map(
                    (path) => ({
                      path,
                      rawTextBlob: path,
                    }),
                  ),
                },
              },
            },
          };
        });

        const nodes = await fetchBlobNodes(paths, 'query { test }');

        expect(fetchGraphQL).toHaveBeenCalledTimes(10);
        expect(maxInFlight).toBe(concurrency);
        expect(nodes.map(({ path }) => path)).toEqual(paths);
      },
    );

    test('keeps the order of the paths when a later batch finishes first', async () => {
      vi.mocked(repository).isSelfHosted = false;

      const paths = Array.from({ length: 150 }, (_, i) => `file${i}.md`);

      vi.mocked(fetchGraphQL).mockImplementation(async (_query, variables) => {
        const batchPaths = /** @type {string[]} */ (/** @type {any} */ (variables).paths);

        // The first batch is the slowest to answer
        await new Promise((resolve) => {
          setTimeout(resolve, batchPaths[0] === 'file0.md' ? 20 : 0);
        });

        return {
          project: {
            repository: {
              blobs: { nodes: batchPaths.map((path) => ({ path, rawTextBlob: path })) },
            },
          },
        };
      });

      const nodes = await fetchBlobNodes(paths, 'query { test }');

      expect(nodes.map(({ path }) => path)).toEqual(paths);
    });

    test('passes the extra variables to every batch', async () => {
      vi.mocked(repository).isSelfHosted = false;

      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { repository: { blobs: { nodes: [] } } },
      });

      await fetchBlobNodes(
        Array.from({ length: 150 }, (_, i) => `file${i}.md`),
        'query { test }',
        { branch: 'cms/posts/foo' },
      );

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      vi.mocked(fetchGraphQL).mock.calls.forEach(([, variables]) => {
        expect(variables?.branch).toBe('cms/posts/foo');
      });
    });

    test('rejects when a batch fails for a reason other than its size', async () => {
      vi.mocked(repository).isSelfHosted = false;
      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Unauthorized'));

      await expect(fetchBlobNodes(['a.md'], 'query { test }')).rejects.toThrow('Unauthorized');
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
              nodes: [{ path: 'file1.md', rawTextBlob: 'file content' }],
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValueOnce(mockBlobResponse);

      const result = await fetchFileContents(files);

      // The simulated progress bar is shown while the request is in flight
      expect(startSimulatedProgress).toHaveBeenCalledWith(files.length);
      expect(stopProgress).toHaveBeenCalledOnce();

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!, $paths: [String!]!)'),
        { paths: ['file1.md'] },
      );
      // The path is what the blobs are matched to the files by
      expect(vi.mocked(fetchGraphQL).mock.calls[0][0]).toMatch(/nodes \{\s*path\s/);
      expect(result).toBeDefined();
      expect(result['file1.md']).toBeDefined();
      expect(result['file1.md'].text).toBe('file content');
      expect(result['file1.md'].sha).toBe('sha1');
      expect(result['file1.md'].size).toBe(0);
    });

    test('reads the blobs at the commit the file list comes from', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', type: 'entry', size: 0, name: 'file1.md' },
      ]);

      vi.mocked(fetchGraphQL).mockResolvedValueOnce({
        project: {
          repository: { blobs: { nodes: [{ path: 'file1.md', rawTextBlob: 'file content' }] } },
        },
      });

      await fetchFileContents(files, 'last-commit-sha');

      // Not at the tip of the branch, which may hold another version of the file by now, whose text
      // would then be cached under the blob SHA from the file list
      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('blobs(ref: $branch, paths: $paths)'),
        { branch: 'last-commit-sha', paths: ['file1.md'] },
      );
    });

    test('reads a blob cut short by GitLab from the raw file endpoint', async () => {
      const files = /** @type {any} */ ([
        { path: 'dir/large.md', sha: 'sha1', type: 'entry', size: 0, name: 'large.md' },
        { path: 'small.md', sha: 'sha2', type: 'entry', size: 0, name: 'small.md' },
      ]);

      vi.mocked(fetchGraphQL).mockResolvedValueOnce({
        project: {
          repository: {
            blobs: {
              nodes: [
                { path: 'dir/large.md', size: '20000000', rawTextBlob: 'partial' },
                // `é` is 2 bytes in UTF-8, so the text is complete
                { path: 'small.md', size: '2', rawTextBlob: 'é' },
              ],
            },
          },
        },
      });
      vi.mocked(fetchAPI).mockResolvedValueOnce('full content');

      const result = await fetchFileContents(files, 'last-commit-sha');

      expect(vi.mocked(fetchGraphQL).mock.calls[0][0]).toMatch(/\ssize\s/);
      expect(fetchAPI).toHaveBeenCalledOnce();
      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/files/dir%2Flarge.md/raw?ref=last-commit-sha',
        { responseType: 'text' },
      );
      expect(result['dir/large.md'].text).toBe('full content');
      expect(result['small.md'].text).toBe('é');

      // Read at the branch without a commit
      vi.mocked(fetchGraphQL).mockResolvedValueOnce({
        project: {
          repository: {
            blobs: { nodes: [{ path: 'dir/large.md', size: '10', rawTextBlob: 'partial' }] },
          },
        },
      });
      vi.mocked(fetchAPI).mockResolvedValueOnce('full text');

      expect((await fetchFileContents([files[0]]))['dir/large.md'].text).toBe('full text');
      expect(fetchAPI).toHaveBeenLastCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/files/dir%2Flarge.md/raw?ref=main',
        { responseType: 'text' },
      );
    });

    test('stops the simulated progress when a request fails', async () => {
      const files = /** @type {any} */ ([
        { path: 'file1.md', sha: 'sha1', type: 'entry', size: 0, name: 'file1.md' },
      ]);

      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Unauthorized'));

      await expect(fetchFileContents(files)).rejects.toThrow('Unauthorized');
      // Otherwise the interval would keep running behind the error message
      expect(stopProgress).toHaveBeenCalledOnce();
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
                path: `file${i}.md`,
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
                path: `file${i + 100}.md`,
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
              nodes: [
                { path: 'file1.md', rawTextBlob: 'content1' },
                { path: 'file2.md', rawTextBlob: 'content2' },
              ],
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
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      // The access checks are handed over so they can run alongside the other requests
      expect(fetchAndParseFiles).toHaveBeenCalledWith({
        repository,
        checkAccess: checkRepositoryAccess,
        checkBranchAccess,
        fetchDefaultBranchName,
        fetchLastCommit,
        fetchFileList,
        fetchFileContents: expect.any(Function),
      });
    });

    test('throws error when the shared fetch fails', async () => {
      const error = new Error('Access denied');

      vi.mocked(fetchAndParseFiles).mockRejectedValue(error);

      await expect(fetchFiles()).rejects.toThrow('Access denied');
    });

    test('sets a contributor up with a fork when Open Authoring is enabled', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(initOpenAuthoring).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();
      vi.mocked(initOpenAuthoring).mockImplementation(async () => {
        forkedRepository.current = /** @type {any} */ ({
          owner: 'contributor',
          repo: 'test-repo',
        });
      });

      await fetchFiles();

      expect(initOpenAuthoring).toHaveBeenCalled();

      expect(fetchAndParseFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          // A contributor isn’t expected to be a member of the project, and their changes go to
          // their fork, so neither the project nor the branch is checked for write access
          checkAccess: undefined,
          checkBranchAccess: undefined,
        }),
      );
    });

    test('sets the fork up only once', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(fetchAndParseFiles).mockResolvedValue();
      openAuthoringInitialized.current = true;

      await fetchFiles();

      // A later load brings the stores up to date; setting the fork up again would reset the fork
      // state while a workflow commit may be relying on it
      expect(initOpenAuthoring).not.toHaveBeenCalled();
    });

    test('keeps the branch check for a maintainer with Open Authoring enabled', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(initOpenAuthoring).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      expect(fetchAndParseFiles).toHaveBeenCalledWith(
        expect.objectContaining({ checkAccess: undefined, checkBranchAccess }),
      );
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

    test('reads an asset committed to a workflow branch from that branch', async () => {
      const asset = /** @type {any} */ ({
        path: 'content/posts/hello/photo.png',
        workflow: { branch: 'cms/posts/hello' },
      });

      const mockBlob = new Blob(['image data'], { type: 'image/png' });

      vi.mocked(fetchAPI).mockResolvedValue(mockBlob);

      const result = await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/files/content%2Fposts%2Fhello%2Fphoto.png/raw?lfs=true&ref=cms%2Fposts%2Fhello',
        { responseType: 'blob' },
      );
      expect(result).toBe(mockBlob);
    });

    test('reads an unpublished asset from the contributor’s fork', async () => {
      vi.mocked(getWorkflowRepository).mockReturnValue({
        owner: 'contributor',
        repo: 'test-repo',
      });

      const asset = /** @type {any} */ ({
        path: 'images/hero.png',
        workflow: { branch: 'cms/contributor/test-repo/posts/hello' },
      });

      vi.mocked(fetchAPI).mockResolvedValue(new Blob(['image data']));

      await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/contributor%2Ftest-repo/repository/files' +
          '/images%2Fhero.png/raw?lfs=true&ref=cms%2Fcontributor%2Ftest-repo%2Fposts%2Fhello',
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
