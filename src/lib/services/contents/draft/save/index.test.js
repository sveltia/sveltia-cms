// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callEventHooks } from '$lib/services/api/events';
import { lockedBranch } from '$lib/services/backends/branch-access';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { getCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { cancelBackup, deleteBackup, getBackupSlug } from '$lib/services/contents/draft/backup';
import { buildEntryAssetMoveChanges } from '$lib/services/contents/draft/save/asset-move';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { detectEntryConflict } from '$lib/services/contents/draft/save/conflict';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';
import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';
import { clearEntryHistoryCache } from '$lib/services/contents/entry/history';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { assignAutoIncrementValues } from '$lib/services/contents/fields/number/auto-increment';
import { setLastCommitPublishHint } from '$lib/services/deployments';
import {
  getUnpublishedEntryByDraft,
  isWorkflowDraft,
  unpublishedEntries,
} from '$lib/services/workflow';
import { saveWorkflowChanges } from '$lib/services/workflow/save';

import { saveEntry as _saveEntry } from '.';

vi.mock('$lib/services/backends');
vi.mock('$lib/services/backends/git/shared/integration', () => ({
  skipCIConfigured: { current: false },
  skipCIEnabled: { current: false },
}));
vi.mock('$lib/services/backends/save');
vi.mock('$lib/services/contents/collection', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getCollection: vi.fn(),
}));
vi.mock('$lib/services/contents/collection/data', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  contentUpdatesToast: { current: undefined },
}));
vi.mock('$lib/services/contents/collection/entries/reorder/config', () => ({
  getOrderFieldKey: vi.fn(() => undefined),
}));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/draft/backup');
vi.mock('$lib/services/api/events', () => ({
  callEventHooks: vi.fn(),
}));
vi.mock('$lib/services/contents/draft/save/asset-move', () => ({
  buildEntryAssetMoveChanges: vi.fn(async () => ({ changes: [], savingAssets: [] })),
}));
vi.mock('$lib/services/contents/draft/save/changes', async (importOriginal) => {
  const { removeDisabledLocales, preparePendingEntryCommit } = /** @type {any} */ (
    await importOriginal()
  );

  return {
    createSavingEntryData: vi.fn(),
    // The real ones, so the entries the stores and the hooks get can be checked
    removeDisabledLocales,
    preparePendingEntryCommit,
  };
});
vi.mock('$lib/services/contents/draft/save/conflict');
vi.mock('$lib/services/contents/draft/slugs');
vi.mock('$lib/services/contents/draft/validate');
vi.mock('$lib/services/contents/editor/fields');
vi.mock('$lib/services/contents/editor/pending');
vi.mock('$lib/services/contents/entry/history');
vi.mock('$lib/services/contents/fields/date-time/auto-now');
vi.mock('$lib/services/contents/fields/number/auto-increment');
vi.mock('$lib/services/deployments');
vi.mock('$lib/services/workflow', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getUnpublishedEntryByDraft: vi.fn(),
  isWorkflowDraft: vi.fn(),
  unpublishedEntries: { current: undefined },
}));
vi.mock('$lib/services/workflow/branch', () => ({
  getBranchName: vi.fn(({ collectionName, slug }) => `cms/${collectionName}/${slug}`),
}));
vi.mock('$lib/services/workflow/save');
vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: {},
}));
describe('draft/save/index', () => {
  let mockDraft;
  /**
   * Save the mock draft.
   * @param {object} [options] Options other than the draft.
   * @returns {Promise<any>} Saved entry.
   */
  const saveEntry = (options = {}) => _saveEntry({ draft: mockDraft, ...options });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockDraft = {
      collection: {
        name: 'posts',
        _type: 'entry',
      },
      isNew: true,
      collectionName: 'posts',
      fileName: undefined,
      currentValues: { en: { title: 'Test Post' } },
      extraValues: { en: {} },
      pendingEntries: [],
    };

    /** @type {any} */ (skipCIConfigured).current = true;
    /** @type {any} */ (skipCIEnabled).current = false;
    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(undefined);
    unpublishedEntries.current = [];

    vi.mocked(validateEntry).mockReturnValue(true);
    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: 'test-post',
      canonicalSlug: undefined,
      localizedSlugs: undefined,
    });

    vi.mocked(createSavingEntryData).mockResolvedValue({
      savingEntry: {
        id: 'test-id',
        slug: 'test-post',
        locales: {
          en: { slug: 'test-post', path: 'posts/test-post.md', content: { title: 'Test Post' } },
        },
      },
      changes: [],
      savingAssets: [],
    });

    vi.mocked(saveChanges).mockResolvedValue({
      savedEntries: [
        {
          id: 'test-id',
          slug: 'test-post',
          locales: { en: { slug: 'test-post', path: 'posts/test-post.md' } },
        },
      ],
      savedAssets: [],
    });

    vi.mocked(callEventHooks).mockResolvedValue(undefined);
    contentUpdatesToast.current = /** @type {any} */ (undefined);
    vi.mocked(deleteBackup).mockResolvedValue(undefined);
    // Same as the actual implementation: the file name, or the slug the entry had when opened
    vi.mocked(getBackupSlug).mockImplementation(
      ({ fileName, originalEntry }) => fileName ?? originalEntry?.slug ?? '',
    );
  });

  describe('saveEntry', () => {
    it('should save a valid entry', async () => {
      const result = await saveEntry();

      expect(validateEntry).toHaveBeenCalled();
      expect(getSlugs).toHaveBeenCalledWith({ draft: mockDraft });
      expect(createSavingEntryData).toHaveBeenCalled();
      expect(saveChanges).toHaveBeenCalled();
      expect(result.slug).toBe('test-post');
    });

    it('should save through Editorial Workflow when enabled', async () => {
      vi.mocked(isWorkflowDraft).mockReturnValue(true);

      vi.mocked(saveWorkflowChanges).mockResolvedValue({
        commit: { sha: 'abc', files: {} },
        savedEntries: [
          {
            id: 'test-id',
            slug: 'test-post',
            locales: { en: { slug: 'test-post', path: 'posts/test-post.md' } },
          },
        ],
        savedAssets: [],
      });

      const result = await saveEntry();

      expect(saveChanges).not.toHaveBeenCalled();
      expect(saveWorkflowChanges).toHaveBeenCalledWith(
        expect.objectContaining({ collectionName: 'posts', slug: 'test-post' }),
      );

      expect(result.slug).toBe('test-post');

      // Nothing is published yet, because the changes only exist in a pull request
      expect(vi.mocked(setLastCommitPublishHint)).toHaveBeenCalledWith(false);
    });

    it('should refuse to save a read-only entry', async () => {
      mockDraft.collection.readonly = true;

      await expect(saveEntry()).rejects.toThrow('saving_failed');
      expect(validateEntry).not.toHaveBeenCalled();
      expect(saveChanges).not.toHaveBeenCalled();
      expect(saveWorkflowChanges).not.toHaveBeenCalled();
    });

    it('should refuse to save an entry to a branch the user can’t push to', async () => {
      lockedBranch.current = 'main';

      try {
        const error = await saveEntry().catch((/** @type {Error} */ ex) => ex);

        expect(error).toBeInstanceOf(Error);
        expect(/** @type {Error} */ (error).cause).toEqual(new Error('readonly_branch'));
        expect(saveChanges).not.toHaveBeenCalled();
      } finally {
        lockedBranch.current = undefined;
      }
    });

    it('should decide on the workflow per draft', async () => {
      // A collection can opt in or out of Editorial Workflow with its own `publish_mode` option,
      // and an entry that already has a pull request stays in it
      await saveEntry();

      expect(isWorkflowDraft).toHaveBeenCalledWith(mockDraft);
    });

    describe('required field enforcement', () => {
      /**
       * Make the mocked stores report that Editorial Workflow is enabled.
       */
      const enableWorkflow = () => {
        vi.mocked(isWorkflowDraft).mockReturnValue(true);
        unpublishedEntries.current = [];

        vi.mocked(saveWorkflowChanges).mockResolvedValue({
          commit: { sha: 'abc', files: {} },
          savedEntries: [
            {
              id: 'test-id',
              slug: 'test-post',
              locales: { en: { slug: 'test-post', path: 'posts/test-post.md' } },
            },
          ],
          savedAssets: [],
        });
      };

      it('should enforce required fields without Editorial Workflow', async () => {
        await saveEntry();

        expect(validateEntry).toHaveBeenCalledWith({ draft: mockDraft, enforceRequired: true });
      });

      it('should not enforce required fields for a new Editorial Workflow entry', async () => {
        enableWorkflow();
        await saveEntry();

        expect(validateEntry).toHaveBeenCalledWith({ draft: mockDraft, enforceRequired: false });
      });

      it('should not enforce required fields for an entry still in the drafting stage', async () => {
        enableWorkflow();
        mockDraft.isNew = false;
        mockDraft.originalEntry = {
          id: 'test-id',
          slug: 'test-post',
          locales: { _default: { path: 'content/posts/test-post.md' } },
          workflow: { status: 'draft', pullRequest: { branch: 'cms/posts/test-post' } },
        };
        await saveEntry();

        expect(validateEntry).toHaveBeenCalledWith({ draft: mockDraft, enforceRequired: false });
      });

      it('should enforce required fields for an entry that has left the drafting stage', async () => {
        enableWorkflow();
        mockDraft.isNew = false;
        mockDraft.originalEntry = {
          id: 'test-id',
          slug: 'test-post',
          locales: { _default: { path: 'content/posts/test-post.md' } },
          workflow: { status: 'pending_review', pullRequest: { branch: 'cms/posts/test-post' } },
        };
        await saveEntry();

        expect(validateEntry).toHaveBeenCalledWith({ draft: mockDraft, enforceRequired: true });
      });

      it('should enforce required fields for a draft being published', async () => {
        enableWorkflow();
        await saveEntry({ publish: true });

        expect(validateEntry).toHaveBeenCalledWith({ draft: mockDraft, enforceRequired: true });
      });
    });

    describe('direct publishing', () => {
      it('should commit a draft without a pull request straight to the branch', async () => {
        vi.mocked(isWorkflowDraft).mockReturnValue(true);
        unpublishedEntries.current = [];

        await saveEntry({ publish: true });

        expect(saveChanges).toHaveBeenCalled();
        expect(saveWorkflowChanges).not.toHaveBeenCalled();
      });

      it('should save a draft with a pull request to it, for the caller to merge', async () => {
        vi.mocked(isWorkflowDraft).mockReturnValue(true);
        mockDraft.isNew = false;
        mockDraft.originalEntry = {
          id: 'test-id',
          slug: 'test-post',
          locales: { _default: { path: 'content/posts/test-post.md' } },
          workflow: { status: 'draft', pullRequest: { branch: 'cms/posts/test-post' } },
        };
        vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(mockDraft.originalEntry);
        vi.mocked(saveWorkflowChanges).mockResolvedValue({
          commit: { sha: 'abc', files: {} },
          savedEntries: [mockDraft.originalEntry],
          savedAssets: [],
        });

        await saveEntry({ publish: true });

        expect(saveWorkflowChanges).toHaveBeenCalled();
        expect(saveChanges).not.toHaveBeenCalled();
      });
    });

    it('should wait for pending field updates before validating', async () => {
      /** @type {string[]} */
      const order = [];

      vi.mocked(awaitPendingFieldUpdates).mockImplementation(async () => {
        order.push('await');
      });
      vi.mocked(validateEntry).mockImplementation(() => {
        order.push('validate');

        return true;
      });

      await saveEntry();

      expect(order).toEqual(['await', 'validate']);
    });

    it('should throw validation error when entry is invalid', async () => {
      vi.mocked(validateEntry).mockReturnValue(false);

      await expect(saveEntry()).rejects.toThrow('validation_failed');
      expect(expandInvalidFields).toHaveBeenCalledWith({ draft: mockDraft });
      // Nothing is fetched for a draft that can’t be saved anyway
      expect(detectEntryConflict).not.toHaveBeenCalled();
      // The draft isn’t touched either
      expect(assignAutoNowValues).not.toHaveBeenCalled();
    });

    it('should set the auto-now DateTime fields before working out the changes', async () => {
      const order = [];

      vi.mocked(assignAutoNowValues).mockImplementation(() => {
        order.push('autoNow');
      });
      vi.mocked(getSlugs).mockImplementation(() => {
        order.push('slugs');

        return { defaultLocaleSlug: 'test-post' };
      });

      await saveEntry();

      expect(assignAutoNowValues).toHaveBeenCalledWith(mockDraft);
      expect(order).toEqual(['autoNow', 'slugs']);
    });

    it('should number the auto-increment Number fields before creating the slugs', async () => {
      const order = [];

      mockDraft.collection = { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } };
      // Entries added to the same collection from a Relation field took the next numbers
      mockDraft.pendingEntries = [
        { collectionName: 'posts', values: [] },
        { collectionName: 'tags', values: [] },
      ];
      vi.mocked(assignAutoIncrementValues).mockImplementation(() => {
        order.push('autoIncrement');
      });
      vi.mocked(getSlugs).mockImplementation(() => {
        order.push('slugs');

        return { defaultLocaleSlug: 'test-post' };
      });

      await saveEntry();

      expect(assignAutoIncrementValues).toHaveBeenCalledWith(mockDraft, 1);
      expect(order).toEqual(['autoIncrement', 'slugs']);
    });

    it('should not set the auto-now DateTime fields when refusing to save over a change', async () => {
      vi.mocked(detectEntryConflict).mockResolvedValue({ type: 'modified', entry: { id: 'x' } });

      await expect(saveEntry()).rejects.toThrow('save_conflict');
      expect(assignAutoNowValues).not.toHaveBeenCalled();
    });

    it('should refuse to save over someone else’s change unless told to', async () => {
      const conflict = { type: 'modified', entry: { id: 'test-id' } };

      vi.mocked(detectEntryConflict).mockResolvedValue(conflict);

      const error = await saveEntry().catch((ex) => ex);

      expect(error.message).toBe('save_conflict');
      expect(error.cause).toBe(conflict);
      expect(detectEntryConflict).toHaveBeenCalledWith(mockDraft);
      expect(createSavingEntryData).not.toHaveBeenCalled();
      expect(saveChanges).not.toHaveBeenCalled();

      await saveEntry({ overwrite: true });

      expect(saveChanges).toHaveBeenCalledTimes(1);
    });

    it('should write an entry someone else has deleted anew when saving over the deletion', async () => {
      const originalEntry = {
        id: 'test-id',
        slug: 'old-post',
        locales: { en: { slug: 'old-post', path: 'posts/old-post.md', content: {} } },
      };

      mockDraft.isNew = false;
      mockDraft.originalEntry = originalEntry;
      vi.mocked(detectEntryConflict).mockResolvedValue({ type: 'deleted', canOverwrite: true });

      await saveEntry({ overwrite: true });

      // The files and the assets stored with them are gone, so nothing can be updated, moved or
      // deleted: the files are created as for a new entry
      expect(createSavingEntryData).toHaveBeenCalledWith(
        expect.objectContaining({ recreate: true }),
      );
      expect(buildEntryAssetMoveChanges).toHaveBeenCalledWith(
        expect.objectContaining({ originalEntry: undefined }),
      );
      expect(vi.mocked(saveChanges).mock.calls[0][0].options.commitType).toBe('create');
    });

    it('should update an entry someone else has changed when saving over the change', async () => {
      const originalEntry = {
        id: 'test-id',
        slug: 'test-post',
        locales: { en: { slug: 'test-post', path: 'posts/test-post.md', content: {} } },
      };

      mockDraft.isNew = false;
      mockDraft.originalEntry = originalEntry;
      vi.mocked(detectEntryConflict).mockResolvedValue({ type: 'modified', canOverwrite: true });

      await saveEntry({ overwrite: true });

      expect(createSavingEntryData).toHaveBeenCalledWith(
        expect.objectContaining({ recreate: false }),
      );
      expect(buildEntryAssetMoveChanges).toHaveBeenCalledWith(
        expect.objectContaining({ originalEntry }),
      );
      expect(vi.mocked(saveChanges).mock.calls[0][0].options.commitType).toBe('update');
    });

    it('should keep checking the item of an entry in an array file when overwriting', async () => {
      const locales = { en: { path: 'data/members.json', content: { title: 'A' } } };

      // The item at the position may be another entry that has moved there, so it’s still checked
      mockDraft.isNew = false;
      mockDraft.originalEntry = { id: 'test-id', slug: '1', arrayIndex: 1, locales };
      vi.mocked(detectEntryConflict).mockResolvedValue({ type: 'modified', entry: { id: 'x' } });
      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: { id: 'test-id', slug: '1', arrayIndex: 1, locales },
        changes: [
          { action: 'update', path: 'data/members.json', arrayItem: { index: 1, locales } },
        ],
        savingAssets: [],
      });

      await saveEntry({ overwrite: true });

      const { changes } = vi.mocked(saveChanges).mock.calls[0][0];

      expect(changes[0].arrayItem).toEqual({ index: 1, locales });
    });

    it('should save when there is no conflict', async () => {
      vi.mocked(detectEntryConflict).mockResolvedValue(undefined);

      await saveEntry();

      expect(detectEntryConflict).toHaveBeenCalledWith(mockDraft);
      expect(saveChanges).toHaveBeenCalled();
    });

    it('should not look for a conflict for an Editorial Workflow draft', async () => {
      vi.mocked(isWorkflowDraft).mockReturnValue(true);
      vi.mocked(saveWorkflowChanges).mockResolvedValue({
        commit: { sha: 'abc', files: {} },
        savedEntries: [{ id: 'test-id', slug: 'test-post', locales: {} }],
        savedAssets: [],
      });

      await saveEntry();

      expect(detectEntryConflict).not.toHaveBeenCalled();
    });

    it('should leave the locales turned off out of the saved entry', async () => {
      const deletion = { action: 'delete', slug: 'test-post', path: 'posts/test-post.fr.md' };

      mockDraft.isNew = false;
      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: {
          id: 'test-id',
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: 'posts/test-post.en.md', content: { title: 'A' } },
            // A locale turned off only carries the path of the file to delete
            fr: { path: 'posts/test-post.fr.md' },
          },
        },
        changes: [deletion],
        savingAssets: [],
      });

      await saveEntry();

      const { changes, savingEntries } = vi.mocked(saveChanges).mock.calls[0][0];

      // The file is still deleted, but the entry in the stores no longer has it
      expect(changes).toEqual([deletion]);
      expect(Object.keys(savingEntries[0].locales)).toEqual(['en']);
      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postSave',
          entry: expect.objectContaining({ locales: { en: expect.any(Object) } }),
        }),
      );
    });

    it('should leave the locales turned off out of the Editorial Workflow entry', async () => {
      vi.mocked(isWorkflowDraft).mockReturnValue(true);
      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: {
          id: 'test-id',
          slug: 'test-post',
          locales: {
            en: { slug: 'test-post', path: 'posts/test-post.en.md', content: { title: 'A' } },
            // Turned on and off again before the first save, so there has never been a file
            fr: { path: 'posts/test-post.fr.md' },
          },
        },
        changes: [],
        savingAssets: [],
      });
      vi.mocked(saveWorkflowChanges).mockResolvedValue({
        commit: { sha: 'abc', files: {} },
        savedEntries: [{ id: 'test-id', slug: 'test-post', locales: {} }],
        savedAssets: [],
      });

      await saveEntry();

      const { savingEntry } = vi.mocked(saveWorkflowChanges).mock.calls[0][0];

      expect(Object.keys(savingEntry.locales)).toEqual(['en']);
    });

    it('should name the Editorial Workflow branch of a new nested entry after its path', async () => {
      vi.mocked(isWorkflowDraft).mockReturnValue(true);
      // The slug template only gives the last segment of the path of a new entry in a nested
      // collection, which another entry in another folder can have as well
      vi.mocked(getSlugs).mockReturnValue({
        defaultLocaleSlug: 'team',
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      });
      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: {
          id: 'test-id',
          slug: 'about/team',
          subPath: 'about/team',
          locales: {
            en: { slug: 'about/team', path: 'pages/about/team/index.md', content: { title: 'A' } },
          },
        },
        changes: [],
        savingAssets: [],
      });
      vi.mocked(saveWorkflowChanges).mockResolvedValue({
        commit: { sha: 'abc', files: {} },
        savedEntries: [{ id: 'test-id', slug: 'about/team', locales: {} }],
        savedAssets: [],
      });

      await saveEntry();

      expect(saveWorkflowChanges).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'about/team' }),
      );
    });

    it('should handle save failure', async () => {
      vi.mocked(saveChanges).mockRejectedValue(new Error('Save failed'));

      await expect(saveEntry()).rejects.toThrow('saving_failed');
    });

    it('should fail without saving when an entry file cannot be formatted', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const formatError = new Error(
        'Entries in the custom “csv” format can’t be saved, as no `toFile` method was registered ' +
          'for it with `CMS.registerCustomFormat()`',
      );

      vi.mocked(createSavingEntryData).mockRejectedValue(formatError);

      // The original error is the cause, so its message can be shown to the user
      await expect(saveEntry()).rejects.toThrow(
        expect.objectContaining({ message: 'saving_failed', cause: formatError }),
      );
      expect(errorSpy).toHaveBeenCalledWith(formatError);
      expect(saveChanges).not.toHaveBeenCalled();
      expect(callEventHooks).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'postSave' }),
      );
      errorSpy.mockRestore();
    });

    it('should update toast with published status for git backend', async () => {
      await saveEntry();

      expect(contentUpdatesToast.current).toEqual({
        ...UPDATE_TOAST_DEFAULT_STATE,
        saved: true,
        published: true,
        count: 1,
      });

      expect(vi.mocked(setLastCommitPublishHint)).toHaveBeenCalledWith(true);
    });

    it('should handle skipCI option', async () => {
      await saveEntry({ skipCI: true });

      expect(contentUpdatesToast.current).toEqual({
        ...UPDATE_TOAST_DEFAULT_STATE,
        saved: true,
        published: false,
        count: 1,
      });

      expect(vi.mocked(setLastCommitPublishHint)).toHaveBeenCalledWith(false);
    });

    it('should handle non-git backend', async () => {
      /** @type {any} */ (skipCIConfigured).current = false;

      await saveEntry();

      expect(contentUpdatesToast.current).toEqual({
        ...UPDATE_TOAST_DEFAULT_STATE,
        saved: true,
        published: false,
        count: 1,
      });
    });

    it('should delete backup after successful save', async () => {
      mockDraft.isNew = false;
      mockDraft.originalEntry = { id: 'test-id', slug: 'test-post', locales: {} };

      await saveEntry();

      expect(deleteBackup).toHaveBeenCalledWith('posts', 'test-post');
    });

    it('should delete the backup stored under the original slug after a rename', async () => {
      mockDraft.isNew = false;
      mockDraft.originalEntry = { id: 'test-id', slug: 'old-post', locales: {} };

      await saveEntry();

      // The backup was made under the slug the entry had when it was opened, not the new one
      expect(deleteBackup).toHaveBeenCalledWith('posts', 'old-post');
      expect(deleteBackup).not.toHaveBeenCalledWith('posts', 'test-post');
    });

    it('should delete the backup of a new file collection entry stored under the file name', async () => {
      mockDraft.fileName = 'about';

      await saveEntry();

      expect(deleteBackup).toHaveBeenCalledWith('posts', 'about');
    });

    it('should delete backup before running the post-save hooks', async () => {
      /** @type {string[]} */
      const calls = [];

      vi.mocked(deleteBackup).mockImplementation(async () => {
        calls.push('deleteBackup');
      });
      vi.mocked(callEventHooks).mockImplementation(async () => {
        calls.push('callEventHooks');
      });

      await saveEntry();

      expect(calls[0]).toBe('deleteBackup');
      expect(calls).toContain('callEventHooks');
    });

    it('should drop a backup scheduled before the save as the backup is deleted', async () => {
      /** @type {string[]} */
      const calls = [];

      vi.mocked(cancelBackup).mockImplementation(() => {
        calls.push('cancelBackup');
      });
      vi.mocked(deleteBackup).mockImplementation(async () => {
        calls.push('deleteBackup');
      });

      await saveEntry();

      // Otherwise the backup scheduled for the last change could be made once the save has deleted
      // the backup, e.g. while the editor asks whether to send the entry for review
      expect(calls).toEqual(['cancelBackup', 'deleteBackup']);
    });

    it('should keep a scheduled backup if save fails', async () => {
      vi.mocked(saveChanges).mockRejectedValue(new Error('Save failed'));

      await expect(saveEntry()).rejects.toThrow('saving_failed');

      expect(cancelBackup).not.toHaveBeenCalled();
    });

    it('should complete the save even if the backup cannot be deleted', async () => {
      const error = new DOMException('Store missing', 'NotFoundError');
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(deleteBackup).mockRejectedValue(error);

      try {
        await expect(saveEntry()).resolves.toBeDefined();
        expect(callEventHooks).toHaveBeenCalled();
        expect(contentUpdatesToast.current.saved).toBe(true);
        expect(consoleError).toHaveBeenCalledWith(error);
      } finally {
        consoleError.mockRestore();
      }
    });

    it('should pass on a cancelled commit as it is, keeping the backup', async () => {
      const cancelled = new Error('commit_cancelled');
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(saveChanges).mockRejectedValue(cancelled);

      try {
        await expect(saveEntry()).rejects.toBe(cancelled);
        expect(consoleError).not.toHaveBeenCalled();
        expect(deleteBackup).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    });

    it('should keep backup if save fails', async () => {
      vi.mocked(saveChanges).mockRejectedValue(new Error('Save failed'));

      await expect(saveEntry()).rejects.toThrow('saving_failed');

      expect(deleteBackup).not.toHaveBeenCalled();
    });

    it('should delete backup for new entry with empty slug', async () => {
      mockDraft.isNew = true;

      await saveEntry();

      // New entries have backup stored with empty slug
      expect(deleteBackup).toHaveBeenCalledWith('posts', '');
    });

    it('should handle update operation', async () => {
      mockDraft.isNew = false;

      await saveEntry();

      expect(saveChanges).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            commitType: 'update',
          }),
        }),
      );
    });

    it('should handle create operation', async () => {
      mockDraft.isNew = true;

      await saveEntry();

      expect(saveChanges).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            commitType: 'create',
          }),
        }),
      );
    });

    it('should call postSave event hooks after successful save', async () => {
      await saveEntry();

      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postSave',
          collection: mockDraft.collection,
        }),
      );
    });

    it('should pass correct savingEntry to postSave event hooks', async () => {
      await saveEntry();

      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postSave',
          entry: expect.objectContaining({
            id: 'test-id',
            slug: 'test-post',
            locales: expect.objectContaining({
              en: expect.any(Object),
            }),
          }),
        }),
      );
    });

    it('should call postSave hooks after saveChanges completes', async () => {
      let saveChangesCallOrder = 0;
      let callEventHooksCallOrder = 0;

      vi.mocked(saveChanges).mockImplementation(() => {
        saveChangesCallOrder = 1;

        return Promise.resolve({
          savedEntries: [
            {
              id: 'test-id',
              slug: 'test-post',
              locales: { en: { slug: 'test-post', path: 'posts/test-post.md' } },
            },
          ],
          savedAssets: [],
        });
      });

      vi.mocked(callEventHooks).mockImplementation(() => {
        callEventHooksCallOrder = 2;
      });

      await saveEntry();

      // callEventHooks should be called after saveChanges
      expect(callEventHooksCallOrder).toBe(2);
      expect(saveChangesCallOrder).toBe(1);
    });

    it('should clear entry history cache when originalEntry exists', async () => {
      mockDraft.originalEntry = { id: 'original-entry-id' };

      await saveEntry();

      expect(clearEntryHistoryCache).toHaveBeenCalledWith('original-entry-id');
    });

    it('should not clear entry history cache when originalEntry is absent', async () => {
      mockDraft.originalEntry = undefined;

      await saveEntry();

      expect(clearEntryHistoryCache).not.toHaveBeenCalled();
    });
  });

  describe('manual sort order assignment', () => {
    beforeEach(() => {
      mockDraft.collection = {
        name: 'posts',
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
      };
      mockDraft.collectionFile = undefined;
      mockDraft.currentValues = { en: { title: 'Test Post' }, ja: { title: 'テスト' } };
      vi.mocked(getOrderFieldKey).mockReturnValue(undefined);
      vi.mocked(getEntriesByCollection).mockReturnValue([]);
    });

    it('should assign max + 1 to all locales when saving a new entry in a reorder collection', async () => {
      mockDraft.isNew = true;
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { order: 1 } } } },
        { locales: { en: { content: { order: 5 } } } },
        { locales: { en: { content: { order: 3 } } } },
      ]);

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBe(6);
      expect(mockDraft.currentValues.ja.order).toBe(6);
    });

    it('should assign 1 when no existing entries have a numeric order', async () => {
      mockDraft.isNew = true;
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([]);

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBe(1);
    });

    it('should ignore non-numeric existing order values', async () => {
      mockDraft.isNew = true;
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { order: 'abc' } } } },
        { locales: { en: { content: {} } } },
        { locales: { en: { content: { order: 2 } } } },
      ]);

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBe(3);
    });

    it('should overwrite a stale order value already on the draft (race-safe)', async () => {
      mockDraft.isNew = true;
      mockDraft.currentValues.en.order = 5;
      mockDraft.currentValues.ja.order = 5;
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { order: 5 } } } },
        { locales: { en: { content: { order: 6 } } } },
      ]);

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBe(7);
      expect(mockDraft.currentValues.ja.order).toBe(7);
    });

    it('should put a new entry after the entries added from its Relation field', async () => {
      mockDraft.isNew = true;
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { order: 5 } } } },
      ]);

      /**
       * Create a pending entry, as added from a Relation field of the entry being edited.
       * @param {string} collectionName Collection name.
       * @param {number} [order] Order the entry was given when it was added.
       * @returns {any} Pending entry.
       */
      const createPendingEntry = (collectionName, order) => ({
        collectionName,
        entry: { locales: { en: { content: { order } } } },
        values: [],
        changes: [],
        savingAssets: [],
      });

      // Entries added to the same collection took the orders after the highest one, 6 and 7
      mockDraft.pendingEntries = [
        createPendingEntry('posts', 6),
        createPendingEntry('tags'),
        createPendingEntry('posts', 7),
      ];

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBe(8);
      expect(mockDraft.currentValues.ja.order).toBe(8);
    });

    it('should use the configured custom order key', async () => {
      mockDraft.isNew = true;
      vi.mocked(getOrderFieldKey).mockReturnValue('priority');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { priority: 10 } } } },
      ]);

      await saveEntry();

      expect(mockDraft.currentValues.en.priority).toBe(11);
    });

    it('should not assign order for existing entries', async () => {
      mockDraft.isNew = false;
      mockDraft.currentValues.en.order = 7;
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { order: 99 } } } },
      ]);

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBe(7);
    });

    it('should not assign order when reorder is disabled', async () => {
      mockDraft.isNew = true;
      vi.mocked(getOrderFieldKey).mockReturnValue(undefined);

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBeUndefined();
    });

    it('should not assign order for file collections', async () => {
      mockDraft.isNew = true;
      mockDraft.collection._type = 'file';
      vi.mocked(getOrderFieldKey).mockReturnValue('order');

      await saveEntry();

      expect(mockDraft.currentValues.en.order).toBeUndefined();
    });

    it('should use collectionFile i18n when provided', async () => {
      mockDraft.isNew = true;
      mockDraft.collection._i18n = { defaultLocale: 'en' };
      mockDraft.collectionFile = { _i18n: { defaultLocale: 'ja' } };
      vi.mocked(getOrderFieldKey).mockReturnValue('order');
      vi.mocked(getEntriesByCollection).mockReturnValue([
        { locales: { en: { content: { order: 1 } }, ja: { content: { order: 9 } } } },
      ]);

      await saveEntry();

      // Reads from `ja` (collectionFile defaultLocale), so max = 9 → next = 10.
      expect(mockDraft.currentValues.en.order).toBe(10);
    });
  });

  describe('pending entries', () => {
    const tagCollection = { name: 'tags', _type: 'entry' };

    /**
     * Build a pending entry.
     * @param {string} slug Slug.
     * @returns {any} Pending entry.
     */
    const createPendingEntry = (slug) => ({
      collectionName: 'tags',
      entry: { id: `id-${slug}`, slug, subPath: slug, locales: {} },
      changes: [{ action: 'create', path: `tags/${slug}.md`, data: `title: ${slug}` }],
      savingAssets: [{ path: `uploads/${slug}.png` }],
      values: [slug],
    });

    beforeEach(() => {
      vi.mocked(getOrderFieldKey).mockReturnValue(undefined);
      vi.mocked(getCollection).mockReturnValue(/** @type {any} */ (tagCollection));
      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: {
          id: 'test-id',
          slug: 'test-post',
          locales: { en: { slug: 'test-post', path: 'posts/test-post.md' } },
        },
        changes: [{ action: 'create', path: 'posts/test-post.md', data: 'title: Test Post' }],
        savingAssets: [{ path: 'uploads/hero.png' }],
      });
    });

    it('should commit the referenced pending entries along with the entry', async () => {
      const svelte = createPendingEntry('svelte');
      const react = createPendingEntry('react');

      mockDraft.currentValues = { en: { title: 'Test Post', 'tags.0': 'svelte' } };
      mockDraft.pendingEntries = [svelte, react];

      await saveEntry();

      expect(saveChanges).toHaveBeenCalledWith({
        changes: [
          { action: 'create', path: 'posts/test-post.md', data: 'title: Test Post' },
          ...svelte.changes,
        ],
        savingEntries: [expect.objectContaining({ id: 'test-id' }), svelte.entry],
        savingAssets: [{ path: 'uploads/hero.png' }, ...svelte.savingAssets],
        options: expect.objectContaining({ commitType: 'create' }),
      });

      expect(callEventHooks).toHaveBeenCalledWith({
        type: 'postSave',
        entry: svelte.entry,
        collection: tagCollection,
        isNew: true,
      });
      expect(callEventHooks).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'postSave', entry: react.entry }),
      );
      expect(getCollection).toHaveBeenCalledWith('tags');
      expect(contentUpdatesToast.current).toEqual(expect.objectContaining({ count: 2 }));
    });

    it('should call the preSave event hooks of the pending entries once they’re committed', async () => {
      const svelte = createPendingEntry('svelte');

      mockDraft.currentValues = { en: { title: 'Test Post', 'tags.0': 'svelte' } };
      mockDraft.pendingEntries = [svelte];

      await saveEntry();

      // The hooks of the entry being edited are called by the mocked `createSavingEntryData()`
      expect(callEventHooks).toHaveBeenCalledWith({
        type: 'preSave',
        entry: svelte.entry,
        collection: tagCollection,
        isNew: true,
      });
      expect(vi.mocked(callEventHooks).mock.calls.map(([{ type }]) => type)).toEqual([
        'preSave',
        'postSave',
        'postSave',
      ]);
      expect(saveChanges).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.arrayContaining(svelte.changes) }),
      );
    });

    it('should leave the pending entries out of the Editorial Workflow entry', async () => {
      const svelte = createPendingEntry('svelte');

      mockDraft.currentValues = { en: { title: 'Test Post', 'tags.0': 'svelte' } };
      mockDraft.pendingEntries = [svelte];
      vi.mocked(isWorkflowDraft).mockReturnValue(true);

      vi.mocked(saveWorkflowChanges).mockResolvedValue({
        commit: { sha: 'abc', files: {} },
        savedEntries: [{ id: 'test-id', slug: 'test-post', locales: {} }],
        savedAssets: [],
      });

      await saveEntry();

      // The changes go into the pull request, while the tracked entry is the one being edited
      expect(saveWorkflowChanges).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.arrayContaining(svelte.changes),
          savingEntry: expect.objectContaining({ id: 'test-id' }),
          savingAssets: expect.arrayContaining(svelte.savingAssets),
        }),
      );
    });
  });
});
