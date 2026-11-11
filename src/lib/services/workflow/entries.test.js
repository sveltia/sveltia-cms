import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createFileList } from '$lib/services/backends/process';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import {
  getEntriesByCollection,
  matchesCollectionFilter,
} from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { prepareEntries } from '$lib/services/contents/file/process';
import { getEntryFoldersByPath } from '$lib/services/contents/folders';
import { convertPullRequest, convertPullRequests } from '$lib/services/workflow/entries';

vi.mock('$lib/services/backends/process');
vi.mock('$lib/services/backends/git/shared/parse-files', () => ({
  parseAssetFileInfo: vi.fn((file) => ({ ...file, kind: 'image' })),
}));
vi.mock('$lib/services/contents/file/process');
vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn((entry) => entry.id === 'pinned'),
}));
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(
    (name) =>
      /** @type {Record<string, any>} */ ({
        sections: {
          name,
          _type: 'entry',
          _file: {},
          _i18n: { structureMap: {}, canonicalSlug: { key: 'translationKey' } },
        },
        tiles: {
          name,
          _type: 'entry',
          _file: {},
          _i18n: {
            structureMap: { i18nMultiFolder: true },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        fixed: {
          name,
          _type: 'entry',
          create: false,
          _file: {},
          _i18n: { structureMap: {}, canonicalSlug: { key: 'translationKey' } },
        },
        frozen: { name, _type: 'entry', readonly: true },
        guides: {
          name,
          _type: 'entry',
          _i18n: {
            structureMap: { i18nMultiFolder: true },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        posts: {
          name,
          _type: 'entry',
          _file: {},
          _i18n: { structureMap: {}, canonicalSlug: { key: 'translationKey' } },
        },
        players: {
          name,
          _type: 'entry',
          _file: {},
          _i18n: { structureMap: {}, canonicalSlug: { key: 'translationKey' } },
        },
        places: {
          name,
          _type: 'entry',
          _i18n: {
            structureMap: { i18nSingleFile: true },
            canonicalSlug: { key: 'translationKey' },
          },
        },
      })[name],
  ),
}));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
  matchesCollectionFilter: vi.fn(() => true),
}));
vi.mock('$lib/services/contents/folders', () => ({
  getEntryFoldersByPath: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFileEntry: vi.fn(),
}));

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
    allEntries.current = [];
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

    describe('with a root directory', () => {
      beforeEach(() => {
        // @ts-ignore Partial configuration
        cmsConfig.current = { backend: { name: 'github', repo: 'o/r', root_dir: 'apps/site' } };
      });

      afterEach(() => {
        cmsConfig.current = undefined;
      });

      test('converts a branch named before the option was set, with its files in the directory', async () => {
        await convertPullRequest(
          createPullRequest({
            files: [
              { path: 'content/posts/hello.md', sha: 'a', size: 1, text: '#', deleted: false },
            ],
          }),
        );

        expect(createFileList).toHaveBeenCalled();
      });

      test.each([
        ['a file outside the directory', { path: '../other/content/hello.md' }],
        [
          'a file moved from outside the directory',
          { path: 'content/posts/hello.md', previousPath: '../other/content/hello.md' },
        ],
      ])('skips a branch named without the directory, with %s', async (_label, file) => {
        const result = await convertPullRequest(
          createPullRequest({ files: [{ sha: 'a', size: 1, text: '#', deleted: false, ...file }] }),
        );

        expect(result).toEqual({ entries: [], assets: [] });
        expect(createFileList).not.toHaveBeenCalled();
      });

      test('converts a branch named with the directory, whatever its files', async () => {
        await convertPullRequest(
          createPullRequest({
            branch: 'cms/apps/site/posts/hello',
            files: [{ path: '../../package.json', sha: 'a', size: 1, text: '{}', deleted: false }],
          }),
        );

        // A change outside the directory is caught when the entry is published
        expect(createFileList).toHaveBeenCalled();
      });
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

    test('attaches the entries of other collections riding along in the pull request', async () => {
      /**
       * Build an entry file.
       * @param {string} path File path.
       * @param {object} folder Collection the file belongs to.
       * @returns {any} File.
       */
      const file = (path, folder) => ({
        path,
        text: '#',
        folder: { fileName: undefined, ...folder },
      });

      const postFile = file('content/posts/hello.md', { collectionName: 'posts' });

      const sectionFiles = [
        file('content/sections/en/guides.md', { collectionName: 'sections' }),
        file('content/sections/fr/guides.md', { collectionName: 'sections' }),
      ];

      const tileFile = file('content/tiles/help.md', { collectionName: 'tiles' });
      // A published entry edited along with the post, or rewritten to update a reference
      const editedFile = file('content/tiles/home.md', { collectionName: 'tiles' });
      // Not one the CMS can change along with the post, e.g. in a read-only collection
      const lockedFile = file('content/frozen/locked.md', { collectionName: 'frozen' });
      // Nor a read-only entry
      const pinnedFile = file('content/tiles/pinned.md', { collectionName: 'tiles' });
      // A Relation field can’t add a file to a file collection, nor parse a binary file
      const settingsFile = file('data/site.yml', { collectionName: 'settings', fileName: 'site' });

      const binaryFile = {
        ...file('content/tiles/blob.md', { collectionName: 'tiles' }),
        text: undefined,
      };

      // Nor would the CMS add an entry to a collection it can’t create entries in
      const fixedFile = file('content/fixed/a.md', { collectionName: 'fixed' });
      const frozenFile = file('content/frozen/b.md', { collectionName: 'frozen' });
      const unknownFile = file('content/gone/c.md', { collectionName: 'gone' });

      allEntries.current = [
        /** @type {any} */ ({
          id: 'home',
          slug: 'home',
          subPath: 'home',
          locales: { _default: { path: 'content/tiles/home.md', content: { title: 'Home' } } },
        }),
        /** @type {any} */ ({
          id: 'pinned',
          slug: 'pinned',
          subPath: 'pinned',
          locales: { _default: { path: 'content/tiles/pinned.md', content: {} } },
        }),
        /** @type {any} */ ({
          id: 'locked',
          slug: 'locked',
          subPath: 'locked',
          locales: { _default: { path: 'content/frozen/locked.md', content: {} } },
        }),
      ];

      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({
          entryFiles: [
            postFile,
            ...sectionFiles,
            tileFile,
            editedFile,
            pinnedFile,
            lockedFile,
            settingsFile,
            binaryFile,
            fixedFile,
            frozenFile,
            unknownFile,
          ],
          assetFiles: [],
        }),
      );

      const section = { id: 's', slug: 'guides', subPath: 'guides', locales: {} };
      const tile = { id: 't', slug: 'help', subPath: 'help', locales: {} };

      const home = {
        id: 'parsed',
        slug: 'home',
        subPath: 'home',
        locales: { _default: { path: 'content/tiles/home.md', content: { title: 'Welcome' } } },
      };

      const locked = {
        id: 'parsed-locked',
        slug: 'locked',
        subPath: 'locked',
        locales: { _default: { path: 'content/frozen/locked.md', content: {} } },
      };

      /** @type {Record<string, any[]>} */
      const parsedEntries = {
        'content/posts/hello.md': [{ id: 'x', slug: 'hello', subPath: 'hello', locales: {} }],
        'content/sections/en/guides.md': [section],
        'content/tiles/help.md': [tile],
        'content/tiles/home.md': [home],
        'content/frozen/locked.md': [locked],
        'content/tiles/pinned.md': [
          {
            id: 'parsed-pinned',
            slug: 'pinned',
            subPath: 'pinned',
            locales: { _default: { path: 'content/tiles/pinned.md', content: {} } },
          },
        ],
        // A new entry in a collection the CMS can’t create entries in
        'content/fixed/a.md': [{ id: 'f', slug: 'a', subPath: 'a', locales: {} }],
      };

      vi.mocked(prepareEntries).mockImplementation(async (files) => ({
        entries: files.flatMap(({ path }) => parsedEntries[path] ?? []),
        errors: [],
      }));

      const { entries } = await convertPullRequest(
        createPullRequest({
          files: [{ path: 'content/posts/hello.md', sha: 'a', size: 1, text: '#', deleted: false }],
        }),
      );

      expect(prepareEntries).toHaveBeenCalledWith(sectionFiles);
      expect(prepareEntries).toHaveBeenCalledWith([tileFile, editedFile, pinnedFile]);
      // The files of a collection the CMS can’t write to aren’t parsed
      expect(prepareEntries).not.toHaveBeenCalledWith([lockedFile]);
      expect(entries[0].workflow.companions).toEqual([
        { collectionName: 'sections', entry: section },
        { collectionName: 'tiles', entry: tile },
        // An existing entry keeps the ID of its published version
        { collectionName: 'tiles', entry: { ...home, id: 'home' }, edited: true },
      ]);
    });

    test('keeps a locale file an edited entry adds, wherever entries can be created', async () => {
      // Turning on a locale for an existing entry adds its file, which isn’t a new entry
      const enFile = {
        path: 'content/fixed/a.md',
        text: '#',
        folder: { collectionName: 'fixed', fileName: undefined },
      };

      const frFile = { ...enFile, path: 'content/fixed/fr/a.md' };

      allEntries.current = [
        /** @type {any} */ ({
          id: 'a',
          slug: 'a',
          subPath: 'a',
          locales: { en: { path: 'content/fixed/a.md', content: {} } },
        }),
      ];

      const postFile = {
        path: 'content/posts/hello.md',
        text: '#',
        folder: { collectionName: 'posts', fileName: undefined },
      };

      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({ entryFiles: [postFile, enFile, frFile], assetFiles: [] }),
      );

      const parsed = {
        id: 'parsed',
        slug: 'a',
        subPath: 'a',
        locales: {
          en: { path: 'content/fixed/a.md', content: {} },
          fr: { path: 'content/fixed/fr/a.md', content: {} },
        },
      };

      const post = { id: 'x', slug: 'hello', subPath: 'hello', locales: {} };

      vi.mocked(prepareEntries).mockImplementation(async (files) => ({
        entries: /** @type {any} */ (files[0].path === 'content/fixed/a.md' ? [parsed] : [post]),
        errors: [],
      }));

      const { entries } = await convertPullRequest(createPullRequest({ files: [] }));

      expect(prepareEntries).toHaveBeenCalledWith([enFile, frFile]);
      expect(entries[0].workflow.companions).toEqual([
        { collectionName: 'fixed', entry: { ...parsed, id: 'a' }, edited: true },
      ]);
    });

    test('tells an edit that only turns on a locale from a new entry', async () => {
      const frFile = {
        path: 'content/tiles/fr/home.md',
        text: '#',
        folder: { collectionName: 'tiles', fileName: undefined },
      };

      const postFile = {
        path: 'content/posts/hello.md',
        text: '#',
        folder: { collectionName: 'posts', fileName: undefined },
      };

      const published = {
        id: 'home',
        slug: 'home',
        subPath: 'home',
        locales: { en: { path: 'content/tiles/home.md', content: { title: 'Home' } } },
      };

      const parsed = {
        id: 'parsed',
        slug: 'home',
        subPath: 'home',
        locales: { fr: { path: 'content/tiles/fr/home.md', content: { title: 'Accueil' } } },
      };

      const post = { id: 'x', slug: 'hello', subPath: 'hello', locales: {} };

      allEntries.current = [/** @type {any} */ (published)];
      vi.mocked(getEntriesByCollection).mockReturnValue([/** @type {any} */ (published)]);
      vi.mocked(createFileList).mockReturnValue(
        /** @type {any} */ ({ entryFiles: [postFile, frFile], assetFiles: [] }),
      );
      vi.mocked(prepareEntries).mockImplementation(async (files) => ({
        entries: /** @type {any} */ (files[0] === frFile ? [parsed] : [post]),
        errors: [],
      }));

      const { entries } = await convertPullRequest(createPullRequest({ files: [] }));

      expect(getEntriesByCollection).toHaveBeenCalledWith('tiles');
      expect(entries[0].workflow.companions).toEqual([
        {
          collectionName: 'tiles',
          entry: { ...published, locales: { ...published.locales, ...parsed.locales } },
          edited: true,
        },
      ]);
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

      allEntries.current = [
        publishedEntry,
        /** @type {any} */ ({
          id: 'other',
          slug: 'other',
          subPath: 'other',
          locales: { _default: { slug: 'other', path: 'content/posts/other.md', content: {} } },
        }),
      ];

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

      // The pull request predates the dedicated status, so it’s taken from the contents instead
      expect(entries[0].workflow).toMatchObject({
        status: 'pending_deletion',
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
        allEntries.current = [
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
        ];

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
        allEntries.current = [
          /** @type {any} */ ({
            id: 'published',
            slug: 'english-title',
            subPath: 'english-title',
            locales: {
              en: { slug: 'english-title', path: 'blog/english-title.en.md', content: {} },
              ja: { slug: 'nihongo', path: 'blog/nihongo.ja.md', content: {} },
            },
          }),
        ];

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
        allEntries.current = [
          /** @type {any} */ ({
            id: 'published',
            slug: 'old',
            subPath: 'old',
            locales: { en: { slug: 'old', path: 'blog/old.en.md', content: {} } },
          }),
        ];

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
        allEntries.current = [];

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

      describe('a locale turned on for a published entry', () => {
        /**
         * Run a pull request that only adds the file of a locale turned on for a published entry,
         * a path the published entry doesn’t have.
         * @param {object} args Arguments.
         * @param {string} args.collectionName Collection name.
         * @param {string} args.path Path of the added file.
         * @param {any} args.entry Entry parsed from the added file.
         * @param {string} [args.fileName] Collection file name.
         * @returns {Promise<any>} Converted entry.
         */
        const convertAdded = async ({ collectionName, path, entry, fileName }) => {
          vi.mocked(createFileList).mockReturnValue(
            /** @type {any} */ ({
              entryFiles: [{ path, text: 'x', folder: { collectionName, fileName } }],
              assetFiles: [],
            }),
          );
          vi.mocked(prepareEntries).mockResolvedValue({ entries: [entry], errors: [] });

          const { entries } = await convertPullRequest(
            createPullRequest({
              branch: `cms/${collectionName}/kyoto`,
              files: [{ path, sha: 'a', size: 1, text: 'x', deleted: false }],
            }),
          );

          return entries[0];
        };

        /**
         * Create a published entry.
         * @param {string} subPath Sub path.
         * @param {Record<string, any>} [content] English content.
         * @returns {any} Entry.
         */
        const published = (subPath, content = {}) => ({
          id: subPath,
          slug: subPath,
          subPath,
          locales: { en: { slug: subPath, path: `content/en/guides/${subPath}.md`, content } },
        });

        test('finds the published entry by its sub path', async () => {
          // Saving the entry with Japanese turned on and English unchanged commits the Japanese
          // file only. Without the published English locale, the editor showed it as disabled
          vi.mocked(getEntriesByCollection).mockReturnValue([
            published('nara'),
            published('kyoto'),
          ]);

          const entry = await convertAdded({
            collectionName: 'guides',
            path: 'content/ja/guides/kyoto.md',
            entry: {
              id: 'draft',
              slug: 'kyoto',
              subPath: 'kyoto',
              locales: {
                ja: {
                  slug: 'kyoto',
                  path: 'content/ja/guides/kyoto.md',
                  content: { title: '京都' },
                },
              },
            },
          });

          expect(getEntriesByCollection).toHaveBeenCalledWith('guides');
          expect(entry.locales.en.path).toBe('content/en/guides/kyoto.md');
          expect(Object.keys(entry.locales).toSorted()).toEqual(['en', 'ja']);
          expect(entry.locales.ja.content.title).toBe('京都');
        });

        test('finds the published entry by its canonical slug', async () => {
          // With a localized slug, the Japanese file has a sub path of its own, linked to the
          // English one by the translation key, which also outranks a matching sub path
          vi.mocked(getEntriesByCollection).mockReturnValue([
            published('kyoto-no-tera', { translationKey: 'nara' }),
            published('kyoto-temples', { translationKey: 'kyoto-temples' }),
          ]);

          const entry = await convertAdded({
            collectionName: 'guides',
            path: 'content/ja/guides/kyoto-no-tera.md',
            entry: {
              id: 'draft',
              slug: 'kyoto-no-tera',
              subPath: 'kyoto-no-tera',
              locales: {
                ja: {
                  slug: 'kyoto-no-tera',
                  path: 'content/ja/guides/kyoto-no-tera.md',
                  content: { translationKey: 'kyoto-temples' },
                },
              },
            },
          });

          expect(entry.locales.en.path).toBe('content/en/guides/kyoto-temples.md');
          expect(Object.keys(entry.locales).toSorted()).toEqual(['en', 'ja']);
          expect(entry.slug).toBe('kyoto-temples');
        });

        test('finds the published collection file by its name', async () => {
          vi.mocked(getCollectionFileEntry).mockReturnValue(
            /** @type {any} */ ({
              id: 'about',
              slug: 'about',
              subPath: 'content/pages/about.en.md',
              locales: { en: { slug: 'about', path: 'content/pages/about.en.md', content: {} } },
            }),
          );

          const entry = await convertAdded({
            collectionName: 'pages',
            fileName: 'about',
            path: 'content/pages/about.ja.md',
            entry: {
              id: 'draft',
              slug: 'about',
              subPath: 'content/pages/about.ja.md',
              locales: { ja: { slug: 'about', path: 'content/pages/about.ja.md', content: {} } },
            },
          });

          expect(getCollectionFileEntry).toHaveBeenCalledWith('pages', 'about');
          expect(Object.keys(entry.locales).toSorted()).toEqual(['en', 'ja']);
        });

        test('leaves an entry alone when its locales share a file', async () => {
          // A new file of a single-file collection is a new entry, whatever its sub path
          vi.mocked(getEntriesByCollection).mockReturnValue([published('kyoto')]);

          const entry = await convertAdded({
            collectionName: 'places',
            path: 'data/places/kyoto.yml',
            entry: {
              id: 'draft',
              slug: 'kyoto',
              subPath: 'kyoto',
              locales: { ja: { slug: 'kyoto', path: 'data/places/kyoto.yml', content: {} } },
            },
          });

          expect(getEntriesByCollection).not.toHaveBeenCalled();
          expect(Object.keys(entry.locales)).toEqual(['ja']);
        });
      });

      describe('a locale turned off for a published entry', () => {
        beforeEach(() => {
          allEntries.current = [
            /** @type {any} */ ({
              id: 'published',
              slug: 'hello',
              subPath: 'hello',
              locales: {
                en: { slug: 'hello', path: 'content/posts/en/hello.md', content: {} },
                ja: { slug: 'hello', path: 'content/posts/ja/hello.md', content: {} },
              },
            }),
          ];
        });

        test('treats a pull request deleting only that locale’s file as an edit', async () => {
          // Saving the entry with Japanese turned off and nothing else changed deletes the Japanese
          // file only, so the pull request carries no entry file to parse. It’s not an Unpublish of
          // the whole entry: the entry keeps the pull request’s status and its English locale.
          vi.mocked(createFileList)
            .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [], assetFiles: [] }))
            .mockReturnValueOnce(
              /** @type {any} */ ({
                entryFiles: [
                  { path: 'content/posts/ja/hello.md', folder: { collectionName: 'posts' } },
                ],
                assetFiles: [],
              }),
            );

          const { entries } = await convertPullRequest(
            createPullRequest({
              files: [
                {
                  path: 'content/posts/ja/hello.md',
                  sha: 'a',
                  size: 1,
                  text: undefined,
                  deleted: true,
                },
              ],
            }),
          );

          expect(prepareEntries).not.toHaveBeenCalled();
          expect(entries).toHaveLength(1);
          expect(entries[0].id).toBe('published');
          expect(entries[0].slug).toBe('hello');
          expect(Object.keys(entries[0].locales)).toEqual(['en']);

          expect(entries[0].workflow).toMatchObject({
            status: 'draft',
            collectionName: 'posts',
            fileName: undefined,
            previousPaths: ['content/posts/ja/hello.md'],
          });
        });

        test('keeps the pull request’s status for such an edit', async () => {
          vi.mocked(createFileList)
            .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [], assetFiles: [] }))
            .mockReturnValueOnce(
              /** @type {any} */ ({
                entryFiles: [
                  {
                    path: 'content/posts/ja/hello.md',
                    folder: { collectionName: 'posts', fileName: 'hello' },
                  },
                ],
                assetFiles: [],
              }),
            );

          const { entries } = await convertPullRequest({
            ...createPullRequest({
              files: [
                {
                  path: 'content/posts/ja/hello.md',
                  sha: 'a',
                  size: 1,
                  text: undefined,
                  deleted: true,
                },
              ],
            }),
            status: 'pending_review',
          });

          expect(entries[0].workflow.status).toBe('pending_review');
          // A file collection’s file name comes from the deleted file
          expect(entries[0].workflow.fileName).toBe('hello');
        });

        test('still treats a pull request deleting every locale’s file as a removal', async () => {
          vi.mocked(createFileList)
            .mockReturnValueOnce(/** @type {any} */ ({ entryFiles: [], assetFiles: [] }))
            .mockReturnValueOnce(
              /** @type {any} */ ({
                entryFiles: [
                  { path: 'content/posts/en/hello.md', folder: { collectionName: 'posts' } },
                  { path: 'content/posts/ja/hello.md', folder: { collectionName: 'posts' } },
                ],
                assetFiles: [],
              }),
            );

          const { entries } = await convertPullRequest(
            createPullRequest({
              files: ['en', 'ja'].map((locale) => ({
                path: `content/posts/${locale}/hello.md`,
                sha: locale,
                size: 1,
                text: undefined,
                deleted: true,
              })),
            }),
          );

          expect(entries).toHaveLength(1);
          expect(entries[0].workflow.status).toBe('pending_deletion');
          expect(Object.keys(entries[0].locales).toSorted()).toEqual(['en', 'ja']);
        });

        test('leaves out the removed locale when another locale’s file changed too', async () => {
          // The published locales are merged into the entry parsed from the pull request, but not
          // the Japanese one the pull request deletes, so the editor doesn’t show Japanese as
          // enabled again, and the next save doesn’t recreate its file
          vi.mocked(createFileList)
            .mockReturnValueOnce(
              /** @type {any} */ ({
                entryFiles: [
                  {
                    path: 'content/posts/en/hello.md',
                    text: 'x',
                    folder: { collectionName: 'posts' },
                  },
                ],
                assetFiles: [],
              }),
            )
            .mockReturnValueOnce(
              /** @type {any} */ ({
                entryFiles: [
                  { path: 'content/posts/ja/hello.md', folder: { collectionName: 'posts' } },
                ],
                assetFiles: [],
              }),
            );

          vi.mocked(prepareEntries).mockResolvedValue({
            entries: [
              /** @type {any} */ ({
                id: 'draft',
                slug: 'hello',
                subPath: 'hello',
                locales: {
                  en: { slug: 'hello', path: 'content/posts/en/hello.md', content: {} },
                },
              }),
            ],
            errors: [],
          });

          const { entries } = await convertPullRequest(
            createPullRequest({
              files: [
                { path: 'content/posts/en/hello.md', sha: 'a', size: 1, text: 'x', deleted: false },
                {
                  path: 'content/posts/ja/hello.md',
                  sha: 'b',
                  size: 1,
                  text: undefined,
                  deleted: true,
                },
              ],
            }),
          );

          expect(entries[0].workflow.status).toBe('draft');
          expect(Object.keys(entries[0].locales)).toEqual(['en']);
        });
      });
    });

    describe('other entries of the collection rewritten along with the entry', () => {
      /**
       * Create a published entry of the `posts` collection.
       * @param {string} slug Slug, which is also the sub path.
       * @returns {any} Entry.
       */
      const createPost = (slug) => ({
        id: `published-${slug}`,
        slug,
        subPath: slug,
        locales: { _default: { slug, path: `content/posts/${slug}.md`, content: {} } },
      });

      beforeEach(() => {
        allEntries.current = [
          createPost('hello'),
          createPost('other'),
          createPost('about'),
          createPost('about/team'),
        ];

        // Classify the files like the real file list does
        vi.mocked(createFileList).mockImplementation(
          (files) =>
            /** @type {any} */ ({
              entryFiles: files
                .filter(({ path }) => path.startsWith('content/posts/'))
                .map((file) => ({ ...file, folder: { collectionName: 'posts' } })),
              assetFiles: [],
            }),
        );

        vi.mocked(prepareEntries).mockImplementation(async (files) => ({
          entries: files.map(({ path }) => {
            const slug = path.replace(/^content\/posts\/(.+)\.md$/, '$1');

            return /** @type {any} */ ({
              id: `parsed-${slug}`,
              slug,
              subPath: slug,
              locales: { _default: { slug, path, content: {} } },
            });
          }),
          errors: [],
        }));
      });

      test('lists the deleted entry rather than an entry whose reference to it was removed', async () => {
        const pullRequest = createPullRequest({
          files: [
            { path: 'content/posts/hello.md', sha: '', size: 0, deleted: true },
            { path: 'content/posts/other.md', sha: 'b', size: 1, text: 'b', deleted: false },
          ],
        });

        pullRequest.status = 'pending_deletion';

        const { entries } = await convertPullRequest(pullRequest);

        expect(entries.map(({ id, workflow }) => [id, workflow.status])).toEqual([
          ['published-hello', 'pending_deletion'],
        ]);
      });

      test('lists the renamed entry alone, found by the slug it was published with', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            files: [
              {
                path: 'content/posts/hello-world.md',
                sha: 'a',
                size: 1,
                text: 'a',
                deleted: false,
                previousPath: 'content/posts/hello.md',
              },
              { path: 'content/posts/other.md', sha: 'b', size: 1, text: 'b', deleted: false },
            ],
          }),
        );

        expect(entries.map(({ slug }) => slug)).toEqual(['hello-world']);
        expect(entries[0].workflow.previousPaths).toEqual(['content/posts/hello.md']);
      });

      test('lists the renamed entry alone, found by the slug it was saved with', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/posts/hello-world',
            files: [
              {
                path: 'content/posts/hello-world.md',
                sha: 'a',
                size: 1,
                text: 'a',
                deleted: false,
              },
              { path: 'content/posts/hello.md', sha: '', size: 0, deleted: true },
              { path: 'content/posts/other.md', sha: 'b', size: 1, text: 'b', deleted: false },
            ],
          }),
        );

        expect(entries.map(({ slug }) => slug)).toEqual(['hello-world']);
      });

      test('lists the moved entry alone, not the entries below it, once renamed again', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            // The slug the entry was first saved with, which neither the published entry nor the
            // one in the pull request has any more
            branch: 'cms/posts/company%2Fabout',
            files: [
              {
                path: 'content/posts/team/about/team.md',
                sha: 'b',
                size: 1,
                text: 'b',
                deleted: false,
                previousPath: 'content/posts/about/team.md',
              },
              {
                path: 'content/posts/team/about.md',
                sha: 'a',
                size: 1,
                text: 'a',
                deleted: false,
                previousPath: 'content/posts/about.md',
              },
            ],
          }),
        );

        expect(entries.map(({ slug }) => slug)).toEqual(['team/about']);
      });

      test('keeps every entry when none of them can be told apart', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/posts/unknown',
            files: [
              { path: 'content/posts/hello.md', sha: 'a', size: 1, text: 'a', deleted: false },
              { path: 'content/posts/other.md', sha: 'b', size: 1, text: 'b', deleted: false },
            ],
          }),
        );

        expect(entries.map(({ slug }) => slug)).toEqual(['hello', 'other']);
      });

      test('takes the collection file name from the file of the entry', async () => {
        allEntries.current = [
          /** @type {any} */ ({
            id: 'published-site',
            slug: 'site',
            subPath: 'site',
            locales: { _default: { slug: 'site', path: 'data/site.yml', content: {} } },
          }),
          /** @type {any} */ ({
            id: 'published-menu',
            slug: 'menu',
            subPath: 'menu',
            locales: { _default: { slug: 'menu', path: 'data/menu.yml', content: {} } },
          }),
        ];

        vi.mocked(createFileList).mockImplementation(
          (files) =>
            /** @type {any} */ ({
              entryFiles: files.map((file) => ({
                ...file,
                folder: {
                  collectionName: 'settings',
                  fileName: file.path.replace(/^data\/(.+)\.yml$/, '$1'),
                },
              })),
              assetFiles: [],
            }),
        );

        vi.mocked(prepareEntries).mockImplementation(async (files) => ({
          entries: files.map(({ path, folder }) => {
            const slug = /** @type {string} */ (folder?.fileName);

            return /** @type {any} */ ({
              id: `parsed-${slug}`,
              slug,
              subPath: slug,
              locales: { _default: { slug, path, content: {} } },
            });
          }),
          errors: [],
        }));

        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/settings/site',
            files: [
              { path: 'data/menu.yml', sha: 'b', size: 1, text: 'b', deleted: false },
              { path: 'data/site.yml', sha: 'a', size: 1, text: 'a', deleted: false },
            ],
          }),
        );

        expect(entries.map(({ id }) => id)).toEqual(['parsed-site']);
        expect(entries[0].workflow.fileName).toBe('site');
      });
    });

    // @see https://github.com/sveltia/sveltia-cms/issues/1149
    describe('collections sharing a folder', () => {
      /**
       * Get the `breadcrumb` value the mocked entry file at the given path stores.
       * @param {string} path File path.
       * @returns {string} Value.
       */
      const getBreadcrumb = (path) => (path.includes('player') ? 'player' : 'post');

      beforeEach(() => {
        // The file list assigns every file in `src` to `posts`, which comes first in the config
        vi.mocked(createFileList).mockImplementation(
          (files) =>
            /** @type {any} */ ({
              entryFiles: files.map((file) => ({ ...file, folder: { collectionName: 'posts' } })),
              assetFiles: [],
            }),
        );

        vi.mocked(getEntryFoldersByPath).mockImplementation(() => [
          { collectionName: 'posts', folderPath: 'src' },
          { collectionName: 'players', folderPath: 'src' },
        ]);

        vi.mocked(prepareEntries).mockImplementation(async (files) => ({
          entries: files.map(({ path, folder }) => {
            const slug = path.replace(/^src\/(.+)\.md$/, '$1');

            return /** @type {any} */ ({
              id: `${folder?.collectionName}-${slug}`,
              slug,
              subPath: slug,
              locales: {
                _default: { slug, path, content: { breadcrumb: getBreadcrumb(path) } },
              },
            });
          }),
          errors: [],
        }));

        vi.mocked(matchesCollectionFilter).mockImplementation(
          (collection, entry) =>
            entry.locales._default.content.breadcrumb ===
            (collection.name === 'players' ? 'player' : 'post'),
        );
      });

      afterEach(() => {
        vi.mocked(getEntryFoldersByPath).mockReset().mockReturnValue([]);
        vi.mocked(matchesCollectionFilter).mockReset().mockReturnValue(true);
      });

      test('lists the entry under the collection named in the branch, not the first one', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/players/jane-player',
            files: [{ path: 'src/jane-player.md', sha: 'a', size: 1, text: 'a', deleted: false }],
          }),
        );

        expect(entries.map(({ id, workflow }) => [id, workflow.collectionName])).toEqual([
          ['players-jane-player', 'players'],
        ]);
      });

      test('lists the entry of the first collection as before', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/posts/hello',
            files: [{ path: 'src/hello.md', sha: 'a', size: 1, text: 'a', deleted: false }],
          }),
        );

        expect(entries.map(({ id, workflow }) => [id, workflow.collectionName])).toEqual([
          ['posts-hello', 'posts'],
        ]);
      });

      test('hands an entry of the other collection over as a companion', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/players/jane-player',
            files: [
              { path: 'src/jane-player.md', sha: 'a', size: 1, text: 'a', deleted: false },
              { path: 'src/news.md', sha: 'b', size: 1, text: 'b', deleted: false },
            ],
          }),
        );

        expect(entries.map(({ id }) => id)).toEqual(['players-jane-player']);
        expect(
          entries[0].workflow.companions?.map(({ collectionName, entry }) => [
            collectionName,
            entry.id,
          ]),
        ).toEqual([['posts', 'posts-news']]);
      });

      test('keeps an entry no collection sharing the folder lets in', async () => {
        vi.mocked(matchesCollectionFilter).mockReturnValue(false);

        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/players/jane-player',
            files: [{ path: 'src/jane-player.md', sha: 'a', size: 1, text: 'a', deleted: false }],
          }),
        );

        expect(entries.map(({ id }) => id)).toEqual(['players-jane-player']);
      });

      test('keeps the entry the branch is named after when an edit took it out of the filter', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/posts/jane-player',
            files: [
              { path: 'src/jane-player.md', sha: 'a', size: 1, text: 'a', deleted: false },
              { path: 'src/bob-player.md', sha: 'b', size: 1, text: 'b', deleted: false },
            ],
          }),
        );

        expect(entries.map(({ id }) => id)).toEqual(['posts-jane-player']);
        expect(
          entries[0].workflow.companions?.map(({ collectionName, entry }) => [
            collectionName,
            entry.id,
          ]),
        ).toEqual([['players', 'players-bob-player']]);
      });

      test('keeps the entries when the filter would hand every one of them over', async () => {
        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/players/jane',
            files: [{ path: 'src/jane-player.md', sha: 'a', size: 1, text: 'a', deleted: false }],
          }),
        );

        expect(entries.map(({ id }) => id)).toEqual(['players-jane-player']);
      });

      test('finds the renamed or deleted entry of the collection named in the branch', async () => {
        allEntries.current = [
          /** @type {any} */ ({
            id: 'published-jane',
            slug: 'jane',
            subPath: 'jane',
            locales: { _default: { slug: 'jane', path: 'src/jane.md', content: {} } },
          }),
        ];

        const { entries } = await convertPullRequest(
          createPullRequest({
            branch: 'cms/players/jane',
            files: [{ path: 'src/jane.md', sha: '', size: 0, deleted: true }],
          }),
        );

        expect(entries.map(({ id, workflow }) => [id, workflow.collectionName])).toEqual([
          ['published-jane', 'players'],
        ]);
        expect(entries[0].workflow.previousPaths).toEqual(['src/jane.md']);
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
