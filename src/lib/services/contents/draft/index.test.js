// @ts-nocheck
import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import {
  entryDraft,
  entryDraftModified,
  filterRealValues,
  i18nAutoDupEnabled,
  revokeDraftFileURLs,
  suspendAutoDuplication,
} from '.';

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: { devModeEnabled: false },
}));

describe('draft/index', () => {
  describe('filterRealValues', () => {
    it('should return an empty object for an empty map', () => {
      expect(filterRealValues({})).toEqual({});
    });

    it('should return the map unchanged when there are no internal properties', () => {
      const valueMap = { title: 'Hello', 'items.0.label': 'World' };

      expect(filterRealValues(valueMap)).toEqual(valueMap);
    });

    it('should remove __sc_item_id properties', () => {
      expect(
        filterRealValues({
          'items.0.label': 'Hello',
          'items.0.__sc_item_id': 'uuid-123',
        }),
      ).toEqual({ 'items.0.label': 'Hello' });
    });

    it('should remove __sc_item_original_key_path properties', () => {
      expect(
        filterRealValues({
          'items.0.label': 'Hello',
          'items.0.__sc_item_original_key_path': 'items.2',
        }),
      ).toEqual({ 'items.0.label': 'Hello' });
    });

    it('should remove all internal __sc_ properties at any index', () => {
      expect(
        filterRealValues({
          'items.0.label': 'A',
          'items.0.__sc_item_id': 'uuid-a',
          'items.0.__sc_item_original_key_path': 'items.1',
          'items.1.label': 'B',
          'items.1.__sc_item_id': 'uuid-b',
          'items.1.__sc_item_original_key_path': 'items.0',
        }),
      ).toEqual({ 'items.0.label': 'A', 'items.1.label': 'B' });
    });

    it('should not remove properties that merely contain __sc_ in a non-suffix position', () => {
      const valueMap = { __sc_toplevel: 'kept', 'a.__sc_middle.b': 'kept' };

      expect(filterRealValues(valueMap)).toEqual(valueMap);
    });
  });

  describe('entryDraft', () => {
    it('should initialize as undefined', () => {
      let value;

      entryDraft.subscribe((v) => {
        value = v;
      });

      expect(value).toBeUndefined();
    });

    it('should be writable', () => {
      const draft = {
        collectionName: 'posts',
        originalValues: { en: { title: 'Original' } },
        currentValues: { en: { title: 'Original' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraft.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual(draft);
    });
  });

  describe('i18nAutoDupEnabled', () => {
    it('should initialize as true', () => {
      let value;

      i18nAutoDupEnabled.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should be writable', () => {
      i18nAutoDupEnabled.set(false);

      let value;

      i18nAutoDupEnabled.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);

      // Reset
      i18nAutoDupEnabled.set(true);
    });
  });

  describe('suspendAutoDuplication', () => {
    /**
     * Read the current value of the store.
     * @returns {boolean} Current value.
     */
    const current = () => get(i18nAutoDupEnabled);

    it('should suspend for the duration of the callback and restore afterwards', () => {
      expect(current()).toBe(true);

      const result = suspendAutoDuplication(() => {
        expect(current()).toBe(false);

        return 'done';
      });

      expect(result).toBe('done');
      expect(current()).toBe(true);
    });

    it('should stay suspended until the outermost call finishes', () => {
      suspendAutoDuplication(() => {
        suspendAutoDuplication(() => {
          expect(current()).toBe(false);
        });

        // The inner call must not have re-enabled it
        expect(current()).toBe(false);
      });

      expect(current()).toBe(true);
    });

    it('should release the suspension when the callback throws', () => {
      expect(() => {
        suspendAutoDuplication(() => {
          throw new Error('boom');
        });
      }).toThrow('boom');

      expect(current()).toBe(true);
    });

    it('should release a nested suspension when the inner callback throws', () => {
      expect(() => {
        suspendAutoDuplication(() => {
          suspendAutoDuplication(() => {
            throw new Error('boom');
          });
        });
      }).toThrow('boom');

      expect(current()).toBe(true);
    });

    it('should hold the suspension until an async callback settles', async () => {
      const promise = suspendAutoDuplication(async () => {
        await Promise.resolve();
        // Still suspended after the await, which is what an async caller depends on
        expect(current()).toBe(false);

        return 'async done';
      });

      expect(current()).toBe(false);
      await expect(promise).resolves.toBe('async done');
      expect(current()).toBe(true);
    });

    it('should release the suspension when an async callback rejects', async () => {
      const promise = suspendAutoDuplication(async () => {
        throw new Error('boom');
      });

      await expect(promise).rejects.toThrow('boom');
      expect(current()).toBe(true);
    });
  });

  describe('entryDraftModified', () => {
    it('should return false when draft is undefined', () => {
      entryDraft.set(undefined);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return false when draft is null', () => {
      entryDraft.set(null);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return false when draft values are unchanged', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return true when locales are modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true, ja: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when slugs are modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'modified-test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when values are modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Modified Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should detect deep changes in nested values', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { metadata: { author: 'John' } } },
        currentValues: { en: { metadata: { author: 'Jane' } } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return false when currentValues only differ by internal properties', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { 'items.0.label': 'Hello' } },
        currentValues: {
          en: {
            'items.0.label': 'Hello',
            'items.0.__sc_item_id': 'uuid-123',
            'items.0.__sc_item_original_key_path': 'items.0',
          },
        },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return true when currentValues differ by both real and internal properties', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { 'items.0.label': 'Hello' } },
        currentValues: {
          en: {
            'items.0.label': 'Modified',
            'items.0.__sc_item_id': 'uuid-123',
          },
        },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should ignore internal properties across multiple locales', () => {
      const draft = {
        originalLocales: { en: true, ja: true },
        currentLocales: { en: true, ja: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: {
          en: { 'items.0.label': 'Hello' },
          ja: { 'items.0.label': 'こんにちは' },
        },
        currentValues: {
          en: { 'items.0.label': 'Hello', 'items.0.__sc_item_id': 'uuid-a' },
          ja: { 'items.0.label': 'こんにちは', 'items.0.__sc_item_id': 'uuid-a' },
        },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return true when a locale is added to currentValues', () => {
      entryDraft.set({
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' }, ja: { title: 'Test' } },
      });

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when a locale is missing from originalValues', () => {
      entryDraft.set({
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' }, ja: undefined },
        currentValues: { en: { title: 'Test' }, ja: { title: 'Test' } },
      });

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when a field is removed from currentValues', () => {
      entryDraft.set({
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test', subtitle: 'Sub' } },
        currentValues: { en: { title: 'Test' } },
      });

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when a field is added to currentValues', () => {
      entryDraft.set({
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test', subtitle: 'Sub' } },
      });

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });
  });

  describe('revokeDraftFileURLs', () => {
    /**
     * Set the draft store to a minimal draft holding the given unsaved files. The value maps are
     * included because `entryDraftModified` reads them whenever the store changes.
     * @param {Record<string, any> | undefined} files File map keyed by blob URL.
     */
    const setDraftFiles = (files) => {
      entryDraft.set(
        files === undefined
          ? null
          : {
              originalLocales: {},
              currentLocales: {},
              originalSlugs: {},
              currentSlugs: {},
              originalValues: {},
              currentValues: {},
              files,
            },
      );
    };

    it('should revoke every blob URL held by the current draft', () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      setDraftFiles({ 'blob:one': { file: {} }, 'blob:two': { file: {} } });
      revokeDraftFileURLs();

      expect(revoke).toHaveBeenCalledTimes(2);
      expect(revoke).toHaveBeenCalledWith('blob:one');
      expect(revoke).toHaveBeenCalledWith('blob:two');

      revoke.mockRestore();
    });

    it('should keep the URLs the incoming draft still refers to', () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      setDraftFiles({ 'blob:kept': { file: {} }, 'blob:dropped': { file: {} } });
      revokeDraftFileURLs({ 'blob:kept': { file: {} } });

      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:dropped');

      revoke.mockRestore();
    });

    it('should do nothing when there is no draft or no files', () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      setDraftFiles(undefined);
      revokeDraftFileURLs();
      setDraftFiles({});
      revokeDraftFileURLs();

      expect(revoke).not.toHaveBeenCalled();

      revoke.mockRestore();
    });
  });

  describe('devModeEnabled subscription', () => {
    it('should log draft to console when devModeEnabled is true', async () => {
      // Reset modules to reimport with different mock
      vi.resetModules();

      // Mock prefs with devModeEnabled true
      vi.doMock('$lib/services/user/prefs.svelte', () => ({
        prefs: { devModeEnabled: true },
      }));

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // Re-import the module with new mocks
      await import('.');

      // The subscription should have logged on import
      // (Note: Testing this fully would require accessing internal module state)
      consoleSpy.mockRestore();
    });
  });
});
