import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAssetFolder } from '$lib/services/assets/folders';
import { findEntriesByAssets } from '$lib/services/assets/references';
import { allAssets } from '$lib/services/assets/state';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { findEntryByPaths } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { getMovedFolders } from '$lib/services/contents/draft/save/asset-move';
import { getEntryRelativeAssets } from '$lib/services/contents/entry/assets';
import { buildTargetChanges } from '$lib/services/contents/entry/cascade';
import { planCascadeDelete } from '$lib/services/contents/entry/relations/cascade/delete';
import { collectRenameTargets } from '$lib/services/contents/entry/relations/cascade/update';
import { unpublishedEntries } from '$lib/services/workflow';
import {
  checkReviewedHead,
  findUnexpectedChanges,
  getWorkflowErrorMessage,
  PUBLISH_REFUSED,
  verifyMergeState,
} from '$lib/services/workflow/verify';

/**
 * Collection folders the mocked file list knows about, by path prefix.
 */
const ENTRY_FOLDERS = {
  'content/posts/': 'posts',
  'content/pages/': 'pages',
  'content/authors/': 'authors',
  'content/tags/': 'tags',
};

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ values: true }),
);
vi.mock('$lib/services/backends/process', () => ({
  /**
   * Classify files the way the real file list does, against a fixed set of folders.
   * @param {{ path: string, name: string }[]} files Files.
   * @returns {any} File list.
   */
  createFileList: (files) => {
    const [{ path, name }] = files;

    const collectionName = Object.entries(ENTRY_FOLDERS).find(([prefix]) =>
      path.startsWith(prefix),
    )?.[1];

    return {
      entryFiles:
        collectionName && !name.startsWith('.') ? [{ path, folder: { collectionName } }] : [],
      assetFiles: !collectionName && path.startsWith('static/') ? [{ path }] : [],
    };
  },
}));
vi.mock('$lib/services/assets/folders', () => ({ getAssetFolder: vi.fn() }));
vi.mock('$lib/services/assets/references', () => ({ findEntriesByAssets: vi.fn() }));
vi.mock('$lib/services/assets/state', () => ({ allAssets: { current: [] } }));
vi.mock('$lib/services/contents', () => ({ findEntryByPaths: vi.fn() }));
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn((name) => ({ name })),
}));
vi.mock('$lib/services/contents/collection/nested/move', () => ({
  buildNestedMoveChanges: vi.fn(async () => ({ changes: [], savingEntries: [] })),
}));
vi.mock('$lib/services/contents/draft/save/asset-move', () => ({
  getMovedFolders: vi.fn(() => new Map()),
}));
vi.mock('$lib/services/contents/entry/assets', () => ({ getEntryRelativeAssets: vi.fn(() => []) }));
vi.mock('$lib/services/contents/entry/cascade', () => ({
  /**
   * Rewrite every file of the given targets, the way the CMS writes them.
   * @param {{ targets: any[] }} args Arguments.
   * @returns {Promise<any>} Changes.
   */
  buildTargetChanges: vi.fn(async ({ targets }) => ({
    changes: targets.flatMap((/** @type {any} */ { entry }) =>
      Object.values(entry.locales).map(({ path }) => ({
        action: 'update',
        path,
        data: `rewritten ${path}`,
      })),
    ),
    savingEntries: [],
  })),
}));
vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn((_collection, name) => ({ name })),
}));
vi.mock('$lib/services/contents/entry/relations/cascade/delete', () => ({
  planCascadeDelete: vi.fn(() => ({ targets: [], blockers: [] })),
}));
vi.mock('$lib/services/contents/entry/relations/cascade/update', () => ({
  collectRenameTargets: vi.fn(() => []),
}));

/**
 * Create a published entry.
 * @param {string} id Entry ID.
 * @param {string[]} paths Locale file paths.
 * @param {string} [subPath] Sub path.
 * @returns {any} Entry.
 */
const createPublishedEntry = (id, paths, subPath = id) => ({
  id,
  slug: id,
  subPath,
  locales: Object.fromEntries(paths.map((path, index) => [`l${index}`, { path }])),
});

/**
 * Create an unpublished entry.
 * @param {object} [args] Arguments.
 * @param {string[]} [args.paths] Locale file paths on the branch.
 * @param {string} [args.subPath] Sub path.
 * @param {string} [args.collectionName] Collection name.
 * @param {string[]} [args.previousPaths] Paths the entry occupied before the pull request.
 * @param {string} [args.headSHA] Head commit on record.
 * @param {string} [args.slug] Slug.
 * @param {string} [args.status] Workflow status.
 * @param {{ path: string, sha?: string, text?: string }[]} [args.files] Files on the branch, as
 * read at the head commit.
 * @returns {any} Entry.
 */
const createEntry = ({
  paths = ['content/posts/hello.md'],
  subPath = 'hello',
  collectionName = 'posts',
  previousPaths = [],
  headSHA = 'abc',
  slug = 'hello',
  status = 'pending_publish',
  files = [],
} = {}) => ({
  ...createPublishedEntry('draft', paths, subPath),
  slug,
  workflow: {
    collectionName,
    previousPaths,
    status,
    pullRequest: { branch: 'cms/x/y', headSHA, files },
  },
});

/**
 * Make {@link findEntryByPaths} find the given published entries.
 * @param {any[]} entries Published entries.
 */
const mockPublishedEntries = (entries) => {
  vi.mocked(findEntryByPaths).mockImplementation((paths) => {
    const set = new Set(paths);

    return entries.find((entry) =>
      Object.values(entry.locales).some(({ path }) => set.has(/** @type {any} */ (path))),
    );
  });
};

/**
 * Make {@link findEntriesByAssets} find the given assets in the entries searched, as if they were
 * used in a media field or a Markdown body.
 * @param {string[]} paths Asset paths.
 */
const mockUsedAssets = (paths) => {
  vi.mocked(findEntriesByAssets).mockImplementation((targets, { entries = [] } = {}) =>
    targets.map(({ asset }) => (paths.includes(/** @type {any} */ (asset).path) ? entries : [])),
  );
};

const mode = '100644';

describe('workflow/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishedEntries([]);
    mockUsedAssets([]);
    vi.mocked(getAssetFolder).mockReturnValue(undefined);
    vi.mocked(getMovedFolders).mockReturnValue(new Map());
    vi.mocked(getEntryRelativeAssets).mockReturnValue([]);
    allAssets.current = [];
  });

  describe('findUnexpectedChanges', () => {
    test('allows the entry’s own files and the assets it uses, and flags anything else', async () => {
      const files = /** @type {any[]} */ ([
        { path: 'content/posts/hello.md', status: 'added', mode },
        { path: 'static/image.png', status: 'added', mode },
        { path: 'static/replaced.png', status: 'modified', mode },
        { path: 'static/moved.png', status: 'renamed', mode, previousPath: 'static/was.png' },
        // Files in a media folder that the entry doesn’t use, which nothing shows the reviewer
        { path: 'static/evil.js', status: 'added', mode },
        { path: 'static/index.html', status: 'added', mode },
        { path: 'static/logo.svg', status: 'modified', mode },
        // An asset is only removed along with an entry that is moved or deleted
        { path: 'static/old.png', status: 'removed' },
        // Code, workflows and configuration aren’t shown anywhere in the CMS
        { path: '.github/workflows/deploy.yml', status: 'added', mode },
        { path: 'src/app.js', status: 'modified', mode },
        // Nor is a Git config file, which the CMS never commits to a workflow branch
        { path: 'content/posts/.gitattributes', status: 'added', mode },
      ]);

      const entry = createEntry();

      mockUsedAssets(['static/image.png', 'static/replaced.png', 'static/moved.png']);

      expect(await findUnexpectedChanges(entry, files)).toEqual([
        'static/was.png',
        'static/evil.js',
        'static/index.html',
        'static/logo.svg',
        'static/old.png',
        '.github/workflows/deploy.yml',
        'src/app.js',
        'content/posts/.gitattributes',
      ]);

      // Looked up in one pass over the entry
      expect(findEntriesByAssets).toHaveBeenCalledOnce();
      expect(findEntriesByAssets).toHaveBeenCalledWith(
        [
          'static/image.png',
          'static/replaced.png',
          'static/moved.png',
          'static/evil.js',
          'static/index.html',
          'static/logo.svg',
        ].map((path) => ({ asset: { path } })),
        { entries: [entry] },
      );
    });

    test('allows the assets used by the new entries listed on the entry’s card', async () => {
      const entry = createEntry();
      const companion = createPublishedEntry('me', ['content/authors/me.md']);

      entry.workflow.companions = [{ collectionName: 'authors', entry: companion }];
      mockUsedAssets(['static/avatar.png']);

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/authors/me.md', status: 'added', mode },
          { path: 'static/avatar.png', status: 'added', mode },
        ]),
      ).toEqual([]);
      expect(findEntriesByAssets).toHaveBeenCalledWith([{ asset: { path: 'static/avatar.png' } }], {
        entries: [entry, companion],
      });
    });

    test('looks no asset up when the pull request adds or changes none', async () => {
      expect(
        await findUnexpectedChanges(createEntry(), [
          { path: 'content/posts/hello.md', status: 'modified', mode },
        ]),
      ).toEqual([]);
      expect(findEntriesByAssets).not.toHaveBeenCalled();
    });

    test('flags any file in the folder the CMS is served from, even as an asset', async () => {
      // With a media folder at the root of the public folder, the admin page and its configuration
      // count as assets. Replacing them would hand the next user’s sign-in to whoever wrote them
      expect(
        await findUnexpectedChanges(createEntry({ status: 'pending_deletion' }), [
          { path: 'static/admin/index.html', status: 'modified', mode },
          { path: 'static/admin/config.yml', status: 'added', mode },
          { path: 'static/CMS/app.js', status: 'added', mode },
          { path: 'static/admin/old.js', status: 'removed' },
        ]),
      ).toEqual([
        'static/admin/index.html',
        'static/admin/config.yml',
        'static/CMS/app.js',
        'static/admin/old.js',
      ]);
    });

    test('flags the admin page or its configuration even when the entry uses them', async () => {
      // A file merely named like the folder is still an asset, and so are other assets in a
      // folder like a Hugo page bundle with the `cms` slug; only the files that would take over
      // the CMS are flagged
      const files = /** @type {any[]} */ ([
        { path: 'static/admin/config.yml', status: 'modified', mode },
        { path: 'static/docs/admin/index.html', status: 'added', mode },
        { path: 'static/docs/cms/config.yml', status: 'modified', mode },
        { path: 'static/admin.png', status: 'added', mode },
        { path: 'static/images/cms', status: 'added', mode },
        { path: 'static/docs/admin/logo.png', status: 'added', mode },
        { path: 'static/posts/cms/cover.jpg', status: 'added', mode },
      ]);

      mockUsedAssets(files.map(({ path }) => path));

      expect(await findUnexpectedChanges(createEntry(), files)).toEqual([
        'static/admin/config.yml',
        'static/docs/admin/index.html',
        'static/docs/cms/config.yml',
      ]);
    });

    test('leaves deployment configuration edited as an entry to the entry rules', async () => {
      // `_redirects` can be an entry of a file collection, edited in the CMS like any other
      expect(
        await findUnexpectedChanges(createEntry({ paths: ['static/_redirects'] }), [
          { path: 'static/_redirects', status: 'modified', mode },
        ]),
      ).toEqual([]);
    });

    test('flags a file that isn’t a regular one, whatever its path', async () => {
      const files = /** @type {any[]} */ ([
        // A symbolic link a site build would follow to a file outside the content, even when it
        // sits where the entry or an asset it uses would
        { path: 'content/posts/hello.md', status: 'modified', mode: '120000' },
        { path: 'static/secrets', status: 'added', mode: '120000' },
        // A submodule, which brings in another repository
        { path: 'static/vendor', status: 'added', mode: '160000' },
        // A file whose mode couldn’t be read
        { path: 'static/unknown.png', status: 'added' },
        // An executable file is still a regular one
        { path: 'static/run.png', status: 'added', mode: '100755' },
      ]);

      mockUsedAssets(files.map(({ path }) => path));

      expect(await findUnexpectedChanges(createEntry(), files)).toEqual([
        'content/posts/hello.md',
        'static/secrets',
        'static/vendor',
        'static/unknown.png',
      ]);
    });

    test('allows the removal of the published version’s files by a rename', async () => {
      const published = createPublishedEntry('hello', ['content/posts/hello.md']);

      mockPublishedEntries([published]);

      const entry = createEntry({
        paths: ['content/posts/hello-world.md'],
        previousPaths: ['content/posts/hello.md'],
      });

      expect(
        await findUnexpectedChanges(entry, [
          {
            path: 'content/posts/hello-world.md',
            status: 'renamed',
            mode,
            previousPath: 'content/posts/hello.md',
          },
        ]),
      ).toEqual([]);

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/posts/hello-world.md', status: 'added', mode },
          { path: 'content/posts/hello.md', status: 'removed' },
        ]),
      ).toEqual([]);
    });

    test('allows the removal of the assets stored with an entry being deleted', async () => {
      const published = createPublishedEntry('hello', ['content/posts/hello.md']);

      mockPublishedEntries([published]);
      mockUsedAssets(['static/hello/cover.png']);
      vi.mocked(getEntryRelativeAssets).mockReturnValue(
        /** @type {any} */ ([{ path: 'static/hello/cover.png' }]),
      );

      expect(
        await findUnexpectedChanges(createEntry({ status: 'pending_deletion' }), [
          { path: 'content/posts/hello.md', status: 'removed' },
          { path: 'static/hello/cover.png', status: 'removed' },
          // No other asset, nor anything a removal would add or change
          { path: 'static/other.png', status: 'removed' },
          { path: 'static/hello/new.png', status: 'added', mode },
          { path: 'static/hello/cover.png', status: 'modified', mode },
        ]),
      ).toEqual(['static/other.png', 'static/hello/new.png', 'static/hello/cover.png']);

      expect(getEntryRelativeAssets).toHaveBeenCalledWith({
        entry: published,
        collectionName: 'posts',
        fileName: undefined,
      });
      expect(findEntriesByAssets).not.toHaveBeenCalled();
    });

    test('allows the assets stored with a moved entry to move along, as they are', async () => {
      const published = createPublishedEntry('hello', ['content/posts/hello/index.md']);

      mockPublishedEntries([published]);
      vi.mocked(getAssetFolder).mockReturnValue(/** @type {any} */ ({ entryRelative: true }));
      vi.mocked(getMovedFolders).mockReturnValue(new Map([['static/hello', 'static/hello-world']]));
      allAssets.current = /** @type {any[]} */ ([
        { path: 'static/hello/cover.png', sha: 'cover' },
        { path: 'static/hello/sub/photo.png', sha: 'photo' },
        { path: 'static/other.png', sha: 'other' },
      ]);

      const entry = createEntry({
        slug: 'hello-world',
        subPath: 'hello-world/index',
        paths: ['content/posts/hello-world/index.md'],
        previousPaths: ['content/posts/hello/index.md'],
        files: [
          { path: 'static/hello-world/cover.png', sha: 'cover' },
          // Replaced on the way
          { path: 'static/hello-world/sub/photo.png', sha: 'tampered' },
          { path: 'static/hello-world/extra.png', sha: 'other' },
        ],
      });

      expect(
        await findUnexpectedChanges(entry, [
          {
            path: 'content/posts/hello-world/index.md',
            status: 'renamed',
            mode,
            previousPath: 'content/posts/hello/index.md',
          },
          {
            path: 'static/hello-world/cover.png',
            status: 'renamed',
            mode,
            previousPath: 'static/hello/cover.png',
          },
          { path: 'static/hello/sub/photo.png', status: 'removed' },
          { path: 'static/hello-world/sub/photo.png', status: 'added', mode },
          // Nothing outside the entry’s folder moves with it
          { path: 'static/other.png', status: 'removed' },
          { path: 'static/hello-world/extra.png', status: 'added', mode },
        ]),
      ).toEqual([
        'static/hello-world/sub/photo.png',
        'static/other.png',
        'static/hello-world/extra.png',
      ]);

      expect(getMovedFolders).toHaveBeenCalledWith({
        collection: { name: 'posts' },
        originalEntry: published,
        savingEntry: entry,
      });
    });

    test('moves no asset along in a collection that doesn’t store them with the entries', async () => {
      mockPublishedEntries([createPublishedEntry('hello', ['content/posts/hello.md'])]);
      vi.mocked(getMovedFolders).mockReturnValue(new Map([['static/hello', 'static/hello-world']]));
      allAssets.current = /** @type {any[]} */ ([{ path: 'static/hello/cover.png', sha: 'cover' }]);

      const entry = createEntry({
        slug: 'hello-world',
        subPath: 'hello-world',
        paths: ['content/posts/hello-world.md'],
        previousPaths: ['content/posts/hello.md'],
        files: [{ path: 'static/hello-world/cover.png', sha: 'cover' }],
      });

      expect(
        await findUnexpectedChanges(entry, [
          {
            path: 'static/hello-world/cover.png',
            status: 'renamed',
            mode,
            previousPath: 'static/hello/cover.png',
          },
        ]),
      ).toEqual(['static/hello/cover.png', 'static/hello-world/cover.png']);
      expect(getMovedFolders).not.toHaveBeenCalled();
    });

    test('flags the deletion of another entry passed off as a rename', async () => {
      // The pull request edits one entry and deletes another of the same collection. The board
      // reports the deleted file as the edited entry’s previous path, but the edited entry still
      // sits at its own path, so the deletion isn’t a rename of it
      const hello = createPublishedEntry('hello', ['content/posts/hello.md']);
      const other = createPublishedEntry('other', ['content/posts/other.md']);

      mockPublishedEntries([other, hello]);

      const entry = createEntry({ previousPaths: ['content/posts/other.md'] });

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/posts/hello.md', status: 'modified', mode },
          { path: 'content/posts/other.md', status: 'removed' },
        ]),
      ).toEqual(['content/posts/other.md']);
    });

    test('allows the files of an entry being deleted', async () => {
      const entry = createEntry({ paths: ['content/posts/hello.md', 'content/posts/ja/hello.md'] });

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/posts/hello.md', status: 'removed' },
          { path: 'content/posts/ja/hello.md', status: 'removed' },
        ]),
      ).toEqual([]);
    });

    test('allows the rewrite of the entries referencing an entry being deleted', async () => {
      const home = createPublishedEntry('home', ['content/pages/home.md']);
      const team = createPublishedEntry('team', ['content/pages/team.md']);

      const entry = createEntry({
        status: 'pending_deletion',
        files: [
          { path: 'content/pages/home.md', text: 'rewritten content/pages/home.md' },
          // An unrelated edit made along with the rewrite, which nothing shows the reviewer
          { path: 'content/pages/team.md', text: 'rewritten content/pages/team.md\nedited' },
        ],
      });

      // Another entry of the collection deleted in the same selection, and one of another
      const sibling = {
        ...createEntry({ status: 'pending_deletion', paths: ['content/posts/b.md'] }),
        id: 'sibling',
      };

      const other = createEntry({ status: 'pending_deletion', collectionName: 'authors' });
      const pending = createEntry({ paths: ['content/posts/c.md'] });

      unpublishedEntries.current = [entry, sibling, other, pending];
      vi.mocked(planCascadeDelete).mockReturnValueOnce(
        /** @type {any} */ ({ targets: [{ entry: home }, { entry: team }], blockers: [] }),
      );

      expect(
        await findUnexpectedChanges(entry, [
          // A Relation reference rewritten by the deletion
          { path: 'content/pages/home.md', status: 'modified', mode },
          { path: 'content/pages/team.md', status: 'modified', mode },
          // But no other entry, even in a collection that can refer to posts
          { path: 'content/pages/about.md', status: 'modified', mode },
          { path: 'content/posts/other.md', status: 'modified', mode },
        ]),
      ).toEqual(['content/pages/team.md', 'content/pages/about.md', 'content/posts/other.md']);

      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection: { name: 'posts' },
        collectionFile: undefined,
        entries: [entry, sibling],
      });
      expect(buildTargetChanges).toHaveBeenCalledWith({
        targets: [{ entry: home }, { entry: team }],
      });
      expect(collectRenameTargets).not.toHaveBeenCalled();
      unpublishedEntries.current = [];
    });

    test('allows the rewrite of the entries referencing a renamed entry, as written', async () => {
      const published = createPublishedEntry('hello', ['content/posts/hello.md']);

      const home = createPublishedEntry('home', [
        'content/pages/home.md',
        'content/pages/ja/home.md',
      ]);

      mockPublishedEntries([published]);
      vi.mocked(collectRenameTargets).mockReturnValue(/** @type {any} */ ([{ entry: home }]));

      /**
       * Create the renamed entry with the given files on its branch.
       * @param {{ path: string, text?: string }[]} files Files.
       * @returns {any} Entry.
       */
      const createRenamedEntry = (files) =>
        createEntry({
          slug: 'hello-world',
          subPath: 'hello-world',
          paths: ['content/posts/hello-world.md'],
          previousPaths: ['content/posts/hello.md'],
          files,
        });

      const changes = /** @type {any[]} */ ([
        { path: 'content/pages/home.md', status: 'modified', mode },
        { path: 'content/pages/ja/home.md', status: 'modified', mode },
        { path: 'content/pages/about.md', status: 'modified', mode },
      ]);

      const entry = createRenamedEntry([
        { path: 'content/pages/home.md', text: 'rewritten content/pages/home.md' },
        { path: 'content/pages/ja/home.md', text: 'rewritten content/pages/ja/home.md' },
      ]);

      expect(await findUnexpectedChanges(entry, changes)).toEqual(['content/pages/about.md']);

      expect(collectRenameTargets).toHaveBeenCalledWith({
        collection: { name: 'posts' },
        collectionFile: undefined,
        originalEntry: published,
        savingEntry: entry,
      });

      // A file carrying more than the rewrite, or that couldn’t be read, isn’t the CMS’s
      expect(
        await findUnexpectedChanges(
          createRenamedEntry([
            { path: 'content/pages/home.md', text: 'rewritten content/pages/home.md\nedited' },
            { path: 'content/pages/ja/home.md' },
          ]),
          changes,
        ),
      ).toEqual(['content/pages/home.md', 'content/pages/ja/home.md', 'content/pages/about.md']);

      // Nor is a rewritten file removed or added rather than modified
      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/pages/home.md', status: 'removed' },
          { path: 'content/pages/ja/home.md', status: 'added', mode },
        ]),
      ).toEqual(['content/pages/home.md']);

      vi.mocked(collectRenameTargets).mockReturnValue([]);
    });

    test('looks the referencing entries up with the collection file', async () => {
      const entry = createEntry({ status: 'pending_deletion' });

      entry.workflow.fileName = 'about';

      await findUnexpectedChanges(entry, []);

      expect(planCascadeDelete).toHaveBeenCalledWith(
        expect.objectContaining({ collectionFile: { name: 'about' } }),
      );
    });

    test('rewrites no reference for a collection that is no longer configured', async () => {
      vi.mocked(getCollection).mockReturnValueOnce(undefined);
      vi.mocked(collectRenameTargets).mockReturnValueOnce(
        /** @type {any} */ ([{ entry: createPublishedEntry('home', ['content/pages/home.md']) }]),
      );

      expect(
        await findUnexpectedChanges(createEntry(), [
          { path: 'content/pages/home.md', status: 'modified', mode },
        ]),
      ).toEqual(['content/pages/home.md']);
      expect(collectRenameTargets).not.toHaveBeenCalled();
      expect(buildTargetChanges).not.toHaveBeenCalled();
    });

    test('flags a new entry in another collection the board doesn’t show', async () => {
      expect(
        await findUnexpectedChanges(createEntry(), [
          { path: 'content/authors/me.md', status: 'added', mode },
        ]),
      ).toEqual(['content/authors/me.md']);
    });

    test('allows the new entries listed on the entry’s card, as long as they’re new', async () => {
      // They were created from a Relation field of the entry and committed along with it
      // @see https://github.com/sveltia/sveltia-cms/issues/1112
      const entry = createEntry();

      entry.workflow.companions = [
        {
          collectionName: 'authors',
          entry: createPublishedEntry('me', ['content/authors/me.md', 'content/authors/ja/me.md']),
        },
      ];

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/authors/me.md', status: 'added', mode },
          { path: 'content/authors/ja/me.md', status: 'added', mode },
        ]),
      ).toEqual([]);

      // One that has appeared on the configured branch since would be overwritten
      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/authors/me.md', status: 'modified', mode },
          { path: 'content/authors/ja/me.md', status: 'removed' },
        ]),
      ).toEqual(['content/authors/me.md', 'content/authors/ja/me.md']);
    });

    test('allows a nested entry to move the entries below its folder, as moved', async () => {
      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.md'],
        'about/index',
      );

      mockPublishedEntries([published]);
      vi.mocked(buildNestedMoveChanges).mockResolvedValue(
        /** @type {any} */ ({
          changes: [
            {
              action: 'move',
              path: 'content/pages/company/team/index.md',
              previousPath: 'content/pages/about/team/index.md',
              data: 'team',
            },
            // A descendant whose canonical slug is rewritten in place
            { action: 'update', path: 'content/pages/about/history/index.md', data: 'history' },
          ],
          savingEntries: [],
        }),
      );

      /**
       * Create the moved entry with the given files on its branch.
       * @param {{ path: string, text?: string }[]} files Files.
       * @returns {any} Entry.
       */
      const createMovedEntry = (files) =>
        createEntry({
          collectionName: 'pages',
          paths: ['content/pages/company/index.md'],
          subPath: 'company/index',
          previousPaths: ['content/pages/about/index.md'],
          files,
        });

      const changes = /** @type {any[]} */ ([
        {
          path: 'content/pages/company/index.md',
          status: 'renamed',
          mode,
          previousPath: 'content/pages/about/index.md',
        },
        {
          path: 'content/pages/company/team/index.md',
          status: 'renamed',
          mode,
          previousPath: 'content/pages/about/team/index.md',
        },
        { path: 'content/pages/about/history/index.md', status: 'modified', mode },
        // An entry outside the folder isn’t moved
        { path: 'content/pages/contact/index.md', status: 'removed' },
        { path: 'content/pages/elsewhere/index.md', status: 'added', mode },
        // Nor does a new entry appear below the folder the entry moves to
        { path: 'content/pages/company/x/index.md', status: 'added', mode },
      ]);

      const entry = createMovedEntry([
        { path: 'content/pages/company/team/index.md', text: 'team' },
        { path: 'content/pages/about/history/index.md', text: 'history' },
        { path: 'content/pages/company/x/index.md', text: 'x' },
      ]);

      expect(await findUnexpectedChanges(entry, changes)).toEqual([
        'content/pages/contact/index.md',
        'content/pages/elsewhere/index.md',
        'content/pages/company/x/index.md',
      ]);

      expect(buildNestedMoveChanges).toHaveBeenCalledWith({
        collection: { name: 'pages' },
        originalEntry: published,
        savingEntry: entry,
      });

      // A descendant edited on the way isn’t moved as the CMS moves it
      expect(
        await findUnexpectedChanges(
          createMovedEntry([
            { path: 'content/pages/company/team/index.md', text: 'team\nedited' },
            { path: 'content/pages/about/history/index.md', text: 'history' },
          ]),
          changes.slice(0, 3),
        ),
      ).toEqual(['content/pages/company/team/index.md']);

      vi.mocked(buildNestedMoveChanges).mockResolvedValue(
        /** @type {any} */ ({ changes: [], savingEntries: [] }),
      );
    });

    test('tells the moved entry from its descendants after a reload', async () => {
      const team = createPublishedEntry(
        'team',
        ['content/pages/about/team/index.md'],
        'about/team/index',
      );

      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.md'],
        'about/index',
      );

      const history = createPublishedEntry(
        'history',
        ['content/pages/about/history/index.md'],
        'about/history/index',
      );

      // A descendant comes first in the store
      mockPublishedEntries([team, published, history]);
      vi.mocked(buildNestedMoveChanges).mockResolvedValueOnce(
        /** @type {any} */ ({
          changes: ['team', 'history'].map((name) => ({
            action: 'move',
            path: `content/pages/company/${name}/index.md`,
            previousPath: `content/pages/about/${name}/index.md`,
            data: name,
          })),
          savingEntries: [],
        }),
      );

      // Read back from the pull request, every path the move vacated counts as a previous one
      const entry = createEntry({
        collectionName: 'pages',
        paths: ['content/pages/company/index.md'],
        subPath: 'company/index',
        previousPaths: [
          'content/pages/about/team/index.md',
          'content/pages/about/index.md',
          'content/pages/about/history/index.md',
        ],
        files: [
          { path: 'content/pages/company/team/index.md', text: 'team' },
          { path: 'content/pages/company/history/index.md', text: 'history' },
        ],
      });

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/pages/company/index.md', status: 'added', mode },
          { path: 'content/pages/about/index.md', status: 'removed' },
          { path: 'content/pages/company/team/index.md', status: 'added', mode },
          { path: 'content/pages/about/team/index.md', status: 'removed' },
          { path: 'content/pages/company/history/index.md', status: 'added', mode },
          { path: 'content/pages/about/history/index.md', status: 'removed' },
        ]),
      ).toEqual([]);

      expect(buildNestedMoveChanges).toHaveBeenCalledWith(
        expect.objectContaining({ originalEntry: published }),
      );
    });

    test('moves nothing along in a collection that is no longer configured', async () => {
      vi.mocked(getCollection).mockReturnValue(undefined);
      mockPublishedEntries([
        createPublishedEntry('about', ['content/pages/about/index.md'], 'about/index'),
      ]);

      const entry = createEntry({
        collectionName: 'gone',
        paths: ['content/pages/company/index.md'],
        subPath: 'company/index',
        previousPaths: ['content/pages/about/index.md'],
      });

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/pages/about/team/index.md', status: 'removed' },
          { path: 'content/pages/company/x/index.md', status: 'added', mode },
          { path: 'static/about/cover.png', status: 'removed' },
        ]),
      ).toEqual([
        'content/pages/about/team/index.md',
        'content/pages/company/x/index.md',
        'static/about/cover.png',
      ]);
      expect(buildNestedMoveChanges).not.toHaveBeenCalled();
      expect(getMovedFolders).not.toHaveBeenCalled();
      vi.mocked(getCollection).mockImplementation((name) => /** @type {any} */ ({ name }));
    });

    test('moves nothing along with an entry that only drops a locale’s file', async () => {
      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.en.md', 'content/pages/about/index.fr.md'],
        'about/index',
      );

      mockPublishedEntries([published]);

      const entry = createEntry({
        collectionName: 'pages',
        paths: ['content/pages/about/index.en.md'],
        subPath: 'about/index',
      });

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/pages/about/index.fr.md', status: 'removed' },
          { path: 'content/pages/about/team/index.en.md', status: 'removed' },
          { path: 'static/logo.png', status: 'removed' },
        ]),
      ).toEqual(['content/pages/about/team/index.en.md', 'static/logo.png']);
      expect(buildNestedMoveChanges).not.toHaveBeenCalled();
    });

    test.each([
      ['edited in place', 'pending_publish'],
      ['being deleted', 'pending_deletion'],
    ])('moves nothing along with a nested entry %s', async (_label, status) => {
      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.md'],
        'about/index',
      );

      mockPublishedEntries([published]);

      // Deleting a page leaves the pages below it alone, as does editing it, so a pull request
      // that removes or rewrites one of them is doing something the CMS hasn’t shown
      const entry = createEntry({
        collectionName: 'pages',
        paths: ['content/pages/about/index.md'],
        subPath: 'about/index',
        status,
      });

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/pages/about/index.md', status: 'modified', mode },
          { path: 'content/pages/about/team/index.md', status: 'removed' },
          { path: 'content/pages/about/team/index.md', status: 'modified', mode },
          { path: 'content/pages/about/x/index.md', status: 'added', mode },
        ]),
      ).toEqual(['content/pages/about/team/index.md', 'content/pages/about/x/index.md']);
      expect(buildNestedMoveChanges).not.toHaveBeenCalled();
    });

    test('reports each path once, and copes with a rename without a previous path', async () => {
      expect(
        await findUnexpectedChanges(createEntry(), [
          { path: 'src/app.js', status: 'renamed', mode },
          { path: 'src/app.js', status: 'modified', mode },
        ]),
      ).toEqual(['src/app.js']);
    });

    test('copes with an entry without previous paths on record', async () => {
      const entry = createEntry();

      delete entry.workflow.previousPaths;

      expect(
        await findUnexpectedChanges(entry, [
          { path: 'content/posts/hello.md', status: 'modified', mode },
        ]),
      ).toEqual([]);
    });
  });

  describe('verifyMergeState', () => {
    const state = /** @type {any} */ ({
      headSHA: 'abc',
      onConfiguredBranches: true,
      files: [{ path: 'content/posts/hello.md', status: 'modified', mode: '100644' }],
      complete: true,
    });

    /** Function to find the files the merge leaves as they are; none by default. */
    const fetchUnchangedPaths = vi.fn(async () => /** @type {string[]} */ ([]));

    /**
     * Get the error the check throws, if any.
     * @param {any} entry Entry.
     * @param {any} mergeState Merge state.
     * @returns {Promise<any>} Error.
     */
    const getError = async (entry, mergeState) => {
      try {
        await verifyMergeState(entry, mergeState, fetchUnchangedPaths);
      } catch (ex) {
        return ex;
      }

      return undefined;
    };

    test('lets a pull request that holds the entry alone through', async () => {
      expect(await getError(createEntry(), state)).toBeUndefined();
      // Nothing to look up when every file is accounted for
      expect(fetchUnchangedPaths).not.toHaveBeenCalled();
    });

    test.each([
      ['goes somewhere other than the configured branch', { onConfiguredBranches: false }],
      ['has too many files to check', { complete: false }],
    ])('refuses a pull request that %s', async (_label, overrides) => {
      const error = await getError(createEntry(), { ...state, ...overrides });

      expect(error.message).toBe(PUBLISH_REFUSED);
      expect(error.cause).toEqual({ reason: 'other_changes', paths: [] });
    });

    test('refuses a pull request whose branch has moved on since the entry was loaded', async () => {
      const error = await getError(createEntry(), { ...state, headSHA: 'def' });

      expect(error.message).toBe(PUBLISH_REFUSED);
      expect(error.cause).toEqual({ reason: 'entry_changed', paths: [] });
    });

    test('refuses an entry with no head on record to compare', async () => {
      const error = await getError(createEntry({ headSHA: '' }), state);

      expect(error.cause).toEqual({ reason: 'entry_changed', paths: [] });
    });

    test('refuses a pull request with changes the CMS doesn’t show, naming them', async () => {
      const error = await getError(createEntry(), {
        ...state,
        files: [...state.files, { path: 'src/app.js', status: 'modified', mode: '100644' }],
      });

      expect(error.cause).toEqual({ reason: 'other_changes', paths: ['src/app.js'] });
      expect(fetchUnchangedPaths).toHaveBeenCalledWith({ headSHA: 'abc', paths: ['src/app.js'] });
    });

    test('lets through a change the configured branch already has', async () => {
      // The reference rewrite every pull request of a selection deleted at once carries, once the
      // first of them has been published: the merge leaves the file as it is
      fetchUnchangedPaths.mockResolvedValueOnce(['content/pages/home.md']);

      const error = await getError(createEntry(), {
        ...state,
        files: [
          ...state.files,
          { path: 'content/pages/home.md', status: 'modified', mode: '100644' },
          { path: 'src/app.js', status: 'modified', mode: '100644' },
        ],
      });

      expect(error.cause).toEqual({ reason: 'other_changes', paths: ['src/app.js'] });

      fetchUnchangedPaths.mockResolvedValueOnce(['content/pages/home.md']);

      expect(
        await getError(createEntry(), {
          ...state,
          files: [
            ...state.files,
            { path: 'content/pages/home.md', status: 'modified', mode: '100644' },
          ],
        }),
      ).toBeUndefined();
    });
  });

  describe('checkReviewedHead', () => {
    const entry = /** @type {any} */ ({
      id: 'hello',
      workflow: {
        status: 'pending_publish',
        pullRequest: { branch: 'cms/posts/hello', headSHA: 'new' },
      },
    });

    test('lets the reviewed version through', () => {
      expect(() => checkReviewedHead(entry, 'new')).not.toThrow();
    });

    test.each([
      ['a reload has moved the entry on since it was reviewed', 'old'],
      ['the user hasn’t seen any version of the entry', undefined],
    ])('refuses the publish when %s', (_label, headSHA) => {
      try {
        checkReviewedHead(entry, headSHA);
        expect.unreachable();
      } catch (/** @type {any} */ ex) {
        expect(ex.message).toBe(PUBLISH_REFUSED);
        expect(ex.cause).toEqual({ reason: 'entry_changed', paths: [] });
      }
    });
  });

  describe('getWorkflowErrorMessage', () => {
    test('shows what a localized error says', () => {
      expect(
        getWorkflowErrorMessage(
          createLocalizedError('The workflow branch is in use.', 'workflow.branch_in_use', {
            number: '!3',
          }),
          'fallback',
        ),
      ).toBe('workflow.branch_in_use:{"number":"!3"}');
    });

    test('says why a publish was refused', () => {
      expect(
        getWorkflowErrorMessage(
          new Error(PUBLISH_REFUSED, { cause: { reason: 'entry_changed', paths: [] } }),
          'fallback',
        ),
      ).toBe('workflow.publish_refused_entry_changed');

      expect(
        getWorkflowErrorMessage(
          new Error(PUBLISH_REFUSED, { cause: { reason: 'other_changes', paths: ['a'] } }),
          'fallback',
        ),
      ).toBe('workflow.publish_refused_other_changes');
    });

    test('falls back for any other failure', () => {
      expect(getWorkflowErrorMessage(new Error('Merge failed'), 'fallback')).toBe('fallback');
      expect(getWorkflowErrorMessage(undefined, 'fallback')).toBe('fallback');
    });

    test('doesn’t show an API error’s own message', () => {
      expect(
        getWorkflowErrorMessage(
          new Error('Server responded with an error', {
            cause: { status: 409, message: 'Another open merge request already exists' },
          }),
          'fallback',
        ),
      ).toBe('fallback');

      expect(
        getWorkflowErrorMessage(
          new Error('Failed to send the request', { cause: new TypeError('Failed to fetch') }),
          'fallback',
        ),
      ).toBe('fallback');
    });
  });
});
