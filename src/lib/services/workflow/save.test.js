import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { callEventHooks } from '$lib/services/api/events';
import { getAssetBlob } from '$lib/services/assets/info';
import { allAssets } from '$lib/services/assets/state';
import { backend } from '$lib/services/backends';
import { promptCommitMessage } from '$lib/services/backends/commit-prompt';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { createFileList } from '$lib/services/backends/process';
import { getCommitAuthor } from '$lib/services/backends/save';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import { refreshProductionSHA } from '$lib/services/deployments/resolve';
import { user } from '$lib/services/user/account.svelte';
import {
  allUnpublishedEntries,
  getUnpublishedEntryByBranch,
  publishingBranches,
} from '$lib/services/workflow';
import { getUsedAssetPaths } from '$lib/services/workflow/assets';
import { trackDeployingEntry } from '$lib/services/workflow/deploy';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import {
  publishReviewedEntry,
  publishWorkflowEntry,
  removeUnpublishedEntry,
  saveWorkflowChanges,
  updateWorkflowStatus,
  upsertUnpublishedEntry,
} from '$lib/services/workflow/save';
import { checkReviewedHead, verifyMergeState } from '$lib/services/workflow/verify';
import { createMockForkPullRequest } from '$lib/test/factories';
import { classifyFiles, createCompanion, createEntry, workflowService } from '$lib/test/workflow';

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

/**
 * Find the given asset paths that the given entry or its companions hold in their content.
 * @param {any} entry Entry.
 * @param {any[]} companions Companion entries.
 * @param {string[]} paths Asset paths.
 * @returns {Set<string>} Paths used.
 */
const findUsedAssetPaths = (entry, companions, paths) => {
  const content = JSON.stringify(
    [entry, ...companions.map((c) => c.entry)].map(({ locales }) => locales),
  );

  return new Set(paths.filter((path) => content.includes(path)));
};

describe('workflow/save', () => {
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

  describe('store helpers', () => {
    test('upserts and finds an entry by branch', () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(entry);

      const updated = createEntry('cms/posts/hello', 'pending_review');

      upsertUnpublishedEntry(updated);
      expect(allUnpublishedEntries.current).toHaveLength(1);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(updated);
    });

    test('removes an entry by branch', () => {
      upsertUnpublishedEntry(createEntry('cms/posts/hello'));
      upsertUnpublishedEntry(createEntry('cms/posts/world'));
      removeUnpublishedEntry('cms/posts/hello');

      expect(allUnpublishedEntries.current).toHaveLength(1);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBeUndefined();
    });
  });

  describe('saveWorkflowChanges', () => {
    const savingEntry = /** @type {any} */ ({
      id: 'new',
      slug: 'hello',
      subPath: 'hello',
      locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
    });

    const args = /** @type {any} */ ({
      changes: [{ action: 'create', path: 'content/posts/hello.md', slug: 'hello', data: '' }],
      savingEntry,
      options: { commitType: 'create' },
      collectionName: 'posts',
      fileName: undefined,
      slug: 'hello',
    });

    beforeEach(() => {
      vi.mocked(createCommitMessage).mockReturnValue('Create Post “hello”');
      vi.mocked(getCommitAuthor).mockReturnValue({ name: 'Me', email: 'me@example.com' });
    });

    afterEach(() => {
      allAssets.current = [];
    });

    test('titles the pull request with the paths relative to the repository root', async () => {
      // @ts-ignore Partial configuration
      cmsConfig.current = {
        backend: { name: 'github', repo: 'owner/repo', root_dir: 'apps/site' },
      };
      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/apps/site/posts/hello', number: 1, files: [], status: 'draft' },
      });

      await saveWorkflowChanges(args);

      expect(createCommitMessage).toHaveBeenCalledWith(
        [expect.objectContaining({ path: 'apps/site/content/posts/hello.md' })],
        { commitType: 'create' },
      );
      // The backend is given the paths the CMS deals with, and converts them itself
      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ changes: args.changes }),
      );
    });

    test('refuses to save an entry whose contributor’s pull request has gone', async () => {
      // The pull request was merged or closed since the editor was opened, so the entry is no
      // longer in the store. The changes mustn’t go into a pull request of the maintainers’ own
      allUnpublishedEntries.current = [];

      await expect(
        saveWorkflowChanges({
          ...args,
          originalEntry: /** @type {any} */ ({
            ...savingEntry,
            workflow: {
              pullRequest: createMockForkPullRequest(),
            },
          }),
        }),
      ).rejects.toThrow('The pull request is no longer open.');

      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });

    test('commits and titles the pull request with the commit message the user enters', async () => {
      vi.mocked(promptCommitMessage).mockImplementation(async (_changes, options) => ({
        ...options,
        userMessage: 'JIRA-1',
      }));
      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/posts/hello', number: 1, files: [], status: 'draft' },
      });

      await saveWorkflowChanges(args);

      expect(promptCommitMessage).toHaveBeenCalledWith(args.changes, { commitType: 'create' });
      expect(createCommitMessage).toHaveBeenCalledWith(expect.any(Array), {
        commitType: 'create',
        userMessage: 'JIRA-1',
      });
      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ options: { commitType: 'create', userMessage: 'JIRA-1' } }),
      );
    });

    test('saves nothing when the user cancels the commit', async () => {
      vi.mocked(promptCommitMessage).mockRejectedValue(new Error('commit_cancelled'));

      await expect(saveWorkflowChanges(args)).rejects.toThrow('commit_cancelled');
      expect(workflowService.savePullRequest).not.toHaveBeenCalled();
    });

    test('registers the committed assets so they can be previewed right away', async () => {
      workflowService.savePullRequest.mockResolvedValue({
        commit: {
          sha: 'abc',
          date: new Date('2026-01-01'),
          files: { 'static/img.png': { sha: 'blob-sha' } },
        },
        pullRequest: { branch: 'cms/posts/hello', number: 1, files: [], status: 'draft' },
      });

      allAssets.current = [
        /** @type {any} */ ({ path: 'static/img.png', sha: 'stale' }),
        /** @type {any} */ ({ path: 'static/other.png' }),
      ];

      const results = await saveWorkflowChanges({
        ...args,
        savingAssets: [{ path: 'static/img.png', sha: 'local', name: 'img.png' }],
      });

      // The SHA returned by the backend wins over the locally computed one
      expect(results.savedAssets).toEqual([
        expect.objectContaining({ path: 'static/img.png', sha: 'blob-sha' }),
      ]);

      // The map keeps the existing order, and the shadowed published asset is kept aside
      expect(
        allAssets.current.map((/** @type {any} */ a) => [a.path, a.sha, a.workflow?.branch]),
      ).toEqual([
        ['static/img.png', 'blob-sha', 'cms/posts/hello'],
        ['static/other.png', undefined, undefined],
      ]);

      expect(allAssets.current[0].workflow?.replacedAsset).toEqual({
        path: 'static/img.png',
        sha: 'stale',
      });
    });

    test('falls back to the locally computed asset SHA', async () => {
      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/posts/hello', number: 1, files: [], status: 'draft' },
      });

      const results = await saveWorkflowChanges({
        ...args,
        savingAssets: [{ path: 'static/img.png', sha: 'local', name: 'img.png' }],
      });

      expect(results.savedAssets[0].sha).toBe('local');
    });

    test('takes the assets the draft no longer uses off the branch', async () => {
      const blob = new Blob(['published logo']);
      const pending = createEntry('cms/posts/hello');

      vi.mocked(createFileList).mockImplementation(classifyFiles);
      vi.mocked(getUsedAssetPaths).mockImplementation(findUsedAssetPaths);
      vi.mocked(resolveCacheDB).mockReturnValue(undefined);
      vi.mocked(getAssetBlob).mockResolvedValue(blob);

      pending.locales._default.content = {
        image: 'static/uploads/first.webp',
        logo: 'static/uploads/logo.png',
        photo: 'static/uploads/kept.png',
        icon: 'static/uploads/icon.png',
      };
      pending.workflow.companions = [createCompanion('intro', 'static/uploads/section.png')];
      pending.workflow.pullRequest.files = [
        { path: 'content/posts/hello.md', deleted: false },
        { path: 'static/uploads/first.webp', deleted: false },
        { path: 'static/uploads/logo.png', deleted: false },
        { path: 'static/uploads/kept.png', deleted: false },
        // Moved by the save, which takes care of it
        { path: 'static/uploads/icon.png', deleted: false },
        { path: 'static/uploads/section.png', deleted: false },
        // Committed outside the CMS, which the publish check refuses instead
        { path: 'static/uploads/stray.png', deleted: false },
        // Already removed
        { path: 'static/uploads/gone.png', deleted: true },
      ];
      upsertUnpublishedEntry(pending);

      allAssets.current = [
        /** @type {any} */ ({
          path: 'static/uploads/first.webp',
          sha: 'f1',
          workflow: { branch: 'cms/posts/hello' },
        }),
        // Shadows the published version, which is put back
        /** @type {any} */ ({
          path: 'static/uploads/logo.png',
          sha: 'l2',
          workflow: {
            branch: 'cms/posts/hello',
            replacedAsset: { path: 'static/uploads/logo.png', sha: 'l1' },
          },
        }),
        /** @type {any} */ ({
          path: 'static/uploads/kept.png',
          sha: 'k1',
          workflow: { branch: 'cms/posts/hello' },
        }),
      ];

      const changes = [
        {
          action: 'update',
          path: 'content/posts/hello.md',
          slug: 'hello',
          data: 'image: static/uploads/second.webp\nphoto: static/uploads/kept.png',
        },
        { action: 'create', path: 'static/uploads/second.webp', slug: 'hello', data: new Blob() },
        {
          action: 'move',
          path: 'static/uploads/favicon.png',
          previousPath: 'static/uploads/icon.png',
          slug: 'hello',
        },
      ];

      workflowService.savePullRequest.mockImplementation(async () => ({
        commit: {
          sha: 'new',
          date: new Date('2026-01-01'),
          files: {
            'static/uploads/second.webp': { sha: 's1' },
            'static/uploads/logo.png': { sha: 'l1' },
          },
        },
        pullRequest: { ...pending.workflow.pullRequest },
      }));

      const { savedEntries } = await saveWorkflowChanges({
        ...args,
        changes,
        originalEntry: pending,
        savingEntry: {
          ...savingEntry,
          locales: {
            _default: {
              ...savingEntry.locales._default,
              content: {
                image: 'static/uploads/second.webp',
                photo: 'static/uploads/kept.png',
                icon: 'static/uploads/favicon.png',
              },
            },
          },
        },
        savingAssets: [{ path: 'static/uploads/second.webp', sha: 'local', name: 'second.webp' }],
      });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [
            ...changes,
            { action: 'delete', slug: 'hello', path: 'static/uploads/first.webp' },
            { action: 'update', slug: 'hello', path: 'static/uploads/logo.png', data: blob },
          ],
        }),
      );
      // The commit message and the title only describe what the user has done
      expect(promptCommitMessage).toHaveBeenCalledWith(changes, expect.anything());
      expect(createCommitMessage).toHaveBeenCalledWith(changes, expect.anything());
      expect(getAssetBlob).toHaveBeenCalledWith({ path: 'static/uploads/logo.png', sha: 'l1' });

      expect(
        allAssets.current.map((/** @type {any} */ a) => [a.path, a.sha, a.workflow?.branch]),
      ).toEqual([
        ['static/uploads/logo.png', 'l1', undefined],
        ['static/uploads/kept.png', 'k1', 'cms/posts/hello'],
        ['static/uploads/second.webp', 's1', 'cms/posts/hello'],
      ]);

      expect(
        /** @type {any} */ (savedEntries[0]).workflow.pullRequest.files
          .filter((/** @type {any} */ file) => file.path.startsWith('static/'))
          .map((/** @type {any} */ file) => [file.path, file.deleted]),
      ).toEqual([
        ['static/uploads/first.webp', true],
        ['static/uploads/logo.png', false],
        ['static/uploads/kept.png', false],
        ['static/uploads/icon.png', true],
        ['static/uploads/section.png', false],
        ['static/uploads/stray.png', false],
        ['static/uploads/gone.png', true],
        ['static/uploads/second.webp', false],
        ['static/uploads/favicon.png', false],
      ]);
    });

    test('leaves an asset it can’t put back on the branch, and saves anyway', async () => {
      const pending = createEntry('cms/posts/hello');

      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(createFileList).mockImplementation(classifyFiles);
      vi.mocked(getUsedAssetPaths).mockImplementation(findUsedAssetPaths);
      vi.mocked(resolveCacheDB).mockReturnValue(undefined);
      vi.mocked(getAssetBlob).mockRejectedValue(new Error('offline'));

      pending.locales._default.content = { logo: 'static/uploads/logo.png' };
      pending.workflow.pullRequest.files = [{ path: 'static/uploads/logo.png', deleted: false }];
      upsertUnpublishedEntry(pending);

      allAssets.current = [
        /** @type {any} */ ({
          path: 'static/uploads/logo.png',
          sha: 'l2',
          workflow: {
            branch: 'cms/posts/hello',
            replacedAsset: { path: 'static/uploads/logo.png', sha: 'l1' },
          },
        }),
      ];

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'new', date: new Date('2026-01-01'), files: {} },
        pullRequest: { ...pending.workflow.pullRequest },
      });

      await saveWorkflowChanges({ ...args, originalEntry: pending });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ changes: args.changes }),
      );
      expect(allAssets.current.map((/** @type {any} */ a) => a.sha)).toEqual(['l2']);
    });

    test('records the files of the commit on the pull request until it’s read again', async () => {
      // A publish right after the save checks the files against what the commit wrote
      const image = new File(['png'], 'image.png');

      workflowService.savePullRequest.mockResolvedValue({
        commit: {
          sha: 'new',
          date: new Date('2026-01-01'),
          files: {
            'content/posts/hello-world.md': { sha: 'entry-sha' },
            'content/pages/home.md': { sha: 'home-sha' },
            'static/image.png': { sha: 'image-sha' },
          },
        },
        pullRequest: {
          branch: 'cms/posts/hello',
          number: 1,
          status: 'draft',
          headSHA: 'old',
          files: [
            {
              path: 'content/posts/hello.md',
              sha: 'old-sha',
              size: 5,
              text: 'hello',
              deleted: false,
            },
            { path: 'static/kept.png', sha: 'kept-sha', size: 3, deleted: false },
          ],
        },
      });

      const results = await saveWorkflowChanges({
        ...args,
        changes: [
          {
            action: 'move',
            path: 'content/posts/hello-world.md',
            previousPath: 'content/posts/hello.md',
            data: 'hello world',
          },
          { action: 'update', path: 'content/pages/home.md', data: 'home' },
          { action: 'create', path: 'static/image.png', data: image },
          { action: 'delete', path: 'static/old.png' },
        ],
      });

      expect(/** @type {any} */ (results.savedEntries[0]).workflow.pullRequest).toMatchObject({
        headSHA: 'new',
        files: [
          { path: 'content/posts/hello.md', sha: '', size: 0, deleted: true },
          { path: 'static/kept.png', sha: 'kept-sha', size: 3, deleted: false },
          {
            path: 'content/posts/hello-world.md',
            sha: 'entry-sha',
            size: 11,
            text: 'hello world',
            deleted: false,
          },
          { path: 'content/pages/home.md', sha: 'home-sha', size: 4, text: 'home', deleted: false },
          { path: 'static/image.png', sha: 'image-sha', size: 3, text: undefined, deleted: false },
          { path: 'static/old.png', sha: '', size: 0, deleted: true },
        ],
      });
    });

    test('records a file the commit has no ID for with an empty one', async () => {
      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'new', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/posts/hello', number: 1, status: 'draft', files: [] },
      });

      const results = await saveWorkflowChanges({
        ...args,
        changes: [{ action: 'create', path: 'static/image.png', data: undefined }],
      });

      expect(/** @type {any} */ (results.savedEntries[0]).workflow.pullRequest.files).toEqual([
        { path: 'static/image.png', sha: '', size: 0, text: undefined, deleted: false },
      ]);
    });

    test('creates a pull request on the first save', async () => {
      const pullRequest = { branch: 'cms/posts/hello', number: 1, files: [], status: 'draft' };

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest,
      });

      const results = await saveWorkflowChanges(args);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/posts/hello',
          title: 'Create Post “hello”',
          pullRequest: undefined,
        }),
      );

      // The head commit is taken from the commit results, so the deploy preview lookup points at
      // the build for this save rather than the previous one
      expect(/** @type {any} */ (results.savedEntries[0]).workflow).toEqual({
        pullRequest: {
          ...pullRequest,
          headSHA: 'abc',
          files: [{ path: 'content/posts/hello.md', sha: '', size: 0, text: '', deleted: false }],
        },
        status: 'draft',
        collectionName: 'posts',
        fileName: undefined,
        previousPaths: [],
      });

      expect(results.savedAssets).toEqual([]);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(results.savedEntries[0]);
    });

    test('reuses the pull request after the slug has been edited', async () => {
      const existing = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(existing);

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'def', date: new Date('2026-01-02'), files: {} },
        pullRequest: existing.workflow.pullRequest,
      });

      // The new slug would derive `cms/posts/hello-2`, which no pull request matches
      await saveWorkflowChanges({
        ...args,
        slug: 'hello-2',
        savingEntry: { ...savingEntry, slug: 'hello-2', subPath: 'hello-2' },
        originalEntry: existing,
      });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/posts/hello',
          pullRequest: existing.workflow.pullRequest,
        }),
      );

      // Still a single entry, keyed by the original branch
      expect(allUnpublishedEntries.current).toHaveLength(1);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')?.subPath).toBe('hello-2');
    });

    test('encodes the slashes of a nested entry slug in the branch name', async () => {
      workflowService.savePullRequest.mockImplementation(
        async (/** @type {any} */ { branch, status }) => ({
          commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
          pullRequest: { branch, number: 1, files: [], status },
        }),
      );

      // A page and its sub-page can both be in draft: Git couldn’t hold a branch `cms/pages/about`
      // alongside `cms/pages/about/ethos`
      await saveWorkflowChanges({ ...args, collectionName: 'pages', slug: 'about' });

      await saveWorkflowChanges({
        ...args,
        collectionName: 'pages',
        slug: 'about/ethos',
        savingEntry: { ...savingEntry, id: 'new-2', slug: 'about/ethos', subPath: 'about/ethos' },
      });

      expect(workflowService.savePullRequest).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ branch: 'cms/pages/about', pullRequest: undefined }),
      );
      expect(workflowService.savePullRequest).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ branch: 'cms/pages/about%2Fethos', pullRequest: undefined }),
      );
      expect(allUnpublishedEntries.current).toHaveLength(2);
    });

    test('reuses a pull request whose branch keeps the slashes of the slug', async () => {
      // A branch created by Netlify/Decap CMS or an earlier version, before slashes were encoded
      const existing = createEntry('cms/pages/about/ethos');

      upsertUnpublishedEntry(existing);

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'def', date: new Date('2026-01-02'), files: {} },
        pullRequest: existing.workflow.pullRequest,
      });

      // The entry was opened from the published list, so it doesn’t carry the branch itself
      await saveWorkflowChanges({
        ...args,
        collectionName: 'pages',
        slug: 'about/ethos',
        savingEntry: { ...savingEntry, slug: 'about/ethos', subPath: 'about/ethos' },
        originalEntry: /** @type {any} */ ({
          id: 'p0',
          slug: 'about/ethos',
          locales: existing.locales,
        }),
      });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'cms/pages/about/ethos',
          pullRequest: existing.workflow.pullRequest,
        }),
      );

      expect(allUnpublishedEntries.current).toHaveLength(1);
    });

    test('captures the paths when a draft loaded without a rename is then renamed', async () => {
      // A pull request that hasn’t renamed anything yields an empty `previousPaths` on load
      const existing = createEntry('cms/posts/hello');

      existing.workflow.previousPaths = [];
      upsertUnpublishedEntry(existing);

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'def', date: new Date('2026-01-02'), files: {} },
        pullRequest: existing.workflow.pullRequest,
      });

      const results = await saveWorkflowChanges({
        ...args,
        slug: 'hello-2',
        savingEntry: {
          ...savingEntry,
          slug: 'hello-2',
          subPath: 'hello-2',
          locales: { _default: { path: 'content/posts/hello-2.md' } },
        },
        originalEntry: existing,
      });

      // The pre-rename path is recorded, so the entry list can still find the published version
      expect(/** @type {any} */ (results.savedEntries[0]).workflow.previousPaths).toEqual([
        'content/posts/hello.md',
      ]);
    });

    test('keeps the recorded paths once they are set', async () => {
      const existing = createEntry('cms/posts/hello');

      existing.workflow.previousPaths = ['content/posts/original.md'];
      upsertUnpublishedEntry(existing);

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'def', date: new Date('2026-01-02'), files: {} },
        pullRequest: existing.workflow.pullRequest,
      });

      const results = await saveWorkflowChanges({ ...args, originalEntry: existing });

      expect(/** @type {any} */ (results.savedEntries[0]).workflow.previousPaths).toEqual([
        'content/posts/original.md',
      ]);
    });

    test('starts a new pull request when the entry has no branch yet', async () => {
      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/posts/hello', number: 1, files: [], status: 'draft' },
      });

      // A published entry carries no workflow information
      await saveWorkflowChanges({
        ...args,
        originalEntry: /** @type {any} */ ({ id: 'p1', slug: 'hello', locales: {} }),
      });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'cms/posts/hello', pullRequest: undefined }),
      );
    });

    test('reuses the existing pull request and entry ID on subsequent saves', async () => {
      const existing = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(existing);

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'def', date: new Date('2026-01-02'), files: {} },
        pullRequest: existing.workflow.pullRequest,
      });

      // The published version of the entry was opened
      const results = await saveWorkflowChanges({
        ...args,
        originalEntry: /** @type {any} */ ({ id: 'p0', slug: 'hello', locales: existing.locales }),
      });

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequest: existing.workflow.pullRequest }),
      );

      expect(results.savedEntries[0].id).toBe(existing.id);
    });

    test('records the new entries of other collections committed along with the entry', async () => {
      const guides = createCompanion('guides');

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/posts/hello', number: 1, files: [], status: 'draft' },
      });

      const results = await saveWorkflowChanges({ ...args, companions: [guides] });

      expect(/** @type {any} */ (results.savedEntries[0]).workflow.companions).toEqual([guides]);
    });

    test('keeps the new entries an earlier save has committed to the pull request', async () => {
      const existing = createEntry('cms/posts/hello');
      const guides = createCompanion('guides');
      const help = createCompanion('help');

      existing.workflow.companions = [guides, help];
      upsertUnpublishedEntry(existing);

      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'def', date: new Date('2026-01-02'), files: {} },
        pullRequest: existing.workflow.pullRequest,
      });

      const results = await saveWorkflowChanges({ ...args, originalEntry: existing });

      expect(/** @type {any} */ (results.savedEntries[0]).workflow.companions).toEqual([
        guides,
        help,
      ]);

      // An entry committed again replaces its earlier version
      const updatedGuides = createCompanion('guides', 'Guides');
      const faq = createCompanion('faq');

      const resaved = await saveWorkflowChanges({
        ...args,
        originalEntry: existing,
        companions: [updatedGuides, faq],
      });

      expect(/** @type {any} */ (resaved.savedEntries[0]).workflow.companions).toEqual([
        help,
        updatedGuides,
        faq,
      ]);
    });

    test('throws when the backend doesn’t support the feature', async () => {
      /** @type {any} */ (backend).current = {};

      await expect(saveWorkflowChanges(args)).rejects.toThrow(
        'Editorial Workflow is not supported',
      );
    });
  });

  describe('updateWorkflowStatus', () => {
    test('updates the status and the store', async () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);

      const pullRequest = { ...entry.workflow.pullRequest, status: 'pending_review' };

      workflowService.updateStatus.mockResolvedValue(pullRequest);

      const updated = await updateWorkflowStatus(entry, 'pending_review');

      expect(workflowService.updateStatus).toHaveBeenCalledWith(
        entry.workflow.pullRequest,
        'pending_review',
      );

      expect(updated.workflow.status).toBe('pending_review');
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(updated);
    });

    test('updates the store before the request completes', async () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);

      /**
       * Resolve the pending backend request.
       * @type {(value: any) => void}
       */
      let resolveRequest = () => undefined;

      workflowService.updateStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      const promise = updateWorkflowStatus(entry, 'pending_publish');

      // The store already reflects the new status while the request is still in flight
      expect(getUnpublishedEntryByBranch('cms/posts/hello')?.workflow.status).toBe(
        'pending_publish',
      );

      resolveRequest({ ...entry.workflow.pullRequest, status: 'pending_publish' });
      await promise;

      expect(getUnpublishedEntryByBranch('cms/posts/hello')?.workflow.status).toBe(
        'pending_publish',
      );
    });

    test('rolls the store back when the request fails', async () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);
      workflowService.updateStatus.mockRejectedValue(new Error('API error'));

      await expect(updateWorkflowStatus(entry, 'pending_publish')).rejects.toThrow('API error');
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(entry);
    });

    test('moves an entry published since to the published list rather than rolling it back', async () => {
      // A maintainer merged the Open Authoring contributor’s request after the board was loaded,
      // and nothing was committed to the branch since
      const entry = createEntry('cms/contributor/repo/posts/hello', 'draft');

      upsertUnpublishedEntry(entry);

      allEntries.current = [
        /** @type {any} */ ({
          id: 'old',
          slug: 'hello',
          subPath: 'hello',
          locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
        }),
      ];
      workflowService.updateStatus.mockRejectedValue(new Error('entry_already_published'));

      await expect(updateWorkflowStatus(entry, 'pending_review')).rejects.toThrow(
        'entry_already_published',
      );

      expect(allUnpublishedEntries.current).toEqual([]);
      expect(allEntries.current.map((/** @type {any} */ e) => e.id)).toEqual([entry.id]);
      expect(/** @type {any} */ (allEntries.current[0]).workflow).toBeUndefined();
      // Nobody published it from here, so neither the hooks fire nor is the deployment tracked
      expect(callEventHooks).not.toHaveBeenCalled();
      expect(trackDeployingEntry).not.toHaveBeenCalled();
    });

    describe('approval', () => {
      /** The colleague who opened the pull request. */
      const colleague = { name: 'Alex', email: 'alex@example.com', login: 'alex' };

      /**
       * Create an unpublished entry whose pull request a colleague opened.
       * @param {string} status Workflow status.
       * @returns {any} Unpublished entry.
       */
      const createColleagueEntry = (status) => {
        const entry = createEntry('cms/posts/hello', status);

        Object.assign(entry.workflow.pullRequest, { author: colleague, headSHA: 'abc' });
        upsertUnpublishedEntry(entry);

        return entry;
      };

      beforeEach(() => {
        user.account = /** @type {any} */ ({ backendName: 'github', login: 'me' });
        workflowService.updateStatus.mockImplementation(async (pullRequest, status) => ({
          ...pullRequest,
          status,
        }));
      });

      afterEach(() => {
        user.account = undefined;
      });

      test.each(['draft', 'pending_review'])(
        'approves the pull request moved from %s to pending_publish',
        async (status) => {
          const entry = createColleagueEntry(status);

          await updateWorkflowStatus(entry, 'pending_publish');

          expect(workflowService.approve).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ number: 1, headSHA: 'abc', status: 'pending_publish' }),
          );
          // The pull request is out of the draft state by the time it’s approved
          expect(workflowService.updateStatus).toHaveBeenCalledBefore(workflowService.approve);
        },
      );

      test.each(['draft', 'pending_review'])(
        'withdraws the approval when the pull request moves from pending_publish to %s',
        async (status) => {
          await updateWorkflowStatus(
            createColleagueEntry('pending_publish'),
            /** @type {any} */ (status),
          );

          expect(workflowService.withdrawApproval).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ number: 1, files: [], status }),
          );
          expect(workflowService.approve).not.toHaveBeenCalled();
        },
      );

      test.each([
        ['draft', 'pending_review'],
        ['pending_review', 'draft'],
        ['pending_deletion', 'pending_publish'],
      ])('reviews nothing when the pull request moves from %s to %s', async (from, to) => {
        await updateWorkflowStatus(createColleagueEntry(from), /** @type {any} */ (to));

        expect(workflowService.approve).not.toHaveBeenCalled();
        expect(workflowService.withdrawApproval).not.toHaveBeenCalled();
      });

      test('doesn’t withdraw an approval of the user’s own pull request', async () => {
        const entry = createColleagueEntry('pending_publish');

        entry.workflow.pullRequest.author = { ...colleague, login: 'me' };
        await updateWorkflowStatus(entry, 'pending_review');

        expect(workflowService.withdrawApproval).not.toHaveBeenCalled();
      });

      test('keeps the status change when the withdrawal fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = new Error('Must have admin rights');

        workflowService.withdrawApproval.mockRejectedValueOnce(error);

        const updated = await updateWorkflowStatus(
          createColleagueEntry('pending_publish'),
          'pending_review',
        );

        expect(updated.workflow.status).toBe('pending_review');
        expect(warn).toHaveBeenCalledWith(
          'Failed to withdraw the approval of the pull request.',
          error,
        );
        warn.mockRestore();
      });

      test('doesn’t approve a pull request from a contributor’s fork', async () => {
        // The CMS has only shown the entry, not whatever else the contributor’s branch holds
        const entry = createColleagueEntry('pending_review');

        entry.workflow.pullRequest.fork = { owner: 'alice', repo: 'website', editable: true };
        await updateWorkflowStatus(entry, 'pending_publish');

        expect(workflowService.approve).not.toHaveBeenCalled();
      });

      test('doesn’t approve the user’s own pull request', async () => {
        const entry = createColleagueEntry('pending_review');

        entry.workflow.pullRequest.author = { ...colleague, login: 'me' };
        await updateWorkflowStatus(entry, 'pending_publish');

        expect(workflowService.approve).not.toHaveBeenCalled();
      });

      test('approves a pull request whose author is unknown', async () => {
        const entry = createColleagueEntry('pending_review');

        delete entry.workflow.pullRequest.author;
        await updateWorkflowStatus(entry, 'pending_publish');

        expect(workflowService.approve).toHaveBeenCalledOnce();
      });

      test('doesn’t approve with Open Authoring', async () => {
        forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'repo' });
        await updateWorkflowStatus(createColleagueEntry('pending_review'), 'pending_publish');

        expect(workflowService.approve).not.toHaveBeenCalled();
      });

      test('doesn’t approve a branch without a pull request', async () => {
        const entry = createColleagueEntry('pending_review');

        delete entry.workflow.pullRequest.number;
        await updateWorkflowStatus(entry, 'pending_publish');

        expect(workflowService.approve).not.toHaveBeenCalled();
      });

      test('keeps the status change when the approval fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = new Error('Can not approve');

        workflowService.approve.mockRejectedValueOnce(error);

        const updated = await updateWorkflowStatus(
          createColleagueEntry('pending_review'),
          'pending_publish',
        );

        expect(updated.workflow.status).toBe('pending_publish');
        expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(updated);
        expect(warn).toHaveBeenCalledWith('Failed to approve the pull request.', error);
        warn.mockRestore();
      });
    });

    test('keeps the entry in place rather than moving it to the end', async () => {
      const first = createEntry('cms/posts/a');
      const second = createEntry('cms/posts/b');

      [first, second].forEach(upsertUnpublishedEntry);
      workflowService.updateStatus.mockResolvedValue(first.workflow.pullRequest);

      await updateWorkflowStatus(first, 'pending_review');

      expect(allUnpublishedEntries.current.map((/** @type {any} */ e) => e.id)).toEqual([
        'cms/posts/a',
        'cms/posts/b',
      ]);
    });
  });

  describe('publishReviewedEntry', () => {
    test('publishes the entry once it’s checked to be the reviewed version', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');
      const reviewed = createEntry('cms/posts/hello', 'pending_publish');

      entry.workflow.pullRequest.headSHA = 'abc';
      reviewed.workflow.pullRequest.headSHA = 'abc';
      upsertUnpublishedEntry(entry);

      await publishReviewedEntry(entry, reviewed);

      expect(checkReviewedHead).toHaveBeenCalledWith(entry, 'abc');
      expect(workflowService.publish).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'cms/posts/hello', headSHA: 'abc' }),
      );
    });

    test('publishes nothing when the entry isn’t the reviewed version', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');
      const reviewed = createEntry('cms/posts/hello', 'pending_publish');
      const error = new Error('publish_refused');

      entry.workflow.pullRequest.headSHA = 'new';
      reviewed.workflow.pullRequest.headSHA = 'reviewed';
      upsertUnpublishedEntry(entry);
      vi.mocked(checkReviewedHead).mockImplementationOnce(() => {
        throw error;
      });

      await expect(publishReviewedEntry(entry, reviewed)).rejects.toBe(error);
      expect(checkReviewedHead).toHaveBeenCalledWith(entry, 'reviewed');
      expect(workflowService.publish).not.toHaveBeenCalled();
    });

    test('checks against no head when the reviewed version has no pull request', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');
      const { workflow: _workflow, ...published } = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);

      await publishReviewedEntry(entry, published);
      await publishReviewedEntry(entry, undefined);

      expect(vi.mocked(checkReviewedHead).mock.calls).toEqual([
        [entry, undefined],
        [entry, undefined],
      ]);
    });
  });

  describe('publishWorkflowEntry', () => {
    test('merges the pull request and moves the entry to the published list', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      upsertUnpublishedEntry(entry);

      allEntries.current = [
        /** @type {any} */ ({
          id: 'old',
          slug: 'hello',
          subPath: 'hello',
          locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
        }),
        /** @type {any} */ ({
          id: 'other',
          slug: 'other',
          subPath: 'other',
          locales: { _default: { slug: 'other', path: 'content/posts/other.md', content: {} } },
        }),
      ];

      await publishWorkflowEntry(entry);

      expect(workflowService.publish).toHaveBeenCalledWith(entry.workflow.pullRequest);
      expect(allUnpublishedEntries.current).toEqual([]);

      // The hooks bracket the merge
      expect(vi.mocked(callEventHooks).mock.calls.map(([{ type }]) => type)).toEqual([
        'prePublish',
        'postPublish',
      ]);

      const published = allEntries.current;

      // The stale published version is replaced, and the unrelated entry is kept
      expect(published.map((/** @type {any} */ e) => e.id)).toEqual(['other', entry.id]);
      expect(/** @type {any} */ (published.at(-1)).workflow).toBeUndefined();

      // The entry is listed as on its way to the site, once the branch head has been refreshed
      expect(refreshProductionSHA).toHaveBeenCalledBefore(vi.mocked(trackDeployingEntry));
      expect(trackDeployingEntry).toHaveBeenCalledWith(entry);
    });

    test('publishes the new entries riding along in the pull request with the entry', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');
      const guides = createCompanion('guides');

      entry.workflow.companions = [guides];
      upsertUnpublishedEntry(entry);

      allEntries.current = [
        /** @type {any} */ ({
          id: 'other',
          slug: 'other',
          subPath: 'other',
          locales: { _default: { slug: 'other', path: 'content/sections/other.md', content: {} } },
        }),
      ];

      await publishWorkflowEntry(entry);

      expect(allEntries.current.map((/** @type {any} */ e) => e.id)).toEqual([
        'other',
        entry.id,
        guides.entry.id,
      ]);
      expect(allEntries.current.at(-1)).toBe(guides.entry);
    });

    test('marks a draft pull request ready before merging it', async () => {
      // An entry is published from the drafting stage with Preview Workflow or direct publishing,
      // and the Git service refuses to merge a draft pull request
      const entry = createEntry('cms/posts/hello', 'draft');

      upsertUnpublishedEntry(entry);
      vi.mocked(workflowService.updateStatus).mockImplementation(async (pullRequest, status) => ({
        ...pullRequest,
        status,
      }));

      await publishWorkflowEntry(entry);

      expect(workflowService.updateStatus).toHaveBeenCalledWith(
        entry.workflow.pullRequest,
        'pending_publish',
      );
      expect(workflowService.updateStatus).toHaveBeenCalledBefore(
        vi.mocked(workflowService.publish),
      );
      expect(workflowService.publish).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'cms/posts/hello', status: 'pending_publish' }),
      );
      expect(allUnpublishedEntries.current).toEqual([]);
    });

    test('takes the assets a renaming pull request moved away off the asset list', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      upsertUnpublishedEntry(entry);
      allAssets.current = /** @type {any} */ ([
        // Published, and moved to the entry’s new folder by the pull request
        { path: 'content/posts/old/cover.jpg', sha: '1' },
        // The moved copy, committed to the branch
        {
          path: 'content/posts/hello/cover.jpg',
          sha: '1',
          workflow: { branch: 'cms/posts/hello', replacedAsset: undefined },
        },
        // Published, and deleted by the pull request, but shadowed by another draft
        {
          path: 'content/posts/old/photo.jpg',
          sha: '2',
          workflow: { branch: 'cms/posts/other', replacedAsset: { path: 'x', sha: '2' } },
        },
        // Untouched
        { path: 'static/uploads/logo.png', sha: '3' },
      ]);
      workflowService.fetchMergeState.mockResolvedValueOnce({
        headSHA: 'abc',
        onConfiguredBranches: true,
        files: /** @type {any} */ ([
          { path: 'content/posts/hello.md', status: 'added' },
          {
            path: 'content/posts/hello/cover.jpg',
            status: 'renamed',
            previousPath: 'content/posts/old/cover.jpg',
          },
          { path: 'content/posts/old/photo.jpg', status: 'removed' },
          { path: 'content/posts/hello/new.jpg', status: 'renamed' },
        ]),
        complete: true,
      });

      await publishWorkflowEntry(entry);

      // Deleting the old copy from the Asset Library would otherwise fail, as it’s gone
      expect(allAssets.current).toEqual([
        { path: 'content/posts/hello/cover.jpg', sha: '1' },
        // The other draft’s file has no published version to restore anymore
        { path: 'content/posts/old/photo.jpg', sha: '2', workflow: { branch: 'cms/posts/other' } },
        { path: 'static/uploads/logo.png', sha: '3' },
      ]);
    });

    test('takes the assets a removing pull request deleted off the asset list', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_deletion');

      upsertUnpublishedEntry(entry);
      allAssets.current = /** @type {any} */ ([
        { path: 'content/posts/hello/cover.jpg', sha: '1' },
        { path: 'static/uploads/logo.png', sha: '3' },
      ]);
      workflowService.fetchMergeState.mockResolvedValueOnce({
        headSHA: 'abc',
        onConfiguredBranches: true,
        files: /** @type {any} */ ([
          { path: 'content/posts/hello.md', status: 'removed' },
          { path: 'content/posts/hello/cover.jpg', status: 'removed' },
        ]),
        complete: true,
      });

      await publishWorkflowEntry(entry);

      expect(allAssets.current).toEqual([{ path: 'static/uploads/logo.png', sha: '3' }]);
    });

    test('checks the pull request against the entry before anything else happens', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      await publishWorkflowEntry(entry);

      expect(workflowService.fetchMergeState).toHaveBeenCalledWith(entry.workflow.pullRequest);
      expect(verifyMergeState).toHaveBeenCalledWith(
        entry,
        { headSHA: 'abc', onConfiguredBranches: true, files: [], complete: true },
        workflowService.fetchUnchangedPaths,
      );
      expect(verifyMergeState).toHaveBeenCalledBefore(vi.mocked(callEventHooks));
    });

    test('neither merges nor fires the hooks once the check has refused the publish', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      upsertUnpublishedEntry(entry);
      vi.mocked(verifyMergeState).mockRejectedValueOnce(new Error('publish_refused'));

      await expect(publishWorkflowEntry(entry)).rejects.toThrow('publish_refused');

      expect(callEventHooks).not.toHaveBeenCalled();
      expect(workflowService.publish).not.toHaveBeenCalled();
      // The entry stays where it was, and can be published again
      expect(allUnpublishedEntries.current).toEqual([entry]);
      expect(publishingBranches.current).toEqual([]);
    });

    test('refuses to merge a pull request from a contributor’s fork', async () => {
      const entry = createEntry('alice/repo:cms/alice/repo/posts/hello', 'pending_publish');

      entry.workflow.pullRequest.fork = { owner: 'alice', repo: 'repo', editable: true };
      upsertUnpublishedEntry(entry);

      await expect(publishWorkflowEntry(entry)).rejects.toThrow(
        'A pull request from a fork cannot be published from the CMS.',
      );

      expect(workflowService.fetchMergeState).not.toHaveBeenCalled();
      expect(workflowService.publish).not.toHaveBeenCalled();
      expect(allUnpublishedEntries.current).toEqual([entry]);
    });

    test('records the entry as being published while the merge is in flight', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      const { promise: merging, resolve: merge } = /** @type {PromiseWithResolvers<void>} */ (
        Promise.withResolvers()
      );

      workflowService.publish.mockReturnValueOnce(merging);

      const promise = publishWorkflowEntry(entry);

      // Recorded right away, so a view opened during the wait shows the entry as busy
      expect(publishingBranches.current).toEqual(['cms/posts/hello']);

      merge();
      await promise;

      expect(publishingBranches.current).toEqual([]);
    });

    test('forgets the entry once the merge has failed', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      workflowService.publish.mockRejectedValueOnce(new Error('Boom'));

      await expect(publishWorkflowEntry(entry)).rejects.toThrow('Boom');

      expect(publishingBranches.current).toEqual([]);
    });

    test('joins a merge already in flight rather than starting another', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');
      const otherEntry = createEntry('cms/posts/other', 'pending_publish');

      const { promise: merging, resolve: merge } = /** @type {PromiseWithResolvers<void>} */ (
        Promise.withResolvers()
      );

      workflowService.publish.mockReturnValueOnce(merging);

      const first = publishWorkflowEntry(entry);
      const second = publishWorkflowEntry(entry);
      // Another entry’s merge is a separate one
      const other = publishWorkflowEntry(otherEntry);

      expect(publishingBranches.current).toEqual(['cms/posts/hello', 'cms/posts/other']);
      // The merge is requested once the pre-publish hook has run
      await vi.waitFor(() => expect(workflowService.publish).toHaveBeenCalledTimes(2));

      merge();
      await Promise.all([first, second, other]);

      // The hooks fired once for the joined merge, and once for the other one
      expect(vi.mocked(callEventHooks).mock.calls.map(([{ type }]) => type)).toEqual([
        'prePublish',
        'prePublish',
        'postPublish',
        'postPublish',
      ]);
      expect(publishingBranches.current).toEqual([]);

      // A later publish is a new one
      await publishWorkflowEntry(entry);

      expect(workflowService.publish).toHaveBeenCalledTimes(3);
    });
  });

  describe('publish event hooks', () => {
    test('are called with the entry and its collection', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      upsertUnpublishedEntry(entry);
      await publishWorkflowEntry(entry);

      expect(callEventHooks).toHaveBeenCalledWith({
        type: 'prePublish',
        entry,
        collection: { name: 'posts', _type: 'entry' },
        collectionFile: undefined,
      });
    });

    test('resolve the collection file for a file collection', async () => {
      const { getCollectionFile } = await import('$lib/services/contents/collection/files');
      const collectionFile = /** @type {any} */ ({ name: 'site' });
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      entry.workflow.fileName = 'site';
      vi.mocked(getCollectionFile).mockReturnValue(collectionFile);
      upsertUnpublishedEntry(entry);
      await publishWorkflowEntry(entry);

      expect(callEventHooks).toHaveBeenCalledWith(expect.objectContaining({ collectionFile }));
    });

    test('are called for the new entries riding along in the pull request', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');
      const guides = createCompanion('guides');
      const sections = { name: 'sections', _type: 'entry' };

      entry.workflow.companions = [guides, { ...createCompanion('gone'), collectionName: 'gone' }];
      // Looked up for the post first, then for each of the new entries
      vi.mocked(getCollection)
        .mockReturnValueOnce(/** @type {any} */ ({ name: 'posts', _type: 'entry' }))
        .mockReturnValueOnce(/** @type {any} */ (sections))
        .mockReturnValueOnce(undefined);
      upsertUnpublishedEntry(entry);
      await publishWorkflowEntry(entry);

      // An entry whose collection is no longer configured has no hook to call
      expect(
        vi.mocked(callEventHooks).mock.calls.map(([{ type, entry: e }]) => [type, e.id]),
      ).toEqual([
        ['prePublish', entry.id],
        ['prePublish', guides.entry.id],
        ['postPublish', entry.id],
        ['postPublish', guides.entry.id],
      ]);
      expect(callEventHooks).toHaveBeenCalledWith({
        type: 'postPublish',
        entry: guides.entry,
        collection: sections,
      });
    });

    test('are skipped when the collection is no longer configured', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      vi.mocked(getCollection).mockReturnValue(undefined);
      upsertUnpublishedEntry(entry);
      await publishWorkflowEntry(entry);

      // The merge still happens; only the hooks are skipped
      expect(workflowService.publish).toHaveBeenCalled();
      expect(callEventHooks).not.toHaveBeenCalled();
    });
  });
});
