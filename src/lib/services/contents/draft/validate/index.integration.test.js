// @ts-nocheck
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
    // Lists whose items are objects, stored as their subfields, e.g. `speakers.0.name`
    {
      name: 'speakers',
      widget: 'list',
      required: false,
      min: 2,
      max: 3,
      fields: [
        { name: 'name', widget: 'string' },
        { name: 'links', widget: 'list', required: false, max: 1, fields: [{ name: 'url' }] },
      ],
    },
    {
      name: 'blocks',
      widget: 'list',
      required: false,
      max: 1,
      types: [{ name: 'text', widget: 'object', fields: [{ name: 'body', widget: 'string' }] }],
    },
  ],
  _i18n: {
    structureMap: {},
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
  cmsConfig: { current: { publish_mode: 'editorial_workflow' } },
}));

vi.mock('$lib/services/backends', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  backend: { current: { workflow: {} } },
}));

vi.mock('$lib/services/contents/draft/backup', () => ({
  restoreBackupIfNeeded: vi.fn(),
}));

// Load the collection files module before anything else imports it. It imports `getCollection` from
// the collection module, which imports it back, so if the mocked collection module loaded first,
// the files module would bind to the original `getCollection` pulled in by `importOriginal()` and
// `resolveCollectionAndFile()` wouldn’t find the collection mocked above.
await import('$lib/services/contents/collection/files');

const { fieldConfigCacheMap } = await import('$lib/services/contents/entry/fields');
const { createDraft } = await import('$lib/services/contents/draft/create');
const { EntryDraftState } = await import('$lib/services/contents/draft/state.svelte');
const { validateEntry: _validateEntry } = await import('$lib/services/contents/draft/validate');
const { isRequiredEnforced } = await import('$lib/services/contents/draft/validate/required');

describe('contents/draft/validate (integration)', () => {
  /** @type {EntryDraftState} */
  let entryDraft;
  /**
   * Validate the draft open in the editor.
   * @param {object} [options] Options other than the draft.
   * @returns {boolean} Whether the draft is valid.
   */
  const validateEntry = (options = {}) => _validateEntry({ draft: entryDraft.current, ...options });

  beforeEach(() => {
    fieldConfigCacheMap.clear();
    entryDraft = new EntryDraftState();
    createDraft({ entryDraft, collection });
  });

  it('should not hold an empty optional field to its constraints', () => {
    // `required: false` alongside a `minlength`, `pattern` or `min` used to flag the field the
    // moment it was left empty, which blocked every save — draft or not
    validateEntry();

    const { validities } = entryDraft.current;

    expect(validities._default.note.valid).toBe(true);
    expect(validities._default.extras.valid).toBe(true);
  });

  it('should reject an empty entry when required fields are enforced', () => {
    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.code.valueMissing).toBe(true);
  });

  it('should accept the same entry as a draft, with nothing marked', () => {
    // @see https://github.com/decaporg/decap-cms/issues/464
    expect(validateEntry({ enforceRequired: false })).toBe(true);

    const { validities, validationMessages } = entryDraft.current;

    // Not just unblocked: an empty required field is left unmarked, so the editor shows no error on
    // a draft that saved successfully
    expect(Object.values(validities._default).every(({ valid }) => valid !== false)).toBe(true);
    expect(Object.values(validationMessages._default).flat()).toEqual([]);
  });

  it('should leave the fields unmarked while the user goes on editing', () => {
    // A draft save marks nothing, and neither does the per-keystroke revalidation that follows: a
    // field emptied again would otherwise light up as an error moments after a successful save
    expect(isRequiredEnforced(entryDraft.current)).toBe(false);
    expect(validateEntry({ enforceRequired: false })).toBe(true);

    const { currentValues } = entryDraft.current;

    currentValues._default.code = '123';
    currentValues._default.code = '';

    expect(entryDraft.current.validities._default.code.valueMissing).toBe(false);
    expect(entryDraft.current.validationMessages._default.code).toEqual([]);
  });

  it('should still reject a constraint that a value present has broken', () => {
    // A field that has been filled in is held to its rules: a list short of its `min` isn’t “not
    // filled in yet”, it’s wrong, and the same goes for a value over a `max`
    const { currentValues } = entryDraft.current;

    currentValues._default['tags.0'] = 'one';

    expect(validateEntry({ enforceRequired: false })).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeUnderflow).toBe(true);
  });

  it('should hold a list without subfields to its item count when only its items are stored', () => {
    // A list loaded from a file is stored as `tags.0`, `tags.1`, etc. with no `tags` key, and its
    // items have no field config of their own, so the list itself has to be checked from an item
    const { currentValues } = entryDraft.current;

    delete currentValues._default.tags;
    currentValues._default['tags.0'] = 'one';

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeUnderflow).toBe(true);
    // Worded for a list, with the list’s own `min`
    expect(entryDraft.current.validationMessages._default.tags).toEqual([
      'validation.range_underflow.add',
    ]);

    // Too many items
    currentValues._default['tags.1'] = 'two';
    currentValues._default['tags.2'] = 'three';
    currentValues._default['tags.3'] = 'four';

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(true);

    // Within the range
    delete currentValues._default['tags.3'];

    validateEntry();
    expect(entryDraft.current.validities._default.tags.valid).toBe(true);
  });

  it('should hold a list with subfields to its item count when only its items are stored', () => {
    // A list of objects loaded from a file is stored as its items’ subfields, e.g.
    // `speakers.0.name`, with no key path for the list itself, so the list has to be checked from
    // its items
    const { currentValues } = entryDraft.current;
    const values = currentValues._default;

    delete values.speakers;
    values['speakers.0.name'] = 'Ana';

    validateEntry();
    expect(entryDraft.current.validities._default.speakers.rangeUnderflow).toBe(true);
    expect(entryDraft.current.validationMessages._default.speakers).toEqual([
      'validation.range_underflow.add',
    ]);

    // Too many items
    values['speakers.1.name'] = 'Ben';
    values['speakers.2.name'] = 'Cai';
    values['speakers.3.name'] = 'Dee';

    validateEntry();
    expect(entryDraft.current.validities._default.speakers.rangeOverflow).toBe(true);

    // Within the range
    delete values['speakers.3.name'];

    validateEntry();
    expect(entryDraft.current.validities._default.speakers.valid).toBe(true);

    // A list nested in an item is checked too
    values['speakers.0.links.0.url'] = 'https://a.example';
    values['speakers.0.links.1.url'] = 'https://b.example';

    validateEntry();
    expect(entryDraft.current.validities._default.speakers.valid).toBe(true);
    expect(entryDraft.current.validities._default['speakers.0.links'].rangeOverflow).toBe(true);

    // A value left over from a list that’s no longer in the config has nothing to be checked
    // against
    values['removed.0.name'] = 'Eve';

    validateEntry();
    expect(entryDraft.current.validities._default.removed).toBeUndefined();
  });

  it('should hold a list with types to its item count when only its items are stored', () => {
    const values = entryDraft.current.currentValues._default;

    delete values.blocks;
    values['blocks.0.type'] = 'text';
    values['blocks.0.body'] = 'One';
    values['blocks.1.type'] = 'text';
    values['blocks.1.body'] = 'Two';

    validateEntry();
    expect(entryDraft.current.validities._default.blocks.rangeOverflow).toBe(true);
  });

  it('should still reject an error that isn’t about the field being empty', () => {
    // Two digits: short of `minlength` and no match for the pattern, with a value present
    entryDraft.current.currentValues._default.code = '12';

    expect(validateEntry({ enforceRequired: false })).toBe(false);
    expect(entryDraft.current.validities._default.code.patternMismatch).toBe(true);
  });

  it('should ignore a value left behind by a removed rich text editor component', () => {
    // A component that wasn’t unmounted along with its node could write an emptied field back to
    // the draft after its values were cleaned up, without the component name. The field must not
    // be looked up among the entry’s own fields, where `code` would be taken for the required
    // entry field and block the save with an error no field shows
    const { currentValues, extraValues } = entryDraft.current;

    Object.assign(currentValues._default, { code: '123', price: 5, 'tags.0': 'a', 'tags.1': 'b' });
    extraValues._default['body:c94:code'] = '';

    expect(validateEntry()).toBe(true);
    expect(entryDraft.current.validities._default['body:c94:code']).toBeUndefined();
  });
});
