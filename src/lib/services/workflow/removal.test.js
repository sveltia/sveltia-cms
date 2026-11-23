import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { callEventHooks } from '$lib/services/api/events';
import { getAssetBlob } from '$lib/services/assets/info';
import { allAssets } from '$lib/services/assets/state';
import { backend } from '$lib/services/backends';
import { promptCommitMessage } from '$lib/services/backends/commit-prompt';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { createFileList } from '$lib/services/backends/process';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import {
  buildCascadeDeleteChanges,
  planCascadeDelete,
} from '$lib/services/contents/entry/relations/cascade/delete';
import { allUnpublishedEntries, publishingBranches } from '$lib/services/workflow';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import {
  deleteWorkflowEntries,
  deleteWorkflowEntry,
  discardWorkflowEntries,
  discardWorkflowEntry,
} from '$lib/services/workflow/removal';
import { publishWorkflowEntry, upsertUnpublishedEntry } from '$lib/services/workflow/save';
import { createMockForkPullRequest } from '$lib/test/factories';
import { classifyFiles, createCompanion, createEntry, workflowService } from '$lib/test/workflow';

const { additions } = vi.hoisted(() => ({
  additions: { deleteEntryComments: vi.fn(), moveEntryConversation: vi.fn() },
}));

vi.mock('$lib/services/app/additions', () => ({
  getAdditions: vi.fn(() => additions),
}));
vi.mock('$lib/services/api/events');
vi.mock('$lib/services/assets/info', () => ({ getAssetBlob: vi.fn() }));
vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/backends/process', () => ({
  createFileList: vi.fn(() => ({ entryFiles: [], assetFiles: [] })),
}));
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry' })),
}));
vi.mock('$lib/services/contents/collection/files', () => ({ getCollectionFile: vi.fn() }));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/relations/cascade/delete', () => {
  /** @type {import('vitest').Mock<(args: any) => any>} */
  const planMock = vi.fn(() => ({ targets: [], blockers: [] }));

  /**
   * Mirror the real wrapper so that the tests can drive it through `planCascadeDelete()`.
   * @param {any} args Arguments.
   * @param {string} message Error message.
   * @returns {any[]} Targets.
   * @throws {Error} When the plan has blockers.
   */
  const planCascadeDeleteOrThrow = (args, message) => {
    const { targets, blockers } = planMock(args);

    if (blockers.length) {
      throw new Error(message, { cause: blockers });
    }

    return targets;
  };

  return {
    planCascadeDelete: planMock,
    planCascadeDeleteOrThrow,
    buildCascadeDeleteChanges: vi.fn(async () => ({ changes: [], savingEntries: [] })),
  };
});
vi.mock('$lib/services/backends/commit-prompt', () => ({
  promptCommitMessage: vi.fn(async (_changes, options) => options),
}));
vi.mock('$lib/services/backends/git/shared/commits');
vi.mock('$lib/services/backends/save');
vi.mock('$lib/services/contents/draft/save/file-changes', () => ({ resolveCacheDB: vi.fn() }));
vi.mock('$lib/services/deployments/resolve');
vi.mock('$lib/services/workflow/deploy');
vi.mock('$lib/services/workflow/verify', () => ({
  checkReviewedHead: vi.fn(),
  verifyMergeState: vi.fn(),
}));
vi.mock('$lib/services/workflow/assets', async (importOriginal) => ({
  ...(await importOriginal()),
  getUsedAssetPaths: vi.fn(() => new Set()),
}));

describe('workflow/removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(promptCommitMessage).mockImplementation(async (_changes, options) => options);
    allUnpublishedEntries.current = [];
    publishingBranches.current = [];
    allEntries.current = [];
    forkedRepository.current = undefined;

    /** @type {any} */ (backend).current = { workflow: workflowService };
  });

  afterEach(() => {
    cmsConfig.current = undefined;
  });

  describe('deleteWorkflowEntry', () => {
    const collection = /** @type {any} */ ({ name: 'posts', _type: 'entry' });

    test('refuses to take a published entry off the site for a contributor', async () => {
      // Discarding their own draft leaves the published version alone and stays available; removing
      // something already live is a maintainer’s call
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      await expect(
        deleteWorkflowEntry(
          /** @type {any} */ ({ slug: 'hello', locales: { _default: { path: 'p.md' } } }),
          collection,
          undefined,
        ),
      ).rejects.toThrow('Cannot delete a published entry as an Open Authoring contributor');
    });

    test('refuses to turn a contributor’s pull request into a removal', async () => {
      const forkEntry = /** @type {any} */ ({
        id: 'fork',
        slug: 'hello',
        subPath: 'hello',
        locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
        workflow: {
          collectionName: 'posts',
          status: 'pending_review',
          pullRequest: createMockForkPullRequest({ pullRequest: { files: [] } }),
        },
      });

      vi.mocked(planCascadeDelete).mockReturnValue({ targets: [], blockers: [] });
      allUnpublishedEntries.current = [forkEntry];

      await expect(deleteWorkflowEntry(forkEntry, collection, undefined)).rejects.toThrow(
        'Cannot delete an entry through a pull request from a fork',
      );

      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });

    /**
     * Create a published entry for testing.
     * @returns {any} Entry.
     */
    const createPublishedEntry = () => ({
      id: 'published',
      slug: 'hello',
      subPath: 'hello',
      locales: {
        _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} },
        ja: { slug: 'hello', path: 'content/posts/ja/hello.md', content: {} },
      },
    });

    beforeEach(() => {
      vi.mocked(createCommitMessage).mockReturnValue('Delete Post “hello”');
      vi.mocked(planCascadeDelete).mockReturnValue({ targets: [], blockers: [] });
      vi.mocked(buildCascadeDeleteChanges).mockResolvedValue({ changes: [], savingEntries: [] });

      // The backend opens the pull request at the status it was asked for
      // A new pull request opens at the status it was asked for; an existing one is returned as is
      workflowService.savePullRequest.mockImplementation(
        async (/** @type {any} */ { status, pullRequest }) => ({
          pullRequest: pullRequest ?? { branch: 'cms/posts/hello', number: 7, files: [], status },
          commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        }),
      );

      workflowService.updateStatus.mockImplementation(
        async (/** @type {any} */ pr, /** @type {any} */ status) => ({ ...pr, status }),
      );
    });

    test('titles the pull request with the path relative to the repository root', async () => {
      // @ts-ignore Partial configuration
      cmsConfig.current = {
        backend: { name: 'github', repo: 'owner/repo', root_dir: 'apps/site' },
      };

      await deleteWorkflowEntry(createPublishedEntry(), collection, undefined);

      expect(createCommitMessage).toHaveBeenCalledWith(
        [{ action: 'delete', slug: 'hello', path: 'apps/site/content/posts/hello.md' }],
        { commitType: 'delete', collection },
      );
    });

    test('asks for a commit message, unless one is given, and uses it', async () => {
      vi.mocked(promptCommitMessage).mockImplementation(async (_changes, options) => ({
        ...options,
        userMessage: options.userMessage ?? 'Asked',
      }));

      await deleteWorkflowEntry(createPublishedEntry(), collection, undefined);

      expect(promptCommitMessage).toHaveBeenCalledWith(
        [{ action: 'delete', slug: 'hello', path: 'content/posts/hello.md' }],
        { commitType: 'delete', collection, userMessage: undefined },
      );
      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { commitType: 'delete', collection, userMessage: 'Asked' },
        }),
      );

      await deleteWorkflowEntry(createPublishedEntry(), collection, undefined, [], {
        userMessage: 'Given',
      });

      expect(workflowService.savePullRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          options: { commitType: 'delete', collection, userMessage: 'Given' },
        }),
      );
    });

    test('opens a pull request that deletes every locale file', async () => {
      const entry = createPublishedEntry();
      const unpublishedEntry = await deleteWorkflowEntry(entry, collection, undefined);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith({
        changes: [
          { action: 'delete', slug: 'hello', path: 'content/posts/hello.md' },
          { action: 'delete', slug: 'hello', path: 'content/posts/ja/hello.md' },
        ],
        options: { commitType: 'delete', collection },
        branch: 'cms/posts/hello',
        title: 'Delete Post “hello”',
        status: 'pending_deletion',
        pullRequest: undefined,
      });

      // Opening it at the right status avoids creating a draft and relabelling it a moment later
      expect(workflowService.updateStatus).not.toHaveBeenCalled();

      expect(unpublishedEntry.workflow).toMatchObject({
        status: 'pending_deletion',
        collectionName: 'posts',
        previousPaths: ['content/posts/hello.md', 'content/posts/ja/hello.md'],
      });

      expect(allUnpublishedEntries.current).toEqual([unpublishedEntry]);

      // The entry is still on the configured branch, so the unpublish hooks wait for the merge
      expect(callEventHooks).not.toHaveBeenCalled();
    });

    test('removes the entry-relative assets along with the entry', async () => {
      const assets = /** @type {any} */ ([{ path: 'content/posts/hello/image.png' }]);

      await deleteWorkflowEntry(createPublishedEntry(), collection, undefined, assets);

      // Leaving them behind would orphan them, unlike a direct delete
      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [
            { action: 'delete', slug: 'hello', path: 'content/posts/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/posts/ja/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/posts/hello/image.png' },
          ],
        }),
      );
    });

    test('removes the references to the entry in the same pull request', async () => {
      const entry = createPublishedEntry();
      const target = /** @type {any} */ ({ entry: { id: 'post-1' }, collection });

      const cascadeChange = /** @type {any} */ ({
        action: 'update',
        slug: 'post-1',
        path: 'content/posts/post-1.md',
        data: 'tag: ""',
      });

      vi.mocked(planCascadeDelete).mockReturnValue({ targets: [target], blockers: [] });
      vi.mocked(buildCascadeDeleteChanges).mockResolvedValue({
        changes: [cascadeChange],
        savingEntries: [target.entry],
      });

      const deleted = await deleteWorkflowEntry(entry, collection, undefined);

      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection,
        collectionFile: undefined,
        entries: [entry],
      });
      expect(buildCascadeDeleteChanges).toHaveBeenCalledWith({ targets: [target] });
      // The rewrite is recorded on the pull request, so publishing right away can check it
      expect(/** @type {any} */ (deleted).workflow.pullRequest).toMatchObject({
        headSHA: 'abc',
        files: [
          { path: 'content/posts/hello.md', deleted: true },
          { path: 'content/posts/ja/hello.md', deleted: true },
          { path: 'content/posts/post-1.md', text: 'tag: ""', deleted: false },
        ],
      });
      // Once the removal lands, no reference is left dangling
      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [
            { action: 'delete', slug: 'hello', path: 'content/posts/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/posts/ja/hello.md' },
            cascadeChange,
          ],
        }),
      );
    });

    test('refuses to delete an entry that other entries require', async () => {
      vi.mocked(planCascadeDelete).mockReturnValue({
        targets: [],
        blockers: [/** @type {any} */ ({ entry: { id: 'post-1' }, keyPath: 'tag' })],
      });

      await expect(
        deleteWorkflowEntry(createPublishedEntry(), collection, undefined),
      ).rejects.toThrow('Cannot delete an entry that other entries require');
      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });

    test('opens one pull request per entry for a selection', async () => {
      const first = createPublishedEntry();
      const second = createPublishedEntry();

      second.slug = 'world';
      second.locales = {
        _default: { slug: 'world', path: 'content/posts/world.md', content: {} },
      };

      await deleteWorkflowEntries([
        { entry: first, collection },
        { entry: second, collection },
      ]);

      // A branch is named after the entry it holds, so a selection can’t share one
      expect(workflowService.savePullRequest).toHaveBeenCalledTimes(2);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'cms/posts/hello' }),
      );

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'cms/posts/world' }),
      );
    });

    test('records the collection file name for a file collection', async () => {
      const collectionFile = /** @type {any} */ ({ name: 'site' });
      const entry = await deleteWorkflowEntry(createPublishedEntry(), collection, collectionFile);

      expect(entry.workflow.fileName).toBe('site');
    });

    test('reuses the open pull request after the slug has been edited', async () => {
      // The branch keeps the original slug, so deriving it from the current one would miss the
      // pull request and open a second one for the same entry
      const pending = createEntry('cms/posts/hello');

      pending.workflow.previousPaths = ['content/posts/hello.md'];
      upsertUnpublishedEntry(pending);

      // A renamed entry lives at its new paths on the branch; the old ones are already staged as
      // deleted there
      const renamed = createPublishedEntry();

      renamed.slug = 'hello-renamed';
      renamed.locales = {
        _default: { slug: 'hello-renamed', path: 'content/posts/hello-renamed.md', content: {} },
      };
      renamed.workflow = pending.workflow;

      const entry = await deleteWorkflowEntry(renamed, collection, undefined);

      // Closing the pull request first would throw the pending changes away with no way back if
      // the replacement then failed
      expect(workflowService.discard).not.toHaveBeenCalled();

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/posts/hello',
          pullRequest: pending.workflow.pullRequest,
          changes: [
            { action: 'delete', slug: 'hello-renamed', path: 'content/posts/hello-renamed.md' },
          ],
        }),
      );

      // A reused pull request keeps the status it had, so it has to be switched over
      expect(workflowService.updateStatus).toHaveBeenCalledWith(
        pending.workflow.pullRequest,
        'pending_deletion',
      );

      // It carried the head from before the removal was committed, which publishing would take for
      // someone else’s commit, so it’s pointed at the new one
      expect(entry.workflow.pullRequest.headSHA).toBe('abc');

      // The entry list matches the removal against where the entry sits on the configured branch
      expect(entry.workflow.previousPaths).toEqual(['content/posts/hello.md']);
    });

    test('takes the new entries riding along in a reused pull request off its branch', async () => {
      // They have never been published, so the removal would otherwise publish them
      const pending = createEntry('cms/posts/hello');

      pending.workflow.companions = [createCompanion('guides')];
      upsertUnpublishedEntry(pending);

      const entry = await deleteWorkflowEntry(createPublishedEntry(), collection, undefined);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [
            { action: 'delete', slug: 'hello', path: 'content/posts/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/posts/ja/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/sections/guides.md' },
          ],
        }),
      );
      expect(entry.workflow.companions).toBeUndefined();
    });

    test('puts the existing entries changed in a reused pull request back as published', async () => {
      // They’re published entries, so taking them off the branch would delete them from the site
      // @see https://github.com/sveltia/sveltia-cms/issues/1129
      const pending = createEntry('cms/posts/hello');

      /** @type {Record<string, string>} */
      const publishedTexts = {
        'content/authors/ada.md': 'name: Ada',
        'content/authors/ja/ada.md': 'name: エイダ',
      };

      allEntries.current = [
        /** @type {any} */ ({
          id: 'ada',
          slug: 'ada',
          subPath: 'ada',
          locales: {
            en: { path: 'content/authors/ada.md' },
            ja: { path: 'content/authors/ja/ada.md' },
            de: { path: 'content/authors/de/ada.md' },
          },
        }),
      ];

      pending.workflow.companions = [
        createCompanion('guides'),
        {
          collectionName: 'authors',
          entry: {
            id: 'ada',
            slug: 'ada',
            subPath: 'ada',
            // Japanese turned off, French turned on, German left alone
            locales: {
              en: { path: 'content/authors/ada.md' },
              fr: { path: 'content/authors/fr/ada.md' },
              de: { path: 'content/authors/de/ada.md' },
            },
          },
          edited: true,
        },
        {
          collectionName: 'authors',
          // Deleted from the configured branch since, so there’s nothing to put back
          entry: { id: 'alan', slug: 'alan', subPath: 'alan', locales: {} },
          edited: true,
        },
      ];
      pending.workflow.pullRequest.files = [
        { path: 'content/sections/guides.md' },
        { path: 'content/authors/ada.md' },
        { path: 'content/authors/ja/ada.md', deleted: true },
        { path: 'content/authors/fr/ada.md' },
      ];
      upsertUnpublishedEntry(pending);
      vi.mocked(resolveCacheDB).mockReturnValue(
        /** @type {any} */ ({ get: vi.fn(async (path) => ({ text: publishedTexts[path] })) }),
      );

      await deleteWorkflowEntry(createPublishedEntry(), collection, undefined);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [
            { action: 'delete', slug: 'hello', path: 'content/posts/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/posts/ja/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/sections/guides.md' },
            {
              action: 'update',
              slug: 'hello',
              path: 'content/authors/ada.md',
              data: 'name: Ada',
            },
            { action: 'delete', slug: 'hello', path: 'content/authors/fr/ada.md' },
            {
              action: 'create',
              slug: 'hello',
              path: 'content/authors/ja/ada.md',
              data: 'name: エイダ',
            },
          ],
        }),
      );
    });

    test('leaves a changed entry to the reference rewrite of the deletion', async () => {
      // The rewrite is made from the configured branch, so putting the entry back first would
      // only write the same file twice in the commit
      const pending = createEntry('cms/posts/hello');
      const rewrite = { action: 'update', slug: 'ada', path: 'content/authors/ada.md', data: 'x' };

      allEntries.current = [
        /** @type {any} */ ({ id: 'ada', locales: { en: { path: 'content/authors/ada.md' } } }),
      ];
      pending.workflow.companions = [
        {
          collectionName: 'authors',
          entry: { id: 'ada', locales: { en: { path: 'content/authors/ada.md' } } },
          edited: true,
        },
      ];
      pending.workflow.pullRequest.files = [{ path: 'content/authors/ada.md' }];
      upsertUnpublishedEntry(pending);
      vi.mocked(resolveCacheDB).mockReturnValue(
        /** @type {any} */ ({ get: vi.fn(async () => ({ text: 'name: Ada' })) }),
      );
      vi.mocked(buildCascadeDeleteChanges).mockResolvedValue(
        /** @type {any} */ ({ changes: [rewrite], savingEntries: [] }),
      );

      await deleteWorkflowEntry(createPublishedEntry(), collection, undefined);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [
            { action: 'delete', slug: 'hello', path: 'content/posts/hello.md' },
            { action: 'delete', slug: 'hello', path: 'content/posts/ja/hello.md' },
            rewrite,
          ],
        }),
      );
    });

    test('refuses to delete when a changed entry can’t be put back as published', async () => {
      const pending = createEntry('cms/posts/hello');

      allEntries.current = [
        /** @type {any} */ ({ id: 'ada', locales: { en: { path: 'content/authors/ada.md' } } }),
      ];
      pending.workflow.companions = [
        {
          collectionName: 'authors',
          entry: { id: 'ada', locales: { en: { path: 'content/authors/ada.md' } } },
          edited: true,
        },
      ];
      pending.workflow.pullRequest.files = [{ path: 'content/authors/ada.md' }];
      upsertUnpublishedEntry(pending);
      vi.mocked(resolveCacheDB).mockReturnValue(undefined);

      await expect(
        deleteWorkflowEntry(createPublishedEntry(), collection, undefined),
      ).rejects.toThrow('The published version of content/authors/ada.md could not be found.');
      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });

    describe('the other files a reused pull request changes', () => {
      const blob = new Blob(['published image']);

      beforeEach(() => {
        vi.mocked(createFileList).mockImplementation(classifyFiles);
        vi.mocked(getAssetBlob).mockResolvedValue(blob);
      });

      afterEach(() => {
        allAssets.current = [];
      });

      test('takes them off the branch, or puts them back as published', async () => {
        const pending = createEntry('cms/posts/hello');

        /** @type {Record<string, any>} */
        const cache = {
          'content/posts/other.md': { sha: 'o', size: 1, text: 'related: hello' },
          'content/posts/hello/child.md': { sha: 'c', size: 1, text: 'title: Child' },
        };

        allEntries.current = [
          /** @type {any} */ ({
            id: 'other',
            locales: { _default: { path: 'content/posts/other.md' } },
          }),
        ];
        allAssets.current = [
          // Shadowed by the version the pull request committed
          /** @type {any} */ ({
            path: 'static/uploads/logo.png',
            sha: 'l2',
            workflow: {
              branch: 'cms/posts/hello',
              replacedAsset: { path: 'static/uploads/logo.png', sha: 'l1' },
            },
          }),
          /** @type {any} */ ({ path: 'static/uploads/team.png', sha: 't1' }),
          /** @type {any} */ ({
            path: 'static/uploads/new.jpg',
            sha: 'n1',
            workflow: { branch: 'cms/posts/hello' },
          }),
        ];

        // The entry was renamed and moved, taking the entry below it along and rewriting a
        // reference to it, and an image was uploaded for it
        pending.locales = {
          _default: { slug: 'hello-world', path: 'content/posts/hello-world.md', content: {} },
        };
        pending.workflow.previousPaths = ['content/posts/hello.md'];
        pending.workflow.pullRequest.files = [
          { path: 'content/posts/hello.md', deleted: true },
          { path: 'content/posts/hello-world.md', deleted: false },
          { path: 'content/posts/hello/child.md', deleted: true },
          { path: 'content/posts/hello-world/child.md', deleted: false },
          { path: 'content/posts/other.md', deleted: false },
          { path: 'static/uploads/new.jpg', deleted: false },
          { path: 'static/uploads/logo.png', deleted: false },
          { path: 'static/uploads/team.png', deleted: true },
          // Changed outside the CMS, which can’t tell what it held
          { path: '.github/workflows/build.yml', deleted: false },
        ];
        upsertUnpublishedEntry(pending);
        vi.mocked(resolveCacheDB).mockReturnValue(
          /** @type {any} */ ({ get: vi.fn(async (path) => cache[path]) }),
        );

        const entry = await deleteWorkflowEntry(pending, collection, undefined);

        expect(workflowService.savePullRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            changes: [
              { action: 'delete', slug: 'hello', path: 'content/posts/hello-world.md' },
              {
                action: 'create',
                slug: 'hello',
                path: 'content/posts/hello/child.md',
                data: 'title: Child',
              },
              { action: 'delete', slug: 'hello', path: 'content/posts/hello-world/child.md' },
              {
                action: 'update',
                slug: 'hello',
                path: 'content/posts/other.md',
                data: 'related: hello',
              },
              { action: 'delete', slug: 'hello', path: 'static/uploads/new.jpg' },
              { action: 'update', slug: 'hello', path: 'static/uploads/logo.png', data: blob },
              { action: 'create', slug: 'hello', path: 'static/uploads/team.png', data: blob },
            ],
          }),
        );
        expect(getAssetBlob).toHaveBeenCalledWith({ path: 'static/uploads/logo.png', sha: 'l1' });
        // The asset list no longer offers the versions taken off the branch
        expect(allAssets.current).toEqual([
          { path: 'static/uploads/logo.png', sha: 'l1' },
          { path: 'static/uploads/team.png', sha: 't1' },
        ]);
        expect(entry.workflow.previousPaths).toEqual(['content/posts/hello.md']);
        expect(entry.workflow.pullRequest.files).toContainEqual(
          expect.objectContaining({ path: 'static/uploads/new.jpg', deleted: true }),
        );
      });

      test('refuses to delete when a changed file can’t be put back as published', async () => {
        const pending = createEntry('cms/posts/hello');

        allEntries.current = [
          /** @type {any} */ ({
            id: 'other',
            locales: { _default: { path: 'content/posts/other.md' } },
          }),
        ];
        pending.workflow.pullRequest.files = [{ path: 'content/posts/other.md', deleted: false }];
        upsertUnpublishedEntry(pending);
        vi.mocked(resolveCacheDB).mockReturnValue(undefined);

        await expect(deleteWorkflowEntry(pending, collection, undefined)).rejects.toThrow(
          'The published version of content/posts/other.md could not be found.',
        );
        expect(workflowService.savePullRequest).not.toHaveBeenCalled();
      });
    });

    test('keeps track of the commit when the status of a reused pull request can’t be switched', async () => {
      const pending = createEntry('cms/posts/hello');

      pending.workflow.pullRequest.headSHA = 'old';
      upsertUnpublishedEntry(pending);
      workflowService.updateStatus.mockRejectedValue(new Error('API error'));

      await expect(
        deleteWorkflowEntry(createPublishedEntry(), collection, undefined),
      ).rejects.toThrow('API error');

      // The removal has been committed to the branch, so the entry follows the new head commit,
      // keeping the status the pull request still has
      expect(allUnpublishedEntries.current).toHaveLength(1);

      const [stored] = allUnpublishedEntries.current;

      expect(stored.workflow.pullRequest.headSHA).toBe('abc');
      expect(stored.workflow.status).toBe('draft');
      expect(stored.workflow.pullRequest.status).toBe('draft');
    });

    test('reuses a pull request whose branch keeps the slashes of the slug', async () => {
      // A branch created by Netlify/Decap CMS or an earlier version, before slashes were encoded
      const pending = createEntry('cms/pages/about/ethos');

      pending.locales = {
        _default: { slug: 'about/ethos', path: 'content/pages/about/ethos.md', content: {} },
      };
      upsertUnpublishedEntry(pending);

      const published = createPublishedEntry();

      published.slug = 'about/ethos';
      published.locales = {
        _default: { slug: 'about/ethos', path: 'content/pages/about/ethos.md', content: {} },
      };

      // The entry was opened from the published list, so it doesn’t carry the branch itself
      await deleteWorkflowEntry(
        published,
        /** @type {any} */ ({ name: 'pages', _type: 'entry' }),
        undefined,
      );

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/pages/about/ethos',
          pullRequest: pending.workflow.pullRequest,
        }),
      );

      expect(allUnpublishedEntries.current).toHaveLength(1);
    });

    test('fires the unpublish hooks when the removal is merged, not when it’s queued', async () => {
      const entry = createPublishedEntry();
      const unpublishedEntry = await deleteWorkflowEntry(entry, collection, undefined);

      expect(callEventHooks).not.toHaveBeenCalled();

      await publishWorkflowEntry(unpublishedEntry);

      // The publish hooks don’t apply: nothing is being published
      expect(vi.mocked(callEventHooks).mock.calls.map(([{ type }]) => type)).toEqual([
        'preUnpublish',
        'postUnpublish',
      ]);
    });

    test('takes the entry off the site once the removal is published', async () => {
      const entry = createPublishedEntry();

      allEntries.current = [
        entry,
        /** @type {any} */ ({
          id: 'other',
          slug: 'other',
          subPath: 'other',
          locales: { _default: { slug: 'other', path: 'content/posts/other.md', content: {} } },
        }),
      ];

      const unpublishedEntry = await deleteWorkflowEntry(entry, collection, undefined);

      await publishWorkflowEntry(unpublishedEntry);

      expect(allEntries.current.map((/** @type {any} */ e) => e.id)).toEqual(['other']);
      expect(allUnpublishedEntries.current).toEqual([]);
    });

    test('brings the referencing entries up to date once the removal is published', async () => {
      const entry = createPublishedEntry();

      const post = /** @type {any} */ ({
        id: 'post-1',
        slug: 'post-1',
        subPath: 'post-1',
        locales: {
          _default: { slug: 'post-1', path: 'content/posts/post-1.md', content: { tag: 'hello' } },
        },
      });

      const other = /** @type {any} */ ({
        id: 'other',
        slug: 'other',
        subPath: 'other',
        locales: { _default: { slug: 'other', path: 'content/posts/other.md', content: {} } },
      });

      const rewrittenPost = {
        ...post,
        locales: { _default: { ...post.locales._default, content: { tag: '' } } },
      };

      allEntries.current = [entry, post, other];

      const unpublishedEntry = await deleteWorkflowEntry(entry, collection, undefined);

      // The references are worked out again at publish time, while the deleted entry is still in
      // the store, rather than remembered from when the pull request was opened
      vi.mocked(planCascadeDelete).mockClear();
      vi.mocked(planCascadeDelete).mockReturnValue({
        targets: [{ entry: rewrittenPost, collection }],
        blockers: [],
      });

      await publishWorkflowEntry(unpublishedEntry);

      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection: { name: 'posts', _type: 'entry' },
        collectionFile: undefined,
        entries: [unpublishedEntry],
      });
      expect(allEntries.current).toEqual([rewrittenPost, other]);
    });

    test('brings the references to the whole selection up to date once a removal lands', async () => {
      const first = createEntry('cms/posts/hello', 'pending_deletion');
      const second = { ...createEntry('cms/posts/world', 'pending_deletion'), id: 'world' };
      const elsewhere = createEntry('cms/pages/about', 'pending_deletion');
      const record = '<!-- sveltia-cms:deletion-group=';

      first.workflow.pullRequest.description = `${record}group-1 -->`;
      second.workflow.pullRequest.description = `${record}group-1 -->`;
      elsewhere.id = 'about';
      elsewhere.workflow.collectionName = 'pages';
      // A selection is recorded per collection, so another collection’s deletion has its own
      elsewhere.workflow.pullRequest.description = `${record}group-2 -->`;
      allUnpublishedEntries.current = [first, second, elsewhere];

      await publishWorkflowEntry(first);

      // The pull request removed the references to every entry of the selection, as the publish
      // check expects, so the store has to drop them all, not only those to the published entry
      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection: { name: 'posts', _type: 'entry' },
        collectionFile: undefined,
        entries: [first, second],
      });
    });

    test('brings only the references to an entry deleted on its own up to date', async () => {
      const first = createEntry('cms/posts/hello', 'pending_deletion');
      const second = { ...createEntry('cms/posts/world', 'pending_deletion'), id: 'world' };

      // Deleted one at a time, so each pull request removes only the references to its own entry.
      // Taking in the other one’s would drop references that are still on the site, and save them
      // with the next edit if the other deletion is then cancelled
      allUnpublishedEntries.current = [first, second];

      await publishWorkflowEntry(first);

      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection: { name: 'posts', _type: 'entry' },
        collectionFile: undefined,
        entries: [first],
      });
    });

    test('leaves the store alone when a regular publish lands', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      upsertUnpublishedEntry(entry);
      await publishWorkflowEntry(entry);

      expect(planCascadeDelete).not.toHaveBeenCalled();
    });

    test('removes the references to the whole selection in every pull request', async () => {
      const first = createPublishedEntry();
      const second = createPublishedEntry();

      second.id = 'published-2';
      second.slug = 'world';
      second.locales = {
        _default: { slug: 'world', path: 'content/posts/world.md', content: {} },
      };

      const target = /** @type {any} */ ({ entry: { id: 'post-1' }, collection });

      const cascadeChange = /** @type {any} */ ({
        action: 'update',
        slug: 'post-1',
        path: 'content/posts/post-1.md',
        data: 'tags: []',
      });

      vi.mocked(planCascadeDelete).mockReturnValue({ targets: [target], blockers: [] });
      vi.mocked(buildCascadeDeleteChanges).mockResolvedValue({
        changes: [cascadeChange],
        savingEntries: [target.entry],
      });

      await deleteWorkflowEntries([
        { entry: first, collection },
        { entry: second, collection },
      ]);

      // One plan for the selection, so a post referencing both entries comes out the same in both
      // pull requests, and the second one to be published doesn’t conflict with the first
      expect(planCascadeDelete).toHaveBeenCalledTimes(1);
      expect(planCascadeDelete).toHaveBeenCalledWith({
        collection,
        collectionFile: undefined,
        entries: [first, second],
      });
      expect(buildCascadeDeleteChanges).toHaveBeenCalledTimes(2);
      expect(buildCascadeDeleteChanges).toHaveBeenCalledWith({ targets: [target] });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/posts/hello',
          changes: expect.arrayContaining([cascadeChange]),
        }),
      );
      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/posts/world',
          changes: expect.arrayContaining([cascadeChange]),
        }),
      );

      // Both pull requests record the same selection, so publishing either works out the same
      // rewrite, while an entry of the collection deleted on its own isn’t taken in
      const [[{ deletionGroup }], [{ deletionGroup: otherGroup }]] = vi.mocked(
        workflowService.savePullRequest,
      ).mock.calls;

      expect(deletionGroup).toEqual(expect.any(String));
      expect(otherGroup).toBe(deletionGroup);
    });

    test('plans a selection spanning collections per collection', async () => {
      const first = createPublishedEntry();
      const second = createPublishedEntry();
      const otherCollection = /** @type {any} */ ({ name: 'pages', _type: 'entry' });

      second.id = 'published-2';
      second.slug = 'world';
      second.locales = {
        _default: { slug: 'world', path: 'content/pages/world.md', content: {} },
      };

      await deleteWorkflowEntries([
        { entry: first, collection },
        { entry: second, collection: otherCollection },
      ]);

      expect(planCascadeDelete).toHaveBeenCalledTimes(2);
      expect(planCascadeDelete).toHaveBeenCalledWith(
        expect.objectContaining({ collection, entries: [first] }),
      );
      expect(planCascadeDelete).toHaveBeenCalledWith(
        expect.objectContaining({ collection: otherCollection, entries: [second] }),
      );

      // Each entry is the only one of its collection, so it’s planned on its own, with no record
      expect(workflowService.savePullRequest).toHaveBeenCalledTimes(2);
      expect(workflowService.savePullRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ deletionGroup: expect.anything() }),
      );
    });

    test('asks for a commit message once for the whole selection', async () => {
      const first = createPublishedEntry();
      const second = createPublishedEntry();

      second.id = 'published-2';
      second.slug = 'world';
      second.locales = {
        _default: { slug: 'world', path: 'content/posts/world.md', content: {} },
      };

      vi.mocked(promptCommitMessage).mockImplementation(async (_changes, options) => ({
        ...options,
        userMessage: options.userMessage ?? 'JIRA-2',
      }));

      await deleteWorkflowEntries([
        { entry: first, collection },
        { entry: second, collection },
      ]);

      expect(promptCommitMessage).toHaveBeenNthCalledWith(
        1,
        [{ action: 'delete', slug: 'hello', path: 'content/posts/hello.md' }],
        { commitType: 'delete', collection },
      );
      expect(workflowService.savePullRequest).toHaveBeenCalledTimes(2);
      workflowService.savePullRequest.mock.calls.forEach(([{ options }]) => {
        expect(options.userMessage).toBe('JIRA-2');
      });
    });

    test('deletes nothing when the user cancels the commit', async () => {
      vi.mocked(promptCommitMessage).mockRejectedValue(new Error('commit_cancelled'));

      await expect(
        deleteWorkflowEntries([{ entry: createPublishedEntry(), collection }]),
      ).rejects.toThrow('commit_cancelled');
      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });

    test('refuses a selection that other entries require', async () => {
      vi.mocked(planCascadeDelete).mockReturnValue({
        targets: [],
        blockers: [/** @type {any} */ ({ entry: { id: 'post-1' }, keyPath: 'tag' })],
      });

      await expect(
        deleteWorkflowEntries([{ entry: createPublishedEntry(), collection }]),
      ).rejects.toThrow('Cannot delete entries that other entries require');
      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('discardWorkflowEntry', () => {
    test('closes the pull request and removes the entry', async () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);
      await discardWorkflowEntry(entry);

      expect(workflowService.discard).toHaveBeenCalledWith(entry.workflow.pullRequest);
      expect(allUnpublishedEntries.current).toEqual([]);
      // It was never published, so its comments go with it
      expect(additions.deleteEntryComments).toHaveBeenCalledWith('posts/hello');
    });

    test('keeps the comments of a published entry', async () => {
      const entry = createEntry('cms/posts/hello');

      vi.mocked(getEntriesByCollection).mockReturnValueOnce([
        /** @type {any} */ ({ subPath: 'hello', locales: {} }),
      ]);
      upsertUnpublishedEntry(entry);
      await discardWorkflowEntry(entry);

      expect(additions.deleteEntryComments).not.toHaveBeenCalled();
      expect(additions.moveEntryConversation).not.toHaveBeenCalled();
    });

    test('gives the comments back to the published entry a draft renames', async () => {
      const entry = /** @type {any} */ (createEntry('cms/posts/hello'));

      entry.workflow.pullRequest.files = [
        { path: 'content/posts/hello.md', previousPath: 'content/posts/hi.md' },
        { path: 'content/posts/hello/cover.jpg' },
      ];
      vi.mocked(getEntriesByCollection).mockReturnValueOnce([
        /** @type {any} */ ({
          subPath: 'other',
          locales: { _default: { path: 'content/posts/other.md' } },
        }),
        /** @type {any} */ ({
          subPath: 'hi',
          locales: { _default: { path: 'content/posts/hi.md' } },
        }),
      ]);
      upsertUnpublishedEntry(entry);
      await discardWorkflowEntry(entry);

      expect(additions.moveEntryConversation).toHaveBeenCalledWith('posts/hello', 'posts/hi');
      expect(additions.deleteEntryComments).not.toHaveBeenCalled();
    });
  });

  describe('discardWorkflowEntries', () => {
    test('discards every given entry', async () => {
      const entries = ['cms/posts/a', 'cms/posts/b'].map((branch) => createEntry(branch));

      entries.forEach(upsertUnpublishedEntry);
      upsertUnpublishedEntry(createEntry('cms/posts/c'));

      await discardWorkflowEntries(entries);

      expect(workflowService.discard).toHaveBeenCalledTimes(2);

      // The unrelated entry is kept
      expect(allUnpublishedEntries.current.map((/** @type {any} */ e) => e.id)).toEqual([
        'cms/posts/c',
      ]);
    });

    test('does nothing for an empty list', async () => {
      await discardWorkflowEntries([]);
      expect(workflowService.discard).not.toHaveBeenCalled();
    });
  });
});
