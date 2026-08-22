import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { callEventHooks } from '$lib/services/api/events';
import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { getCommitAuthor } from '$lib/services/backends/save';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { unpublishedEntries } from '$lib/services/workflow';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import {
  deleteWorkflowEntries,
  deleteWorkflowEntry,
  discardWorkflowEntries,
  discardWorkflowEntry,
  getUnpublishedEntryByBranch,
  publishWorkflowEntry,
  removeUnpublishedEntry,
  saveWorkflowChanges,
  updateWorkflowStatus,
  upsertUnpublishedEntry,
} from '$lib/services/workflow/save';

vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));
vi.mock('$lib/services/api/events');
vi.mock('$lib/services/backends', () => ({ backend: { subscribe: vi.fn() } }));
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry' })),
}));
vi.mock('$lib/services/contents/collection/files', () => ({ getCollectionFile: vi.fn() }));
vi.mock('$lib/services/backends/git/shared/commits');
vi.mock('$lib/services/backends/save');

const workflowService = {
  fetchPullRequests: vi.fn(),
  savePullRequest: vi.fn(),
  updateStatus: vi.fn(),
  publish: vi.fn(),
  discard: vi.fn(),
};

/**
 * Create a minimal unpublished entry for testing.
 * @param {string} branch Branch name.
 * @param {string} [status] Workflow status.
 * @returns {any} Unpublished entry.
 */
const createEntry = (branch, status = 'draft') => ({
  id: branch,
  slug: 'hello',
  subPath: 'hello',
  locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
  workflow: {
    pullRequest: { branch, number: 1, status },
    status,
    collectionName: 'posts',
    fileName: undefined,
  },
});

/**
 * Read the current value of a real Svelte store, bypassing the mocked `get`.
 * @param {any} store Store.
 * @returns {any} Value.
 */
const getStoreValue = (store) => {
  let value;

  store.subscribe((/** @type {any} */ v) => {
    value = v;
  })();

  return value;
};

describe('workflow/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unpublishedEntries.set([]);
    allEntries.set([]);
    forkedRepository.set(undefined);

    vi.mocked(get).mockImplementation((store) =>
      store === backend ? { workflow: workflowService } : getStoreValue(store),
    );
  });

  describe('store helpers', () => {
    test('upserts and finds an entry by branch', () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(entry);

      const updated = createEntry('cms/posts/hello', 'pending_review');

      upsertUnpublishedEntry(updated);
      expect(getStoreValue(unpublishedEntries)).toHaveLength(1);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(updated);
    });

    test('removes an entry by branch', () => {
      upsertUnpublishedEntry(createEntry('cms/posts/hello'));
      upsertUnpublishedEntry(createEntry('cms/posts/world'));
      removeUnpublishedEntry('cms/posts/hello');

      expect(getStoreValue(unpublishedEntries)).toHaveLength(1);
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

    test('registers the committed assets so they can be previewed right away', async () => {
      workflowService.savePullRequest.mockResolvedValue({
        commit: {
          sha: 'abc',
          date: new Date('2026-01-01'),
          files: { 'static/img.png': { sha: 'blob-sha' } },
        },
        pullRequest: { branch: 'cms/posts/hello', number: 1, status: 'draft' },
      });

      allAssets.set([
        /** @type {any} */ ({ path: 'static/img.png', sha: 'stale' }),
        /** @type {any} */ ({ path: 'static/other.png' }),
      ]);

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
        getStoreValue(allAssets).map((/** @type {any} */ a) => [a.path, a.sha, a.workflow?.branch]),
      ).toEqual([
        ['static/img.png', 'blob-sha', 'cms/posts/hello'],
        ['static/other.png', undefined, undefined],
      ]);

      expect(getStoreValue(allAssets)[0].workflow.replacedAsset).toEqual({
        path: 'static/img.png',
        sha: 'stale',
      });
    });

    test('falls back to the locally computed asset SHA', async () => {
      workflowService.savePullRequest.mockResolvedValue({
        commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        pullRequest: { branch: 'cms/posts/hello', number: 1, status: 'draft' },
      });

      const results = await saveWorkflowChanges({
        ...args,
        savingAssets: [{ path: 'static/img.png', sha: 'local', name: 'img.png' }],
      });

      expect(results.savedAssets[0].sha).toBe('local');
    });

    test('creates a pull request on the first save', async () => {
      const pullRequest = { branch: 'cms/posts/hello', number: 1, status: 'draft' };

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

      expect(/** @type {any} */ (results.savedEntries[0]).workflow).toEqual({
        pullRequest,
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
      expect(getStoreValue(unpublishedEntries)).toHaveLength(1);
      expect(getUnpublishedEntryByBranch('cms/posts/hello')?.subPath).toBe('hello-2');
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
        pullRequest: { branch: 'cms/posts/hello', number: 1, status: 'draft' },
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

      const results = await saveWorkflowChanges(args);

      expect(workflowService.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequest: existing.workflow.pullRequest }),
      );

      expect(results.savedEntries[0].id).toBe(existing.id);
    });

    test('throws when the backend doesn’t support the feature', async () => {
      vi.mocked(get).mockImplementation((store) => (store === backend ? {} : undefined));

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

    test('keeps the entry in place rather than moving it to the end', async () => {
      const first = createEntry('cms/posts/a');
      const second = createEntry('cms/posts/b');

      [first, second].forEach(upsertUnpublishedEntry);
      workflowService.updateStatus.mockResolvedValue(first.workflow.pullRequest);

      await updateWorkflowStatus(first, 'pending_review');

      expect(getStoreValue(unpublishedEntries).map((/** @type {any} */ e) => e.id)).toEqual([
        'cms/posts/a',
        'cms/posts/b',
      ]);
    });
  });

  describe('publishWorkflowEntry', () => {
    test('merges the pull request and moves the entry to the published list', async () => {
      const entry = createEntry('cms/posts/hello', 'pending_publish');

      upsertUnpublishedEntry(entry);

      allEntries.set([
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
      ]);

      await publishWorkflowEntry(entry);

      expect(workflowService.publish).toHaveBeenCalledWith(entry.workflow.pullRequest);
      expect(getStoreValue(unpublishedEntries)).toEqual([]);

      // The hooks bracket the merge
      expect(vi.mocked(callEventHooks).mock.calls.map(([{ type }]) => type)).toEqual([
        'prePublish',
        'postPublish',
      ]);

      const published = getStoreValue(allEntries);

      // The stale published version is replaced, and the unrelated entry is kept
      expect(published.map((/** @type {any} */ e) => e.id)).toEqual(['other', entry.id]);
      expect(published.at(-1).workflow).toBeUndefined();
    });
  });

  describe('deleteWorkflowEntry', () => {
    const collection = /** @type {any} */ ({ name: 'posts', _type: 'entry' });

    test('refuses to take a published entry off the site for a contributor', async () => {
      // Discarding their own draft leaves the published version alone and stays available; removing
      // something already live is a maintainer’s call
      forkedRepository.set({ owner: 'contributor', repo: 'repo' });

      await expect(
        deleteWorkflowEntry(
          /** @type {any} */ ({ slug: 'hello', locales: { _default: { path: 'p.md' } } }),
          collection,
          undefined,
        ),
      ).rejects.toThrow('Cannot delete a published entry as an Open Authoring contributor');
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

      // The backend opens the pull request at the status it was asked for
      // A new pull request opens at the status it was asked for; an existing one is returned as is
      workflowService.savePullRequest.mockImplementation(
        async (/** @type {any} */ { status, pullRequest }) => ({
          pullRequest: pullRequest ?? { branch: 'cms/posts/hello', number: 7, status },
          commit: { sha: 'abc', date: new Date('2026-01-01'), files: {} },
        }),
      );

      workflowService.updateStatus.mockImplementation(
        async (/** @type {any} */ pr, /** @type {any} */ status) => ({ ...pr, status }),
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

      expect(getStoreValue(unpublishedEntries)).toEqual([unpublishedEntry]);

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

      // The entry list matches the removal against where the entry sits on the configured branch
      expect(entry.workflow.previousPaths).toEqual(['content/posts/hello.md']);
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

      allEntries.set([
        entry,
        /** @type {any} */ ({
          id: 'other',
          slug: 'other',
          subPath: 'other',
          locales: { _default: { slug: 'other', path: 'content/posts/other.md', content: {} } },
        }),
      ]);

      const unpublishedEntry = await deleteWorkflowEntry(entry, collection, undefined);

      await publishWorkflowEntry(unpublishedEntry);

      expect(getStoreValue(allEntries).map((/** @type {any} */ e) => e.id)).toEqual(['other']);
      expect(getStoreValue(unpublishedEntries)).toEqual([]);
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

  describe('discardWorkflowEntry', () => {
    test('closes the pull request and removes the entry', async () => {
      const entry = createEntry('cms/posts/hello');

      upsertUnpublishedEntry(entry);
      await discardWorkflowEntry(entry);

      expect(workflowService.discard).toHaveBeenCalledWith(entry.workflow.pullRequest);
      expect(getStoreValue(unpublishedEntries)).toEqual([]);
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
      expect(getStoreValue(unpublishedEntries).map((/** @type {any} */ e) => e.id)).toEqual([
        'cms/posts/c',
      ]);
    });

    test('does nothing for an empty list', async () => {
      await discardWorkflowEntries([]);
      expect(workflowService.discard).not.toHaveBeenCalled();
    });
  });
});
