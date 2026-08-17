import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createFileList } from '$lib/services/backends/process';
import { allEntries } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { convertPullRequest, convertPullRequests } from '$lib/services/workflow/entries';

vi.mock('$lib/services/backends/process');
vi.mock('$lib/services/backends/git/shared/fetch', () => ({
  parseAssetFileInfo: vi.fn((file) => ({ ...file, kind: 'image' })),
}));
vi.mock('$lib/services/contents/file/process');

/**
 * Create a minimal pull request for testing.
 * @param {object} [args] Arguments.
 * @param {string} [args.branch] Branch name.
 * @param {any[]} [args.files] Changed files.
 * @returns {any} Pull request.
 */
const createPullRequest = ({ branch = 'cms/posts/hello', files = [] } = {}) => ({
  number: 1,
  nodeId: 'PR_1',
  title: 'Create Post “hello”',
  url: 'https://github.com/owner/repo/pull/1',
  branch,
  status: 'draft',
  createdDate: new Date(),
  updatedDate: new Date(),
  files,
});

describe('workflow/entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allEntries.set([]);
    vi.mocked(createFileList).mockReturnValue(
      /** @type {any} */ ({ entryFiles: [], assetFiles: [] }),
    );
  });

  describe('convertPullRequestToEntries', () => {
    test('returns nothing for a branch not managed by the CMS', async () => {
      const result = await convertPullRequest(createPullRequest({ branch: 'main' }));

      expect(result).toEqual({ entries: [], assets: [] });
      expect(createFileList).not.toHaveBeenCalled();
    });

    test('skips deleted files but keeps binary ones, which can be assets', async () => {
      await convertPullRequest(
        createPullRequest({
          files: [
            { path: 'content/posts/hello.md', sha: 'a', size: 1, text: '# Hello', deleted: false },
            { path: 'content/posts/old.md', sha: 'b', size: 1, text: '# Old', deleted: true },
            { path: 'static/img.png', sha: 'c', size: 1, text: undefined, deleted: false },
          ],
        }),
      );

      expect(createFileList).toHaveBeenCalledWith([
        { path: 'content/posts/hello.md', sha: 'a', size: 1, text: '# Hello', name: 'hello.md' },
        { path: 'static/img.png', sha: 'c', size: 1, text: undefined, name: 'img.png' },
      ]);
    });

    test('converts the committed assets so they can be previewed', async () => {
      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({
          entryFiles: [],
          assetFiles: [{ path: 'static/img.png', sha: 'c', size: 1, name: 'img.png' }],
        }),
      );

      const { assets } = await convertPullRequest(
        createPullRequest({
          files: [{ path: 'static/img.png', sha: 'c', size: 1, text: undefined, deleted: false }],
        }),
      );

      expect(assets).toEqual([
        {
          path: 'static/img.png',
          sha: 'c',
          size: 1,
          name: 'img.png',
          kind: 'image',
          workflow: { branch: 'cms/posts/hello' },
        },
      ]);
    });

    test('returns an empty array when no file belongs to the collection', async () => {
      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({
          entryFiles: [{ path: 'content/pages/about.md', folder: { collectionName: 'pages' } }],
          assetFiles: [],
        }),
      );

      const result = await convertPullRequest(
        createPullRequest({
          files: [{ path: 'content/pages/about.md', sha: 'a', size: 1, text: '#', deleted: false }],
        }),
      );

      expect(result.entries).toEqual([]);
      expect(prepareEntries).not.toHaveBeenCalled();
    });

    test('attaches the workflow information to the converted entries', async () => {
      const entryFile = {
        path: 'content/posts/hello.md',
        text: '# Hello',
        folder: { collectionName: 'posts', fileName: undefined },
      };

      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({ entryFiles: [entryFile], assetFiles: [] }),
      );

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [/** @type {any} */ ({ id: 'x', slug: 'hello', subPath: 'hello', locales: {} })],
        errors: [],
      });

      const pullRequest = createPullRequest({
        files: [{ path: 'content/posts/hello.md', sha: 'a', size: 1, text: '#', deleted: false }],
      });

      const { entries } = await convertPullRequest(pullRequest);

      expect(prepareEntries).toHaveBeenCalledWith([entryFile]);
      expect(entries).toHaveLength(1);
      expect(entries[0].workflow).toEqual({
        pullRequest,
        status: 'draft',
        collectionName: 'posts',
        fileName: undefined,
        previousPaths: [],
      });
    });

    test('picks up the collection file name for a file collection', async () => {
      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({
          entryFiles: [
            {
              path: 'data/site.yml',
              text: 'a: 1',
              folder: { collectionName: 'settings', fileName: 'site' },
            },
          ],
          assetFiles: [],
        }),
      );

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [/** @type {any} */ ({ id: 'x', slug: 'site', subPath: 'site', locales: {} })],
        errors: [],
      });

      const result = await convertPullRequest(
        createPullRequest({
          branch: 'cms/settings/site',
          files: [{ path: 'data/site.yml', sha: 'a', size: 1, text: 'a: 1', deleted: false }],
        }),
      );

      expect(result.entries[0].workflow.fileName).toBe('site');
    });

    test('recovers the paths of an entry the pull request renamed', async () => {
      const entryFile = {
        path: 'content/posts/renamed.md',
        text: '# Hello',
        folder: { collectionName: 'posts' },
      };

      const deletedFile = { path: 'content/posts/hello.md', folder: { collectionName: 'posts' } };

      vi.mocked(createFileList)
        .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [entryFile], assetFiles: [] }))
        .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [deletedFile], assetFiles: [] }));

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [
          /** @type {any} */ ({ id: 'x', slug: 'renamed', subPath: 'renamed', locales: {} }),
        ],
        errors: [],
      });

      const { entries } = await convertPullRequest(
        createPullRequest({
          files: [
            {
              path: 'content/posts/renamed.md',
              sha: 'a',
              size: 1,
              text: '#',
              deleted: false,
              previousPath: 'content/posts/hello.md',
            },
          ],
        }),
      );

      expect(entries[0].workflow.previousPaths).toEqual(['content/posts/hello.md']);
    });

    test('reuses the published entry a removal-only pull request takes off the site', async () => {
      const publishedEntry = /** @type {any} */ ({
        id: 'published',
        slug: 'hello',
        subPath: 'hello',
        locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
      });

      allEntries.set([
        publishedEntry,
        /** @type {any} */ ({
          id: 'other',
          slug: 'other',
          subPath: 'other',
          locales: { _default: { slug: 'other', path: 'content/posts/other.md', content: {} } },
        }),
      ]);

      const deletedFile = { path: 'content/posts/hello.md', folder: { collectionName: 'posts' } };

      vi.mocked(createFileList)
        .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [], assetFiles: [] }))
        .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [deletedFile], assetFiles: [] }));

      const { entries } = await convertPullRequest(
        createPullRequest({
          files: [
            { path: 'content/posts/hello.md', sha: 'a', size: 1, text: undefined, deleted: true },
          ],
        }),
      );

      expect(prepareEntries).not.toHaveBeenCalled();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('published');

      expect(entries[0].workflow).toMatchObject({
        deletion: true,
        collectionName: 'posts',
        previousPaths: ['content/posts/hello.md'],
      });
    });

    describe('multi-file i18n structures', () => {
      /**
       * Run a pull request that only changes one locale file of a published entry.
       * @param {object} args Arguments.
       * @param {string} args.changedPath Path of the locale file in the pull request.
       * @param {Record<string, string>} args.publishedPaths Published locale paths, keyed by
       * locale.
       * @param {string} args.locale Locale of the changed file.
       * @param {string} [args.slug] Slug of the parsed entry. Empty unless the default locale file
       * is the one that changed.
       * @returns {Promise<any>} Converted entry.
       */
      const convertPartial = async ({ changedPath, publishedPaths, locale, slug = '' }) => {
        allEntries.set([
          /** @type {any} */ ({
            id: 'published',
            slug: 'hello',
            subPath: 'hello',
            locales: Object.fromEntries(
              Object.entries(publishedPaths).map(([_locale, path]) => [
                _locale,
                { slug: 'hello', path, content: { title: `published ${_locale}` } },
              ]),
            ),
          }),
        ]);

        vi.mocked(createFileList).mockReturnValue(
          /** @type {any} */ ({
            entryFiles: [{ path: changedPath, text: 'x', folder: { collectionName: 'posts' } }],
            assetFiles: [],
          }),
        );

        vi.mocked(prepareEntries).mockResolvedValue({
          entries: [
            /** @type {any} */ ({
              id: 'draft',
              // `processI18nMultiFileEntry` only sets the slug from the default locale file
              slug,
              subPath: slug,
              locales: {
                [locale]: { slug: 'hello', path: changedPath, content: { title: 'pending' } },
              },
            }),
          ],
          errors: [],
        });

        const { entries } = await convertPullRequest(
          createPullRequest({
            files: [{ path: changedPath, sha: 'a', size: 1, text: 'x', deleted: false }],
          }),
        );

        return entries[0];
      };

      test('keeps the untouched locales when only a non-default one changed', async () => {
        const entry = await convertPartial({
          changedPath: 'content/posts/ja/hello.md',
          publishedPaths: { en: 'content/posts/en/hello.md', ja: 'content/posts/ja/hello.md' },
          locale: 'ja',
        });

        // Without the published locales, the editor would show English as disabled
        expect(Object.keys(entry.locales).toSorted()).toEqual(['en', 'ja']);
        expect(entry.locales.en.content.title).toBe('published en');
        expect(entry.locales.ja.content.title).toBe('pending');

        // The slug comes from the default locale file, which this pull request doesn’t carry
        expect(entry.slug).toBe('hello');
        expect(entry.subPath).toBe('hello');
      });

      test('keeps the untouched locales when only the default one changed', async () => {
        const entry = await convertPartial({
          changedPath: 'content/posts/en/hello.md',
          publishedPaths: { en: 'content/posts/en/hello.md', ja: 'content/posts/ja/hello.md' },
          locale: 'en',
          slug: 'hello',
        });

        expect(Object.keys(entry.locales).toSorted()).toEqual(['en', 'ja']);
        expect(entry.locales.ja.content.title).toBe('published ja');
        expect(entry.locales.en.content.title).toBe('pending');
      });

      test('takes the identity from the published entry, not a localized slug', async () => {
        // With `canonicalSlugKey` the locales carry different slugs, so the one parsed from a
        // non-default locale file must not become the entry’s slug
        allEntries.set([
          /** @type {any} */ ({
            id: 'published',
            slug: 'english-title',
            subPath: 'english-title',
            locales: {
              en: { slug: 'english-title', path: 'blog/english-title.en.md', content: {} },
              ja: { slug: 'nihongo', path: 'blog/nihongo.ja.md', content: {} },
            },
          }),
        ]);

        vi.mocked(createFileList).mockReturnValue(
          /** @type {any} */ ({
            entryFiles: [
              { path: 'blog/nihongo.ja.md', text: 'x', folder: { collectionName: 'posts' } },
            ],
            assetFiles: [],
          }),
        );

        vi.mocked(prepareEntries).mockResolvedValue({
          entries: [
            /** @type {any} */ ({
              id: 'draft',
              slug: 'nihongo',
              subPath: 'nihongo',
              locales: { ja: { slug: 'nihongo', path: 'blog/nihongo.ja.md', content: {} } },
            }),
          ],
          errors: [],
        });

        const { entries } = await convertPullRequest(
          createPullRequest({
            files: [{ path: 'blog/nihongo.ja.md', sha: 'a', size: 1, text: 'x', deleted: false }],
          }),
        );

        expect(entries[0].slug).toBe('english-title');
        expect(entries[0].subPath).toBe('english-title');
      });

      test('keeps the pull request’s slug when it renamed the entry', async () => {
        allEntries.set([
          /** @type {any} */ ({
            id: 'published',
            slug: 'old',
            subPath: 'old',
            locales: { en: { slug: 'old', path: 'blog/old.en.md', content: {} } },
          }),
        ]);

        vi.mocked(createFileList)
          .mockReturnValueOnce(
            /** @type {any} */ ({
              entryFiles: [
                { path: 'blog/new.en.md', text: 'x', folder: { collectionName: 'posts' } },
              ],
              assetFiles: [],
            }),
          )
          .mockReturnValueOnce(
            /** @type {any} */ ({
              entryFiles: [
                { path: 'blog/old.en.md', text: '', folder: { collectionName: 'posts' } },
              ],
              assetFiles: [],
            }),
          );

        vi.mocked(prepareEntries).mockResolvedValue({
          entries: [
            /** @type {any} */ ({
              id: 'draft',
              slug: 'new',
              subPath: 'new',
              locales: { en: { slug: 'new', path: 'blog/new.en.md', content: {} } },
            }),
          ],
          errors: [],
        });

        const { entries } = await convertPullRequest(
          createPullRequest({
            files: [
              {
                path: 'blog/new.en.md',
                sha: 'a',
                size: 1,
                text: 'x',
                deleted: false,
                previousPath: 'blog/old.en.md',
              },
            ],
          }),
        );

        expect(entries[0].slug).toBe('new');
      });

      test('matches by path, so a root folder layout works the same', async () => {
        // `multiple_root_folders` puts the locale at the top instead of inside the collection
        const entry = await convertPartial({
          changedPath: 'ja/content/posts/hello.md',
          publishedPaths: { en: 'en/content/posts/hello.md', ja: 'ja/content/posts/hello.md' },
          locale: 'ja',
        });

        expect(Object.keys(entry.locales).toSorted()).toEqual(['en', 'ja']);
        expect(entry.slug).toBe('hello');
      });

      test('leaves an entirely new entry alone', async () => {
        allEntries.set([]);

        vi.mocked(createFileList).mockReturnValue(
          /** @type {any} */ ({
            entryFiles: [
              { path: 'content/posts/en/new.md', text: 'x', folder: { collectionName: 'posts' } },
            ],
            assetFiles: [],
          }),
        );

        vi.mocked(prepareEntries).mockResolvedValue({
          entries: [
            /** @type {any} */ ({
              id: 'draft',
              slug: 'new',
              subPath: 'new',
              locales: { en: { slug: 'new', path: 'content/posts/en/new.md', content: {} } },
            }),
          ],
          errors: [],
        });

        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/posts/new',
            files: [
              { path: 'content/posts/en/new.md', sha: 'a', size: 1, text: 'x', deleted: false },
            ],
          }),
        );

        expect(Object.keys(entries[0].locales)).toEqual(['en']);
        expect(entries[0].slug).toBe('new');
      });
    });

    test('returns nothing when a pull request has no entry file at all', async () => {
      const { entries } = await convertPullRequest(
        createPullRequest({
          files: [{ path: 'static/img.png', sha: 'c', size: 1, text: undefined, deleted: false }],
        }),
      );

      expect(entries).toEqual([]);
    });
  });

  describe('convertPullRequestsToEntries', () => {
    test('flattens the results of multiple pull requests', async () => {
      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({
          entryFiles: [
            { path: 'content/posts/hello.md', text: '#', folder: { collectionName: 'posts' } },
          ],
          assetFiles: [],
        }),
      );

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [/** @type {any} */ ({ id: 'x', slug: 'hello', subPath: 'hello', locales: {} })],
        errors: [],
      });

      const files = [
        { path: 'content/posts/hello.md', sha: 'a', size: 1, text: '#', deleted: false },
      ];

      const result = await convertPullRequests([
        createPullRequest({ branch: 'cms/posts/hello', files }),
        createPullRequest({ branch: 'cms/posts/world', files }),
        createPullRequest({ branch: 'main', files }),
      ]);

      expect(result.entries).toHaveLength(2);
    });
  });
});
