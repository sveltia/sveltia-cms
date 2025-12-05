import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/contents/draft', () => ({
  entryDraft: { set: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/editor', () => ({
  showDuplicateToast: { set: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

vi.mock('$lib/services/contents/widgets/hidden/defaults', () => ({
  getDefaultValueMap: vi.fn(),
}));

vi.mock('$lib/services/contents/widgets/uuid/helper', () => ({
  getInitialValue: vi.fn(),
}));

describe('contents/draft/create/duplicate', () => {
  /** @type {any} */
  let mockEntryDraft;
  /** @type {any} */
  let mockGet;
  /** @type {any} */
  let mockEntryDraftSet;
  /** @type {any} */
  let mockShowDuplicateToastSet;
  /** @type {any} */
  let mockGetField;
  /** @type {any} */
  let mockGetHiddenFieldDefaultValueMap;
  /** @type {any} */
  let mockGetInitialUuidValue;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    const { get: getMock } = await import('svelte/store');
    const { entryDraft } = await import('$lib/services/contents/draft');
    const { showDuplicateToast } = await import('$lib/services/contents/editor');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getDefaultValueMap } = await import('$lib/services/contents/widgets/hidden/defaults');
    const { getInitialValue } = await import('$lib/services/contents/widgets/uuid/helper');

    mockGet = getMock;
    mockEntryDraftSet = entryDraft.set;
    mockShowDuplicateToastSet = showDuplicateToast.set;
    mockGetField = getField;
    mockGetHiddenFieldDefaultValueMap = getDefaultValueMap;
    mockGetInitialUuidValue = getInitialValue;

    // Setup default mock entry draft
    mockEntryDraft = {
      collectionName: 'posts',
      fileName: undefined,
      collection: {
        _i18n: {
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      },
      collectionFile: undefined,
      currentValues: {
        en: {
          title: 'Test Post',
          slug: 'test-post',
          translationKey: 'abc123',
        },
        ja: {
          title: 'テスト記事',
          slug: 'test-post',
          translationKey: 'abc123',
        },
      },
      validities: {
        en: { title: { valid: true } },
        ja: { title: { valid: true } },
      },
      isIndexFile: false,
      isNew: false,
      originalEntry: { id: 'existing-id' },
      originalSlugs: { en: 'test-post', ja: 'test-post' },
      currentSlugs: { en: 'test-post', ja: 'test-post' },
    };

    mockGet.mockReturnValue(mockEntryDraft);
  });

  describe('duplicateDraft', () => {
    it('should remove canonical slug from all locales', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.currentValues.en.translationKey).toBeUndefined();
      expect(setCallArg.currentValues.ja.translationKey).toBeUndefined();
    });

    it('should reset uuid field values', async () => {
      mockEntryDraft.currentValues.en.uuid = 'old-uuid-value';
      mockEntryDraft.currentValues.ja.uuid = 'old-uuid-value';

      mockGetField.mockImplementation((/** @type {any} */ { keyPath }) => {
        if (keyPath === 'uuid') {
          return { widget: 'uuid', i18n: true };
        }

        return undefined;
      });

      mockGetInitialUuidValue.mockReturnValue('new-uuid-value');

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.currentValues.en.uuid).toBe('new-uuid-value');
      expect(setCallArg.currentValues.ja.uuid).toBe('new-uuid-value');
    });

    it('should not reset uuid field for non-default locale when i18n is false', async () => {
      mockEntryDraft.currentValues.en.uuid = 'old-uuid-value';
      mockEntryDraft.currentValues.ja.uuid = 'old-uuid-value-ja';

      mockGetField.mockImplementation((/** @type {any} */ { keyPath }) => {
        if (keyPath === 'uuid') {
          return { widget: 'uuid', i18n: false };
        }

        return undefined;
      });

      mockGetInitialUuidValue.mockReturnValue('new-uuid-value');

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.currentValues.en.uuid).toBe('new-uuid-value');
      expect(setCallArg.currentValues.ja.uuid).toBe('old-uuid-value-ja');
    });

    it('should reset hidden field values', async () => {
      mockEntryDraft.currentValues.en.hiddenField = 'old-value';
      mockEntryDraft.currentValues.ja.hiddenField = 'old-value';

      mockGetField.mockImplementation((/** @type {any} */ { keyPath }) => {
        if (keyPath === 'hiddenField') {
          return { widget: 'hidden', default: 'new-default-value', i18n: true };
        }

        return undefined;
      });

      mockGetHiddenFieldDefaultValueMap.mockReturnValue({ hiddenField: 'new-default-value' });

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      expect(mockGetHiddenFieldDefaultValueMap).toHaveBeenCalledWith({
        fieldConfig: { widget: 'hidden', default: 'new-default-value', i18n: true },
        keyPath: 'hiddenField',
        locale: 'en',
        defaultLocale: 'en',
      });

      expect(mockGetHiddenFieldDefaultValueMap).toHaveBeenCalledWith({
        fieldConfig: { widget: 'hidden', default: 'new-default-value', i18n: true },
        keyPath: 'hiddenField',
        locale: 'ja',
        defaultLocale: 'en',
      });
    });

    it('should handle hidden field with array default value', async () => {
      mockEntryDraft.currentValues.en['tags.0'] = 'tag1';
      mockEntryDraft.currentValues.en['tags.1'] = 'tag2';

      mockGetField.mockImplementation((/** @type {any} */ { keyPath }) => {
        if (keyPath === 'tags.0' || keyPath === 'tags.1') {
          return { widget: 'hidden', default: ['default1', 'default2'], i18n: true };
        }

        if (keyPath === 'tags') {
          return { widget: 'hidden', default: ['default1', 'default2'], i18n: true };
        }

        return undefined;
      });

      mockGetHiddenFieldDefaultValueMap.mockReturnValue({
        tags: ['default1', 'default2'],
      });

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.currentValues.en['tags.0']).toBeUndefined();
      expect(setCallArg.currentValues.en['tags.1']).toBeUndefined();
    });

    it('should not reset hidden field for non-default locale when i18n is duplicate', async () => {
      mockEntryDraft.currentValues.en.hiddenField = 'old-value';
      mockEntryDraft.currentValues.ja.hiddenField = 'old-value-ja';

      mockGetField.mockImplementation((/** @type {any} */ { keyPath }) => {
        if (keyPath === 'hiddenField') {
          return { widget: 'hidden', default: 'new-default-value', i18n: 'duplicate' };
        }

        return undefined;
      });

      mockGetHiddenFieldDefaultValueMap.mockReturnValue({ hiddenField: 'new-default-value' });

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      expect(mockGetHiddenFieldDefaultValueMap).toHaveBeenCalledWith({
        fieldConfig: { widget: 'hidden', default: 'new-default-value', i18n: 'duplicate' },
        keyPath: 'hiddenField',
        locale: 'en',
        defaultLocale: 'en',
      });

      // Should not be called for Japanese locale
      expect(mockGetHiddenFieldDefaultValueMap).not.toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'ja',
        }),
      );
    });

    it('should reset all validities', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.validities).toEqual({
        en: {},
        ja: {},
      });
    });

    it('should set isNew to true', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.isNew).toBe(true);
    });

    it('should generate a new id', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.id).toBeDefined();
      expect(setCallArg.id).not.toBe(mockEntryDraft.id);
    });

    it('should update createdAt timestamp', async () => {
      const beforeTime = Date.now();
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const afterTime = Date.now();
      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.createdAt).toBeDefined();
      expect(setCallArg.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(setCallArg.createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('should clear originalEntry', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.originalEntry).toBeUndefined();
    });

    it('should reset slugs', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.originalSlugs).toEqual({});
      expect(setCallArg.currentSlugs).toEqual({});
    });

    it('should show duplicate toast', async () => {
      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      expect(mockShowDuplicateToastSet).toHaveBeenCalledWith(true);
    });

    it('should use collectionFile i18n when available', async () => {
      mockEntryDraft.collectionFile = {
        _i18n: {
          defaultLocale: 'fr',
          canonicalSlug: { key: 'customKey' },
        },
      };

      mockEntryDraft.currentValues = {
        fr: { customKey: 'should-be-removed' },
        en: { customKey: 'should-be-removed' },
      };

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.currentValues.fr.customKey).toBeUndefined();
      expect(setCallArg.currentValues.en.customKey).toBeUndefined();
    });

    it('should preserve other field values', async () => {
      mockGetField.mockReturnValue(undefined);

      const { duplicateDraft } = await import('./duplicate.js');

      duplicateDraft();

      const setCallArg = mockEntryDraftSet.mock.calls[0][0];

      expect(setCallArg.currentValues.en.title).toBe('Test Post');
      expect(setCallArg.currentValues.ja.title).toBe('テスト記事');
    });
  });
});
