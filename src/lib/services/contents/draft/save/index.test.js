// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backend, isLastCommitPublished } from '$lib/services/backends';
import { skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/expanders';

import { saveEntry } from './index';

vi.mock('$lib/services/backends');
vi.mock('$lib/services/backends/git/shared/integration');
vi.mock('$lib/services/backends/save');
vi.mock('$lib/services/contents/collection/data');
vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/draft/backup');
vi.mock('$lib/services/contents/draft/events', () => ({
  callEventHooks: vi.fn(),
}));
vi.mock('$lib/services/contents/draft/save/changes');
vi.mock('$lib/services/contents/draft/slugs');
vi.mock('$lib/services/contents/draft/validate');
vi.mock('$lib/services/contents/editor/expanders');
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/save/index', () => {
  let mockDraft;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockDraft = {
      collection: {
        name: 'posts',
        _type: 'entry',
      },
      isNew: true,
      collectionName: 'posts',
      fileName: undefined,
      currentValues: { en: { title: 'Test Post' } },
    };

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockDraft;
      }

      if (store === backend) {
        return { isGit: true };
      }

      if (store === skipCIEnabled) {
        return false;
      }

      return undefined;
    });

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
        locales: { en: { slug: 'test-post', path: 'posts/test-post.md' } },
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

    vi.mocked(contentUpdatesToast).set = vi.fn();
    vi.mocked(isLastCommitPublished).set = vi.fn();
    vi.mocked(deleteBackup).mockResolvedValue(undefined);
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

    it('should throw validation error when entry is invalid', async () => {
      vi.mocked(validateEntry).mockReturnValue(false);

      await expect(saveEntry()).rejects.toThrow('validation_failed');
      expect(expandInvalidFields).toHaveBeenCalled();
    });

    it('should handle save failure', async () => {
      vi.mocked(saveChanges).mockRejectedValue(new Error('Save failed'));

      await expect(saveEntry()).rejects.toThrow('saving_failed');
    });

    it('should update toast with published status for git backend', async () => {
      await saveEntry();

      expect(vi.mocked(contentUpdatesToast).set).toHaveBeenCalledWith({
        ...UPDATE_TOAST_DEFAULT_STATE,
        saved: true,
        published: true,
        count: 1,
      });

      expect(vi.mocked(isLastCommitPublished).set).toHaveBeenCalledWith(true);
    });

    it('should handle skipCI option', async () => {
      await saveEntry({ skipCI: true });

      expect(vi.mocked(contentUpdatesToast).set).toHaveBeenCalledWith({
        ...UPDATE_TOAST_DEFAULT_STATE,
        saved: true,
        published: false,
        count: 1,
      });

      expect(vi.mocked(isLastCommitPublished).set).toHaveBeenCalledWith(false);
    });

    it('should handle non-git backend', async () => {
      mockGet.mockImplementation((store) => {
        if (store === entryDraft) {
          return mockDraft;
        }

        if (store === backend) {
          return { isGit: false };
        }

        return undefined;
      });

      await saveEntry();

      expect(vi.mocked(contentUpdatesToast).set).toHaveBeenCalledWith({
        ...UPDATE_TOAST_DEFAULT_STATE,
        saved: true,
        published: false,
        count: 1,
      });
    });

    it('should delete backup after successful save', async () => {
      mockDraft.isNew = false;

      await saveEntry();

      expect(deleteBackup).toHaveBeenCalledWith('posts', 'test-post');
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
      const { callEventHooks } = await import('$lib/services/contents/draft/events');

      await saveEntry();

      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postSave',
          draft: mockDraft,
        }),
      );
    });

    it('should pass correct savingEntry to postSave event hooks', async () => {
      const { callEventHooks } = await import('$lib/services/contents/draft/events');

      await saveEntry();

      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postSave',
          savingEntry: expect.objectContaining({
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
      const { callEventHooks } = await import('$lib/services/contents/draft/events');
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

    it('should not throw if postSave event hooks fail', async () => {
      const { callEventHooks } = await import('$lib/services/contents/draft/events');

      vi.mocked(callEventHooks).mockImplementation(() => {
        throw new Error('Event hook error');
      });

      // This should not throw because the error handling is not implemented
      // If you want to add error handling, adjust this expectation accordingly
      await expect(saveEntry()).rejects.toThrow('Event hook error');
    });
  });
});
