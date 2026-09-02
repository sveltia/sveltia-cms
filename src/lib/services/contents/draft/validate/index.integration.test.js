// @ts-nocheck
import { get, writable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Collection whose required fields carry rules that an empty value trips on its own: a pattern that
 * nothing can match, a minimum length, a number that has to be a number, and a list that needs at
 * least one item.
 */
const collection = {
  name: 'products',
  _type: 'entry',
  fields: [
    { name: 'code', widget: 'string', pattern: ['^\\d{3}$', 'Three digits'], minlength: 3 },
    { name: 'price', widget: 'number', value_type: 'int', min: 1 },
    { name: 'tags', widget: 'list', min: 2, max: 3 },
    // Optional, but carrying the same kind of constraints
    { name: 'note', widget: 'string', required: false, minlength: 3, pattern: ['^\\d+$', 'D'] },
    { name: 'extras', widget: 'list', required: false, min: 2 },
  ],
  _i18n: {
    i18nEnabled: false,
    allLocales: ['_default'],
    initialLocales: ['_default'],
    defaultLocale: '_default',
    canonicalSlug: { key: 'translationKey' },
  },
  editor: { preview: false },
  _file: { format: 'yaml' },
};

vi.mock('$lib/services/contents/collection', async (importOriginal) => ({
  ...(await importOriginal()),
  getCollection: vi.fn(() => collection),
}));

// Editorial Workflow enabled, which is what makes a draft save skip the required fields
vi.mock('$lib/services/config', () => ({
  cmsConfig: writable({ publish_mode: 'editorial_workflow' }),
}));

vi.mock('$lib/services/backends', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  backend: writable({ workflow: {} }),
}));

vi.mock('$lib/services/contents/draft/backup', () => ({
  restoreBackupIfNeeded: vi.fn(),
}));

const { fieldConfigCacheMap } = await import('$lib/services/contents/entry/fields');
const { createDraft } = await import('$lib/services/contents/draft/create');
const { entryDraft } = await import('$lib/services/contents/draft');
const { validateEntry } = await import('$lib/services/contents/draft/validate');
const { isRequiredEnforced } = await import('$lib/services/contents/draft/validate/required');

describe('contents/draft/validate (integration)', () => {
  beforeEach(() => {
    fieldConfigCacheMap.clear();
    createDraft({ collection });
  });

  it('should not hold an empty optional field to its constraints', () => {
    // `required: false` alongside a `minlength`, `pattern` or `min` used to flag the field the
    // moment it was left empty, which blocked every save — draft or not
    validateEntry();

    const { validities } = get(entryDraft);

    expect(validities._default.note.valid).toBe(true);
    expect(validities._default.extras.valid).toBe(true);
  });

  it('should reject an empty entry when required fields are enforced', () => {
    expect(validateEntry()).toBe(false);
    expect(get(entryDraft).validities._default.code.valueMissing).toBe(true);
  });

  it('should accept the same entry as a draft, with nothing marked', () => {
    // @see https://github.com/decaporg/decap-cms/issues/464
    expect(validateEntry({ enforceRequired: false })).toBe(true);

    const { validities, validationMessages } = get(entryDraft);

    // Not just unblocked: an empty required field is left unmarked, so the editor shows no error on
    // a draft that saved successfully
    expect(Object.values(validities._default).every(({ valid }) => valid !== false)).toBe(true);
    expect(Object.values(validationMessages._default).flat()).toEqual([]);
  });

  it('should leave the fields unmarked while the user goes on editing', () => {
    // A draft save marks nothing, and neither does the per-keystroke revalidation that follows: a
    // field emptied again would otherwise light up as an error moments after a successful save
    expect(isRequiredEnforced(get(entryDraft))).toBe(false);
    expect(validateEntry({ enforceRequired: false })).toBe(true);

    const { currentValues } = get(entryDraft);

    currentValues._default.code = '123';
    currentValues._default.code = '';

    expect(get(entryDraft).validities._default.code.valueMissing).toBe(false);
    expect(get(entryDraft).validationMessages._default.code).toEqual([]);
  });

  it('should still reject a constraint that a value present has broken', () => {
    // A field that has been filled in is held to its rules: a list short of its `min` isn’t “not
    // filled in yet”, it’s wrong, and the same goes for a value over a `max`
    const { currentValues } = get(entryDraft);

    currentValues._default['tags.0'] = 'one';

    expect(validateEntry({ enforceRequired: false })).toBe(false);
    expect(get(entryDraft).validities._default.tags.rangeUnderflow).toBe(true);
  });

  it('should still reject an error that isn’t about the field being empty', () => {
    // Two digits: short of `minlength` and no match for the pattern, with a value present
    get(entryDraft).currentValues._default.code = '12';

    expect(validateEntry({ enforceRequired: false })).toBe(false);
    expect(get(entryDraft).validities._default.code.patternMismatch).toBe(true);
  });
});
