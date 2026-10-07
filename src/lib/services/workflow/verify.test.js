import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { findEntryByPaths } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getNestedConfig } from '$lib/services/contents/collection/nested';
import { planCascadeDelete } from '$lib/services/contents/entry/relations/cascade/delete';
import { collectRenameTargets } from '$lib/services/contents/entry/relations/cascade/update';
import { unpublishedEntries } from '$lib/services/workflow';
import {
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

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, options) => `${key}${options ? `:${JSON.stringify(options.values)}` : ''}`),
}));
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
vi.mock('$lib/services/contents', () => ({ findEntryByPaths: vi.fn() }));
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn((name) => ({ name })),
}));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/collection/nested', async (importOriginal) => ({
  ...(await importOriginal()),
  getNestedConfig: vi.fn(),
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
vi.mock('$lib/services/workflow', () => ({ unpublishedEntries: { current: [] } }));

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
} = {}) => ({
  ...createPublishedEntry('draft', paths, subPath),
  slug,
  workflow: { collectionName, previousPaths, status, pullRequest: { branch: 'cms/x/y', headSHA } },
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

describe('workflow/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishedEntries([]);
  });

  describe('findUnexpectedChanges', () => {
    test('allows the entry’s own files and assets, and flags anything else', () => {
      const files = /** @type {any[]} */ ([
        { path: 'content/posts/hello.md', status: 'added', mode: '100644' },
        { path: 'static/image.png', status: 'added', mode: '100644' },
        { path: 'static/replaced.png', status: 'modified', mode: '100644' },
        {
          path: 'static/moved.png',
          status: 'renamed',
          mode: '100644',
          previousPath: 'static/was.png',
        },
        // An asset is only removed along with an entry that is moved or deleted
        { path: 'static/old.png', status: 'removed' },
        // Code, workflows and configuration aren’t shown anywhere in the CMS
        { path: '.github/workflows/deploy.yml', status: 'added', mode: '100644' },
        { path: 'src/app.js', status: 'modified', mode: '100644' },
        // Nor is a Git config file, which the CMS never commits to a workflow branch
        { path: 'content/posts/.gitattributes', status: 'added', mode: '100644' },
      ]);

      expect(findUnexpectedChanges(createEntry(), files)).toEqual([
        'static/was.png',
        'static/old.png',
        '.github/workflows/deploy.yml',
        'src/app.js',
        'content/posts/.gitattributes',
      ]);
    });

    test('flags any file in the folder the CMS is served from, even as an asset', () => {
      // With a media folder at the root of the public folder, the admin page and its configuration
      // count as assets. Replacing them would hand the next user’s sign-in to whoever wrote them
      expect(
        findUnexpectedChanges(createEntry({ status: 'pending_deletion' }), [
          { path: 'static/admin/index.html', status: 'modified', mode: '100644' },
          { path: 'static/admin/config.yml', status: 'added', mode: '100644' },
          { path: 'static/CMS/app.js', status: 'added', mode: '100644' },
          { path: 'static/admin/old.js', status: 'removed' },
          // A file merely named like the folder is still an asset
          { path: 'static/admin.png', status: 'added', mode: '100644' },
          { path: 'static/images/cms', status: 'added', mode: '100644' },
        ]),
      ).toEqual([
        'static/admin/index.html',
        'static/admin/config.yml',
        'static/CMS/app.js',
        'static/admin/old.js',
      ]);
    });

    test('leaves deployment configuration edited as an entry to the entry rules', () => {
      // `_redirects` can be an entry of a file collection, edited in the CMS like any other
      expect(
        findUnexpectedChanges(createEntry({ paths: ['static/_redirects'] }), [
          { path: 'static/_redirects', status: 'modified', mode: '100644' },
        ]),
      ).toEqual([]);
    });

    test('flags a file that isn’t a regular one, whatever its path', () => {
      expect(
        findUnexpectedChanges(createEntry(), [
          // A symbolic link a site build would follow to a file outside the content, even when it
          // sits where the entry or an asset would
          { path: 'content/posts/hello.md', status: 'modified', mode: '120000' },
          { path: 'static/secrets', status: 'added', mode: '120000' },
          // A submodule, which brings in another repository
          { path: 'static/vendor', status: 'added', mode: '160000' },
          // A file whose mode couldn’t be read
          { path: 'static/unknown.png', status: 'added' },
          // An executable file is still a regular one
          { path: 'static/run.png', status: 'added', mode: '100755' },
        ]),
      ).toEqual([
        'content/posts/hello.md',
        'static/secrets',
        'static/vendor',
        'static/unknown.png',
      ]);
    });

    test('allows the removal of the published version’s files by a rename', () => {
      const published = createPublishedEntry('hello', ['content/posts/hello.md']);

      mockPublishedEntries([published]);

      const entry = createEntry({
        paths: ['content/posts/hello-world.md'],
        previousPaths: ['content/posts/hello.md'],
      });

      expect(
        findUnexpectedChanges(entry, [
          {
            path: 'content/posts/hello-world.md',
            status: 'renamed',
            mode: '100644',
            previousPath: 'content/posts/hello.md',
          },
        ]),
      ).toEqual([]);

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/posts/hello-world.md', status: 'added', mode: '100644' },
          { path: 'content/posts/hello.md', status: 'removed' },
        ]),
      ).toEqual([]);
    });

    test('allows the removal of assets along with an entry that is moved or deleted', () => {
      const files = /** @type {any[]} */ ([
        { path: 'content/posts/hello.md', status: 'removed' },
        { path: 'static/hello.png', status: 'removed' },
      ]);

      expect(findUnexpectedChanges(createEntry({ status: 'pending_deletion' }), files)).toEqual([]);

      mockPublishedEntries([createPublishedEntry('hello', ['content/posts/hello.md'])]);

      expect(
        findUnexpectedChanges(
          createEntry({
            slug: 'hello-world',
            subPath: 'hello-world',
            paths: ['content/posts/hello-world.md'],
            previousPaths: ['content/posts/hello.md'],
          }),
          [...files, { path: 'content/posts/hello-world.md', status: 'added', mode: '100644' }],
        ),
      ).toEqual([]);
    });

    test('flags the deletion of another entry passed off as a rename', () => {
      // The pull request edits one entry and deletes another of the same collection. The board
      // reports the deleted file as the edited entry’s previous path, but the edited entry still
      // sits at its own path, so the deletion isn’t a rename of it
      const hello = createPublishedEntry('hello', ['content/posts/hello.md']);
      const other = createPublishedEntry('other', ['content/posts/other.md']);

      mockPublishedEntries([other, hello]);

      const entry = createEntry({ previousPaths: ['content/posts/other.md'] });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/posts/hello.md', status: 'modified', mode: '100644' },
          { path: 'content/posts/other.md', status: 'removed' },
        ]),
      ).toEqual(['content/posts/other.md']);
    });

    test('allows the files of an entry being deleted', () => {
      const entry = createEntry({ paths: ['content/posts/hello.md', 'content/posts/ja/hello.md'] });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/posts/hello.md', status: 'removed' },
          { path: 'content/posts/ja/hello.md', status: 'removed' },
        ]),
      ).toEqual([]);
    });

    test('allows the rewrite of the entries referencing an entry being deleted', () => {
      const home = createPublishedEntry('home', ['content/pages/home.md']);
      const entry = createEntry({ status: 'pending_deletion' });
      // Another entry of the collection deleted in the same selection, and one of another
      const sibling = createEntry({ status: 'pending_deletion', paths: ['content/posts/b.md'] });
      const other = createEntry({ status: 'pending_deletion', collectionName: 'authors' });
      const pending = createEntry({ paths: ['content/posts/c.md'] });

      unpublishedEntries.current = [entry, sibling, other, pending];
      vi.mocked(planCascadeDelete).mockReturnValueOnce(
        /** @type {any} */ ({ targets: [{ entry: home }], blockers: [] }),
      );

      expect(
        findUnexpectedChanges(entry, [
          // A Relation reference rewritten by the deletion
          { path: 'content/pages/home.md', status: 'modified', mode: '100644' },
          // But no other entry, even in a collection that can refer to posts
          { path: 'content/pages/about.md', status: 'modified', mode: '100644' },
          { path: 'content/posts/other.md', status: 'modified', mode: '100644' },
        ]),
      ).toEqual(['content/pages/about.md', 'content/posts/other.md']);

      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection: { name: 'posts' },
        collectionFile: undefined,
        entries: [entry, sibling],
      });
      expect(collectRenameTargets).not.toHaveBeenCalled();
      unpublishedEntries.current = [];
    });

    test('allows the rewrite of the entries referencing a renamed entry', () => {
      const published = createPublishedEntry('hello', ['content/posts/hello.md']);
      const home = createPublishedEntry('home', ['content/pages/home.md']);

      mockPublishedEntries([published]);
      vi.mocked(collectRenameTargets).mockReturnValueOnce(/** @type {any} */ ([{ entry: home }]));

      const entry = createEntry({
        slug: 'hello-world',
        subPath: 'hello-world',
        paths: ['content/posts/hello-world.md'],
        previousPaths: ['content/posts/hello.md'],
      });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/pages/home.md', status: 'modified', mode: '100644' },
          { path: 'content/pages/about.md', status: 'modified', mode: '100644' },
        ]),
      ).toEqual(['content/pages/about.md']);

      expect(collectRenameTargets).toHaveBeenCalledWith({
        collection: { name: 'posts' },
        collectionFile: undefined,
        originalEntry: published,
        savingEntry: entry,
      });
    });

    test('looks the referencing entries up with the collection file', () => {
      const entry = createEntry({ status: 'pending_deletion' });

      entry.workflow.fileName = 'about';

      findUnexpectedChanges(entry, []);

      expect(planCascadeDelete).toHaveBeenCalledWith(
        expect.objectContaining({ collectionFile: { name: 'about' } }),
      );
    });

    test('rewrites no reference for a collection that is no longer configured', () => {
      vi.mocked(getCollection).mockReturnValueOnce(undefined);
      vi.mocked(collectRenameTargets).mockReturnValueOnce(
        /** @type {any} */ ([{ entry: createPublishedEntry('home', ['content/pages/home.md']) }]),
      );

      expect(
        findUnexpectedChanges(createEntry(), [
          { path: 'content/pages/home.md', status: 'modified', mode: '100644' },
        ]),
      ).toEqual(['content/pages/home.md']);
      expect(collectRenameTargets).not.toHaveBeenCalled();
    });

    test('flags a new entry in another collection', () => {
      // A Relation field doesn’t offer to add an entry while an entry is saved through Editorial
      // Workflow, so the CMS never commits one along with it
      expect(
        findUnexpectedChanges(createEntry(), [
          { path: 'content/authors/me.md', status: 'added', mode: '100644' },
        ]),
      ).toEqual(['content/authors/me.md']);
    });

    test('allows a nested entry to move the entries below its folder along with it', () => {
      vi.mocked(getNestedConfig).mockReturnValue(/** @type {any} */ ({ subfolders: true }));

      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.md'],
        'about/index',
      );

      const team = createPublishedEntry(
        'team',
        ['content/pages/about/team/index.md'],
        'about/team/index',
      );

      const contact = createPublishedEntry(
        'contact',
        ['content/pages/contact/index.md'],
        'contact/index',
      );

      mockPublishedEntries([published]);
      vi.mocked(getEntriesByCollection).mockReturnValue([published, team, contact]);

      const entry = createEntry({
        collectionName: 'pages',
        paths: ['content/pages/company/index.md'],
        subPath: 'company/index',
        previousPaths: ['content/pages/about/index.md'],
      });

      expect(
        findUnexpectedChanges(entry, [
          {
            path: 'content/pages/company/index.md',
            status: 'renamed',
            mode: '100644',
            previousPath: 'content/pages/about/index.md',
          },
          {
            path: 'content/pages/company/team/index.md',
            status: 'renamed',
            mode: '100644',
            previousPath: 'content/pages/about/team/index.md',
          },
          // A descendant whose canonical slug was rewritten in place
          { path: 'content/pages/about/team/index.md', status: 'modified', mode: '100644' },
          // An entry outside the folder isn’t moved
          { path: 'content/pages/contact/index.md', status: 'removed' },
          { path: 'content/pages/elsewhere/index.md', status: 'added', mode: '100644' },
        ]),
      ).toEqual(['content/pages/contact/index.md', 'content/pages/elsewhere/index.md']);

      expect(getEntriesByCollection).toHaveBeenCalledWith('pages');
    });

    test('tells the moved entry from its descendants after a reload', () => {
      vi.mocked(getNestedConfig).mockReturnValue(/** @type {any} */ ({ subfolders: true }));

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
      vi.mocked(getEntriesByCollection).mockReturnValue([team, published, history]);

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
      });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/pages/company/index.md', status: 'added', mode: '100644' },
          { path: 'content/pages/about/index.md', status: 'removed' },
          { path: 'content/pages/company/team/index.md', status: 'added', mode: '100644' },
          { path: 'content/pages/about/team/index.md', status: 'removed' },
          { path: 'content/pages/company/history/index.md', status: 'added', mode: '100644' },
          { path: 'content/pages/about/history/index.md', status: 'removed' },
        ]),
      ).toEqual([]);
    });

    test.each([
      ['an entry at the top of a nested collection', { subfolders: true }, 'index', 'pages'],
      ['a nested collection without subfolders', { subfolders: false }, 'about/index', 'pages'],
      ['a collection that is no longer configured', { subfolders: true }, 'about/index', 'gone'],
    ])('moves nothing along with %s', (_label, nested, subPath, collectionName) => {
      vi.mocked(getNestedConfig).mockReturnValue(/** @type {any} */ (nested));
      vi.mocked(getCollection).mockImplementation((name) =>
        name === 'gone' ? undefined : /** @type {any} */ ({ name }),
      );

      const published = createPublishedEntry('about', ['content/pages/about/index.md'], subPath);

      const team = createPublishedEntry(
        'team',
        ['content/pages/about/team/index.md'],
        'about/team/index',
      );

      mockPublishedEntries([published]);
      vi.mocked(getEntriesByCollection).mockReturnValue([published, team]);

      // The entry moves, so only the collection’s set-up stands in the way of its descendants
      const entry = createEntry({
        collectionName,
        paths: ['content/pages/company/index.md'],
        subPath: subPath === 'index' ? 'company' : subPath.replace('about', 'company'),
        previousPaths: ['content/pages/about/index.md'],
      });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/pages/about/team/index.md', status: 'removed' },
          { path: 'content/pages/company/x/index.md', status: 'added', mode: '100644' },
        ]),
      ).toEqual(['content/pages/about/team/index.md', 'content/pages/company/x/index.md']);
    });

    test('moves nothing along with an entry that only drops a locale’s file', () => {
      vi.mocked(getNestedConfig).mockReturnValue(/** @type {any} */ ({ subfolders: true }));

      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.en.md', 'content/pages/about/index.fr.md'],
        'about/index',
      );

      const team = createPublishedEntry(
        'team',
        ['content/pages/about/team/index.en.md'],
        'about/team/index',
      );

      mockPublishedEntries([published]);
      vi.mocked(getEntriesByCollection).mockReturnValue([published, team]);

      const entry = createEntry({
        collectionName: 'pages',
        paths: ['content/pages/about/index.en.md'],
        subPath: 'about/index',
      });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/pages/about/index.fr.md', status: 'removed' },
          { path: 'content/pages/about/team/index.en.md', status: 'removed' },
          { path: 'static/logo.png', status: 'removed' },
        ]),
      ).toEqual(['content/pages/about/team/index.en.md', 'static/logo.png']);
    });

    test.each([
      ['edited in place', 'pending_publish'],
      ['being deleted', 'pending_deletion'],
    ])('moves nothing along with a nested entry %s', (_label, status) => {
      vi.mocked(getNestedConfig).mockReturnValue(/** @type {any} */ ({ subfolders: true }));

      const published = createPublishedEntry(
        'about',
        ['content/pages/about/index.md'],
        'about/index',
      );

      const team = createPublishedEntry(
        'team',
        ['content/pages/about/team/index.md'],
        'about/team/index',
      );

      mockPublishedEntries([published]);
      vi.mocked(getEntriesByCollection).mockReturnValue([published, team]);

      // Deleting a page leaves the pages below it alone, as does editing it, so a pull request
      // that removes or rewrites one of them is doing something the CMS hasn’t shown
      const entry = createEntry({
        collectionName: 'pages',
        paths: ['content/pages/about/index.md'],
        subPath: 'about/index',
        status,
      });

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/pages/about/index.md', status: 'modified', mode: '100644' },
          { path: 'content/pages/about/team/index.md', status: 'removed' },
          { path: 'content/pages/about/team/index.md', status: 'modified', mode: '100644' },
          { path: 'content/pages/about/x/index.md', status: 'added', mode: '100644' },
        ]),
      ).toEqual(['content/pages/about/team/index.md', 'content/pages/about/x/index.md']);
    });

    test('reports each path once, and copes with a rename without a previous path', () => {
      expect(
        findUnexpectedChanges(createEntry(), [
          { path: 'src/app.js', status: 'renamed', mode: '100644' },
          { path: 'src/app.js', status: 'modified', mode: '100644' },
        ]),
      ).toEqual(['src/app.js']);
    });

    test('copes with an entry without previous paths on record', () => {
      const entry = createEntry();

      delete entry.workflow.previousPaths;

      expect(
        findUnexpectedChanges(entry, [
          { path: 'content/posts/hello.md', status: 'modified', mode: '100644' },
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
