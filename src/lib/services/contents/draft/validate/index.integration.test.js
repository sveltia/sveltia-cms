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
    // Tested against the items joined with commas: at least two lowercase words
    {
      name: 'keywords',
      widget: 'list',
      required: false,
      pattern: ['^[a-z]+(,[a-z]+)+$', 'Two words or more'],
    },
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
      name: 'author',
      widget: 'object',
      fields: [{ name: 'name', widget: 'string', required: false }],
    },
    {
      name: 'blocks',
      widget: 'list',
      required: false,
      max: 1,
      types: [{ name: 'text', widget: 'object', fields: [{ name: 'body', widget: 'string' }] }],
    },
    // A field taking multiple values, stored like a list without subfields
    {
      name: 'colors',
      widget: 'select',
      required: false,
      multiple: true,
      max: 1,
      options: ['red', 'green', 'blue'],
    },
    // Multiple Select and Relation fields tested against their values joined with commas, numbers
    // included: ascending sizes, or two related slugs or more
    {
      name: 'sizes',
      widget: 'select',
      required: false,
      multiple: true,
      options: [1, 2, 3],
      pattern: ['^1,2', 'Start with 1 and 2'],
    },
    {
      name: 'related',
      widget: 'relation',
      required: false,
      multiple: true,
      collection: 'products',
      pattern: ['^[a-z-]+(,[a-z-]+)+$', 'Two slugs or more'],
    },
    // A multiple Image field tested against its paths joined with commas, a file just uploaded by
    // its name: JPEG images only
    {
      name: 'photos',
      widget: 'image',
      required: false,
      multiple: true,
      pattern: ['^[^,]+\\.jpg(,[^,]+\\.jpg)*$', 'JPEG only'],
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
const { cmsConfig } = await import('$lib/services/config');
const { setSubtree } = await import('$lib/services/contents/entry/subtree');
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
    cmsConfig.current.publish_mode = 'editorial_workflow';
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

  it('should revalidate a list without subfields when one of its items is edited', () => {
    // The list’s validity is kept under `tags`, while an edit writes to an item, e.g. `tags.1`,
    // which has no field config of its own, so the error used to stay until the next save
    const { currentValues } = entryDraft.current;

    delete currentValues._default.tags;
    currentValues._default['tags.0'] = 'one';

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeUnderflow).toBe(true);

    currentValues._default['tags.1'] = 'two';

    expect(entryDraft.current.validities._default.tags.valid).toBe(true);
    expect(entryDraft.current.validationMessages._default.tags).toEqual([]);
    expect(entryDraft.current.validities._default).not.toHaveProperty('tags.1');

    // Too many items
    currentValues._default['tags.2'] = 'three';
    currentValues._default['tags.3'] = 'four';

    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(true);
    expect(entryDraft.current.validationMessages._default.tags).toEqual([
      'validation.range_overflow.add',
    ]);
  });

  it('should revalidate a field taking multiple values when one of its values is edited', () => {
    const { currentValues } = entryDraft.current;

    currentValues._default['colors.0'] = 'red';
    currentValues._default['colors.1'] = 'green';

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.colors.rangeOverflow).toBe(true);

    delete currentValues._default['colors.1'];
    currentValues._default['colors.0'] = 'blue';

    expect(entryDraft.current.validities._default.colors.valid).toBe(true);
    expect(entryDraft.current.validationMessages._default.colors).toEqual([]);
    expect(entryDraft.current.validities._default).not.toHaveProperty('colors.0');
  });

  it('should update the item count of a list without subfields as soon as an item is deleted', () => {
    const { currentValues } = entryDraft.current;
    const values = currentValues._default;

    delete values.tags;
    Object.assign(values, { 'tags.0': 'a', 'tags.1': 'b', 'tags.2': 'c', 'tags.3': 'd' });

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(true);

    // Removing the last item only deletes its key path, with nothing written that would trigger
    // the revalidation, yet the error has to go without another save attempt
    delete values['tags.3'];

    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(false);
    expect(entryDraft.current.validities._default.tags.valid).toBe(true);
    expect(entryDraft.current.validationMessages._default.tags).toEqual([]);

    // And back below the minimum
    delete values['tags.2'];
    delete values['tags.1'];

    expect(entryDraft.current.validities._default.tags.rangeUnderflow).toBe(true);
    expect(entryDraft.current.validationMessages._default.tags).toEqual([
      'validation.range_underflow.add',
    ]);
  });

  it('should update the item count of a list without subfields as the editor rewrites it', () => {
    // The editor replaces the whole list, writing the placeholder before the items, so the list
    // has to be revalidated from its items as well, not only from the placeholder, which would
    // count no items at all
    const values = entryDraft.current.currentValues._default;

    setSubtree(values, 'tags', ['a', 'b', 'c', 'd']);

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(true);

    setSubtree(values, 'tags', ['a']);

    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeUnderflow).toBe(true);

    setSubtree(values, 'tags', ['a', 'b', 'c', 'd', 'e']);

    expect(entryDraft.current.validities._default.tags.rangeUnderflow).toBe(false);
    expect(entryDraft.current.validities._default.tags.rangeOverflow).toBe(true);

    setSubtree(values, 'tags', ['a', 'b']);

    expect(entryDraft.current.validities._default.tags.valid).toBe(true);
  });

  it('should update the value count of a multiple-value field as soon as a value is deleted', () => {
    const values = entryDraft.current.currentValues._default;

    Object.assign(values, { 'colors.0': 'red', 'colors.1': 'green' });

    validateEntry();
    expect(entryDraft.current.validities._default.colors.rangeOverflow).toBe(true);

    // Nothing written after the deletion
    delete values['colors.1'];

    expect(entryDraft.current.validities._default.colors.valid).toBe(true);
  });

  it('should update the item count of a list with subfields as soon as an item is deleted', () => {
    const values = entryDraft.current.currentValues._default;

    delete values.speakers;
    Object.assign(values, {
      'speakers.0.name': 'Ana',
      'speakers.0.links.0.url': 'a',
      'speakers.0.links.1.url': 'b',
      'speakers.1.name': 'Bo',
      'speakers.2.name': 'Cy',
      'speakers.3.name': 'Di',
    });

    validateEntry();
    expect(entryDraft.current.validities._default.speakers.rangeOverflow).toBe(true);
    expect(entryDraft.current.validities._default['speakers.0.links'].rangeOverflow).toBe(true);

    // Both the list the item belongs to and the list it’s nested in are revalidated
    delete values['speakers.0.links.1.url'];

    expect(entryDraft.current.validities._default['speakers.0.links'].valid).toBe(true);
    expect(entryDraft.current.validities._default.speakers.rangeOverflow).toBe(true);

    delete values['speakers.3.name'];

    expect(entryDraft.current.validities._default.speakers.valid).toBe(true);
  });

  it('should no longer report a required object missing once the editor adds it', () => {
    // Without Editorial Workflow, so an empty required field is marked as the user edits
    cmsConfig.current.publish_mode = undefined;

    const values = entryDraft.current.currentValues._default;

    // Removed in the editor: the subfields go, and `null` is stored for the object itself
    Object.keys(values)
      .filter((key) => key.startsWith('author.'))
      .forEach((key) => {
        delete values[key];
      });
    values.author = null;

    expect(validateEntry()).toBe(false);
    expect(entryDraft.current.validities._default.author.valueMissing).toBe(true);

    // Added back: the subfields are written, then the `null` is deleted, which leaves the object
    // with no value of its own
    values['author.name'] = '';
    delete values.author;

    expect(entryDraft.current.validities._default.author.valueMissing).toBe(false);
    expect(entryDraft.current.validationMessages._default.author).toEqual([]);

    // Gone altogether, with neither a value nor subfields left
    delete values['author.name'];
    values.author = null;
    delete values.author;

    expect(entryDraft.current.validities._default.author.valueMissing).toBe(true);
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

  it('should test the pattern of a list without subfields against its items joined', () => {
    // Like Decap CMS, the pattern of a simple list is matched against `a,b,c` rather than against
    // each item, so a pattern can refer to the commas, and an empty list isn’t tested at all
    const values = entryDraft.current.currentValues._default;

    validateEntry();
    expect(entryDraft.current.validities._default.keywords.valid).toBe(true);

    values['keywords.0'] = 'alpha';

    validateEntry();
    expect(entryDraft.current.validities._default.keywords.patternMismatch).toBe(true);
    expect(entryDraft.current.validationMessages._default.keywords).toEqual(['Two words or more']);

    values['keywords.1'] = 'beta';

    validateEntry();
    expect(entryDraft.current.validities._default.keywords.valid).toBe(true);

    values['keywords.2'] = 'Gamma';

    validateEntry();
    expect(entryDraft.current.validities._default.keywords.patternMismatch).toBe(true);
  });

  it('should retest the pattern of a list without subfields when one of its items is edited', () => {
    const values = entryDraft.current.currentValues._default;

    values['keywords.0'] = 'alpha';

    validateEntry();
    expect(entryDraft.current.validities._default.keywords.patternMismatch).toBe(true);

    // No save in between: the items are joined again as soon as one of them changes
    values['keywords.1'] = 'beta';

    expect(entryDraft.current.validities._default.keywords.valid).toBe(true);
    expect(entryDraft.current.validationMessages._default.keywords).toEqual([]);

    values['keywords.1'] = 'Beta';

    expect(entryDraft.current.validities._default.keywords.patternMismatch).toBe(true);
    expect(entryDraft.current.validationMessages._default.keywords).toEqual(['Two words or more']);
  });

  it('should test the pattern of a multiple Select field against its values joined', () => {
    const values = entryDraft.current.currentValues._default;

    validateEntry();
    expect(entryDraft.current.validities._default.sizes.valid).toBe(true);

    values['sizes.0'] = 2;
    values['sizes.1'] = 1;

    validateEntry();
    expect(entryDraft.current.validities._default.sizes.patternMismatch).toBe(true);
    expect(entryDraft.current.validationMessages._default.sizes).toEqual(['Start with 1 and 2']);

    // Retested live, with the numbers converted to strings
    values['sizes.0'] = 1;
    values['sizes.1'] = 2;
    values['sizes.2'] = 3;

    expect(entryDraft.current.validities._default.sizes.valid).toBe(true);
    expect(entryDraft.current.validationMessages._default.sizes).toEqual([]);
  });

  it('should test the pattern of a multiple Relation field against its values joined', () => {
    const values = entryDraft.current.currentValues._default;

    validateEntry();
    expect(entryDraft.current.validities._default.related.valid).toBe(true);

    values['related.0'] = 'foo';

    validateEntry();
    expect(entryDraft.current.validities._default.related.patternMismatch).toBe(true);
    expect(entryDraft.current.validationMessages._default.related).toEqual(['Two slugs or more']);

    values['related.1'] = 'bar-baz';

    expect(entryDraft.current.validities._default.related.valid).toBe(true);

    values['related.1'] = 'Bar';

    expect(entryDraft.current.validities._default.related.patternMismatch).toBe(true);
  });

  it('should test the pattern of a multiple Image field against its paths joined', () => {
    const { currentValues, files } = entryDraft.current;
    const values = currentValues._default;

    validateEntry();
    expect(entryDraft.current.validities._default.photos.valid).toBe(true);

    // A file just uploaded is stored as a blob URL, tested by its name
    values['photos.0'] = '/uploads/a.jpg';
    values['photos.1'] = 'blob:https://example.com/1';
    files['blob:https://example.com/1'] = { file: new File([], 'b.jpg') };

    validateEntry();
    expect(entryDraft.current.validities._default.photos.valid).toBe(true);

    values['photos.2'] = '/uploads/c.png';

    expect(entryDraft.current.validities._default.photos.patternMismatch).toBe(true);
    expect(entryDraft.current.validationMessages._default.photos).toEqual(['JPEG only']);
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
