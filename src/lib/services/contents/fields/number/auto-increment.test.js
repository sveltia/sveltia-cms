// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMaxEntryNumber } from '$lib/services/contents/draft/save/sort-order';
import { getField } from '$lib/services/contents/entry/fields';

import { assignAutoIncrementValues, isAutoIncrementField } from './auto-increment';

vi.mock('$lib/services/contents/draft/save/sort-order', () => ({
  getMaxEntryNumber: vi.fn(() => 0),
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

const collection = { name: 'invoices', _type: 'entry', _i18n: { defaultLocale: 'en' } };

describe('fields/number/auto-increment', () => {
  describe('isAutoIncrementField', () => {
    /**
     * Call `isAutoIncrementField` with the given field and options.
     * @param {object} fieldConfig Field configuration.
     * @param {object} [args] Other arguments.
     * @returns {boolean} Result.
     */
    const check = (fieldConfig, args = {}) =>
      isAutoIncrementField({ fieldConfig, collection, keyPath: 'number', ...args });

    it('should return `true` for a Number field with `auto_increment: true`', () => {
      expect(check({ name: 'number', widget: 'number', auto_increment: true })).toBe(true);
      expect(
        check({ name: 'id', widget: 'number', auto_increment: true }, { keyPath: 'meta.id' }),
      ).toBe(true);
    });

    it('should return `false` without `auto_increment: true`', () => {
      expect(check({ name: 'number', widget: 'number' })).toBe(false);
      expect(check({ name: 'number', widget: 'number', auto_increment: 'yes' })).toBe(false);
    });

    it('should return `false` for another field type', () => {
      expect(check({ name: 'number', auto_increment: true })).toBe(false);
      expect(check({ name: 'number', widget: 'string', auto_increment: true })).toBe(false);
    });

    it('should return `false` for a field that doesn’t hold one value per entry', () => {
      const fieldConfig = { name: 'number', widget: 'number', auto_increment: true };

      expect(check(fieldConfig, { collection: { ...collection, _type: 'file' } })).toBe(false);
      expect(check(fieldConfig, { isIndexFile: true })).toBe(false);
      expect(check(fieldConfig, { inEditorComponent: true })).toBe(false);
      expect(check(fieldConfig, { keyPath: 'lines.0.number' })).toBe(false);
    });
  });

  describe('assignAutoIncrementValues', () => {
    /** @type {Record<string, object>} */
    let fields;

    /**
     * Create a draft with the given values.
     * @param {Record<string, Record<string, any>>} currentValues Values keyed by locale.
     * @param {object} [extra] Other properties.
     * @returns {any} Draft.
     */
    const createDraft = (currentValues, extra = {}) => ({
      isNew: true,
      collection,
      collectionName: 'invoices',
      isIndexFile: false,
      currentValues,
      originalValues: structuredClone(currentValues),
      ...extra,
    });

    beforeEach(() => {
      fields = {
        title: { name: 'title' },
        number: { name: 'number', widget: 'number', auto_increment: true },
      };
      vi.mocked(getField).mockImplementation(({ keyPath }) => fields[keyPath]);
      vi.mocked(getMaxEntryNumber).mockReturnValue(0);
    });

    it('should assign the number after the highest one to every locale holding the field', () => {
      vi.mocked(getMaxEntryNumber).mockReturnValue(41);

      const draft = createDraft({
        en: { title: 'A', number: null },
        fr: { title: 'B', number: null },
        ja: { title: 'C' },
      });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues).toEqual({
        en: { title: 'A', number: 42 },
        fr: { title: 'B', number: 42 },
        ja: { title: 'C' },
      });
      expect(getMaxEntryNumber).toHaveBeenCalledWith({
        collectionName: 'invoices',
        keyPath: 'number',
        locale: 'en',
      });
      expect(getMaxEntryNumber).toHaveBeenCalledOnce();
    });

    it('should start from 1 when no entry has a number', () => {
      const draft = createDraft({ en: { number: '' } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.en.number).toBe(1);
    });

    it('should start from the `min` option when it’s higher', () => {
      fields.number.min = 1000;

      const draft = createDraft({ en: { number: null } });

      assignAutoIncrementValues(draft);
      expect(draft.currentValues.en.number).toBe(1000);

      vi.mocked(getMaxEntryNumber).mockReturnValue(1000);
      assignAutoIncrementValues(draft);
      expect(draft.currentValues.en.number).toBe(1001);
    });

    it('should round a fractional `min` option or highest number to an integer', () => {
      fields.number.min = 2.5;

      const draft = createDraft({ en: { number: null } });

      assignAutoIncrementValues(draft);
      expect(draft.currentValues.en.number).toBe(3);

      vi.mocked(getMaxEntryNumber).mockReturnValue(7.5);
      assignAutoIncrementValues(draft);
      expect(draft.currentValues.en.number).toBe(8);
    });

    it('should skip the numbers already taken by the given number of entries', () => {
      vi.mocked(getMaxEntryNumber).mockReturnValue(5);

      const draft = createDraft({ en: { number: null } });

      assignAutoIncrementValues(draft, 2);

      expect(draft.currentValues.en.number).toBe(8);
    });

    it('should store the number as a string with a string value type', () => {
      fields.number.value_type = 'int/string';

      const draft = createDraft({ en: { number: '' } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.en.number).toBe('1');
    });

    it('should overwrite the number a new entry already has, e.g. after being duplicated', () => {
      vi.mocked(getMaxEntryNumber).mockReturnValue(7);

      const draft = createDraft({ en: { number: 7 } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.en.number).toBe(8);
    });

    it('should keep the number an existing entry has', () => {
      vi.mocked(getMaxEntryNumber).mockReturnValue(7);

      const draft = createDraft({ en: { number: 3 }, fr: { number: 3 } }, { isNew: false });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues).toEqual({ en: { number: 3 }, fr: { number: 3 } });
    });

    it('should number an existing entry without a number in the default locale', () => {
      vi.mocked(getMaxEntryNumber).mockReturnValue(7);

      const draft = createDraft({ en: { number: null }, fr: { number: 3 } }, { isNew: false });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues).toEqual({ en: { number: 8 }, fr: { number: 8 } });
    });

    it('should number an existing entry again after a failed save', () => {
      vi.mocked(getMaxEntryNumber).mockReturnValue(7);

      const draft = createDraft({ en: { number: null } }, { isNew: false });

      assignAutoIncrementValues(draft);
      expect(draft.currentValues.en.number).toBe(8);

      // The save failed, and another entry has taken 8 since
      vi.mocked(getMaxEntryNumber).mockReturnValue(8);
      assignAutoIncrementValues(draft);
      expect(draft.currentValues.en.number).toBe(9);
    });

    it('should leave a field without the option alone', () => {
      delete fields.number.auto_increment;

      const draft = createDraft({ en: { number: null } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.en.number).toBeNull();
    });

    it('should leave a value without a field alone', () => {
      const draft = createDraft({ en: { unknown: null } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.en.unknown).toBeNull();
    });

    it('should leave a field in a List field alone', () => {
      fields['lines.0.number'] = fields.number;

      const draft = createDraft({ en: { 'lines.0.number': null } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.en['lines.0.number']).toBeNull();
    });

    it('should do nothing outside an entry collection or in the special index file', () => {
      const fileDraft = createDraft(
        { en: { number: null } },
        { collection: { ...collection, _type: 'file' } },
      );

      const indexFileDraft = createDraft({ en: { number: null } }, { isIndexFile: true });

      assignAutoIncrementValues(fileDraft);
      assignAutoIncrementValues(indexFileDraft);

      expect(fileDraft.currentValues.en.number).toBeNull();
      expect(indexFileDraft.currentValues.en.number).toBeNull();
      expect(getField).not.toHaveBeenCalled();
    });

    it('should do nothing when the default locale has no values', () => {
      const draft = createDraft({ fr: { number: null } });

      assignAutoIncrementValues(draft);

      expect(draft.currentValues.fr.number).toBeNull();
    });
  });
});
