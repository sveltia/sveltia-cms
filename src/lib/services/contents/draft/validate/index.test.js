// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField, isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';

import { validateEntry } from '.';

vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/fields/key-value/helper');
vi.mock('$lib/services/contents/fields/list/helper');
vi.mock('$lib/services/contents/fields/rich-text');
vi.mock('$lib/services/contents/fields/string/validate');
vi.mock('$lib/services/contents/draft/validate/messages', () => ({
  getFieldValidationMessages: vi.fn(() => []),
}));
vi.mock('$lib/services/common/template');
vi.mock('$lib/services/config');
vi.mock('$lib/services/utils/misc');
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

describe('draft/validate', () => {
  let mockEntryDraft;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockEntryDraft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: {
          i18nEnabled: true,
          defaultLocale: 'en',
        },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      files: {},
      isIndexFile: false,
      currentLocales: { en: true },
      currentValues: { en: {} },
      extraValues: { en: {} },
      currentSlugs: { en: 'test-post' },
      slugEditor: { en: false },
    };

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockEntryDraft;
      }

      return undefined;
    });

    vi.mocked(isFieldRequired).mockReturnValue(false);
    vi.mocked(isFieldMultiple).mockReturnValue(false);

    // Mock validation functions
    const { validateStringField } = await import('$lib/services/contents/fields/string/validate');

    vi.mocked(validateStringField).mockReturnValue({ tooShort: false, tooLong: false });

    // Mock getListFieldInfo
    const { getListFieldInfo } = await import('$lib/services/contents/fields/list/helper');

    vi.mocked(getListFieldInfo).mockReturnValue({ hasSubFields: false });
  });

  describe('validateEntry', () => {
    it('should validate entire entry and update draft', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentValues = { en: { title: 'Test Post' } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string' });

      const result = validateEntry();

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return false when validation fails', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentValues = { en: { title: '' } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateEntry();

      expect(result).toBe(false);
    });

    it('should validate slugs when slug editor is shown', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      const result = validateEntry();

      expect(result).toBe(false);
    });

    it('should not validate slug when slug editor is hidden', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: false };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      const result = validateEntry();

      expect(result).toBe(true);
    });

    it('should validate both currentValues and extraValues', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentValues = { en: { title: 'Test' } };
      mockEntryDraft.extraValues = { en: { extra: '' } };

      let callCount = 0;

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        callCount += 1;

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string' };
        }

        if (keyPath === 'extra') {
          return { name: 'extra', widget: 'string', required: true };
        }

        return undefined;
      });

      vi.mocked(isFieldRequired).mockImplementation(
        ({ fieldConfig }) => fieldConfig?.required ?? false,
      );

      const result = validateEntry();

      expect(result).toBe(false);
      expect(callCount).toBeGreaterThan(0);
    });
  });
});
