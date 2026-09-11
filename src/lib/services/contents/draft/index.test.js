// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import {
  filterRealValues,
  isAutoDuplicationEnabled,
  isDraftModified,
  revokeDraftFileURLs,
  suspendAutoDuplication,
} from '.';

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

  describe('suspendAutoDuplication', () => {
    const current = isAutoDuplicationEnabled;

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

  describe('isDraftModified', () => {
    it('should return false when draft is undefined', () => {
      expect(isDraftModified(undefined)).toBe(false);
    });

    it('should return false when draft is null', () => {
      expect(isDraftModified(null)).toBe(false);
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

      expect(isDraftModified(draft)).toBe(false);
    });

    it('should return true when the entry path is modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalPath: 'docs',
        currentPath: 'guides',
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      expect(isDraftModified(draft)).toBe(true);
    });

    it('should ignore surrounding slashes in the entry path', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalPath: 'docs',
        currentPath: '/docs/',
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      expect(isDraftModified(draft)).toBe(false);
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

      expect(isDraftModified(draft)).toBe(true);
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

      expect(isDraftModified(draft)).toBe(true);
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

      expect(isDraftModified(draft)).toBe(true);
    });

    it('should ignore a key holding `undefined` that only the original map has', () => {
      // A Markdown entry with no body gets a `body` key with no value. Reverting a field deletes
      // every current key and assigns the originals back, and assigning `undefined` to a deleted
      // property leaves a state proxy without the key, so the current map can’t have it
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test', body: undefined } },
        currentValues: { en: { title: 'Test' } },
      };

      expect(isDraftModified(draft)).toBe(false);
    });

    it('should ignore a key holding `undefined` that only the current map has', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test', body: undefined } },
      };

      expect(isDraftModified(draft)).toBe(false);
    });

    it('should return true when a value is cleared to `undefined`', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test', body: 'Body' } },
        currentValues: { en: { title: 'Test', body: undefined } },
      };

      expect(isDraftModified(draft)).toBe(true);
    });

    it('should return true when a value is filled in from `undefined`', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test', body: undefined } },
        currentValues: { en: { title: 'Test', body: 'Body' } },
      };

      expect(isDraftModified(draft)).toBe(true);
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

      expect(isDraftModified(draft)).toBe(true);
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

      expect(isDraftModified(draft)).toBe(false);
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

      expect(isDraftModified(draft)).toBe(true);
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

      expect(isDraftModified(draft)).toBe(false);
    });

    it('should return true when a locale is added to currentValues', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' }, ja: { title: 'Test' } },
      };

      expect(isDraftModified(draft)).toBe(true);
    });

    it('should return true when a locale is missing from originalValues', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' }, ja: undefined },
        currentValues: { en: { title: 'Test' }, ja: { title: 'Test' } },
      };

      expect(isDraftModified(draft)).toBe(true);
    });

    it('should return true when a field is removed from currentValues', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test', subtitle: 'Sub' } },
        currentValues: { en: { title: 'Test' } },
      };

      expect(isDraftModified(draft)).toBe(true);
    });

    it('should return true when a field is added to currentValues', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test', subtitle: 'Sub' } },
      };

      expect(isDraftModified(draft)).toBe(true);
    });
  });

  describe('revokeDraftFileURLs', () => {
    it('should revoke every blob URL held by the given draft', () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      revokeDraftFileURLs({ files: { 'blob:one': { file: {} }, 'blob:two': { file: {} } } });

      expect(revoke).toHaveBeenCalledTimes(2);
      expect(revoke).toHaveBeenCalledWith('blob:one');
      expect(revoke).toHaveBeenCalledWith('blob:two');

      revoke.mockRestore();
    });

    it('should do nothing when there is no draft or no files', () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      revokeDraftFileURLs(undefined);
      revokeDraftFileURLs(null);
      revokeDraftFileURLs({ files: {} });
      revokeDraftFileURLs({});

      expect(revoke).not.toHaveBeenCalled();

      revoke.mockRestore();
    });
  });
});
