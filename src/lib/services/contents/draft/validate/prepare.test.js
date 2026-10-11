import { describe, expect, test, vi } from 'vitest';

import {
  PREPARE_FIELD_FUNCTIONS,
  prepareListField,
  relaxEmptyFieldValidity,
  resolveMediaValue,
} from '$lib/services/contents/draft/validate/prepare';
import { resolveCodeField } from '$lib/services/contents/fields/code/validate';
import { validateKeyValueField } from '$lib/services/contents/fields/key-value/validate';

/**
 * @import { PrepareFieldArgs } from '$lib/services/contents/draft/validate/prepare';
 * @import { EntryValidityState } from '$lib/types/private';
 */

vi.mock('$lib/services/contents/fields/code/validate', () => ({
  resolveCodeField: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/key-value/validate', () => ({
  validateKeyValueField: vi.fn(),
}));

/**
 * Create a validity state with every flag cleared.
 * @returns {EntryValidityState} Validity state.
 */
const createValidity = () => ({
  valid: true,
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  patternMismatch: false,
  typeMismatch: false,
});

/**
 * Create the arguments for a field preparation function.
 * @param {Partial<PrepareFieldArgs> & { fieldConfig?: any }} [overrides] Values to override.
 * @returns {PrepareFieldArgs} Arguments.
 */
const createArgs = (overrides = {}) => ({
  keyPath: 'tags',
  value: undefined,
  valueMap: {},
  fieldConfig: /** @type {any} */ ({ name: 'tags', widget: 'list' }),
  getFieldArgs: { collectionName: 'posts', keyPath: 'tags', valueMap: {}, isIndexFile: false },
  files: {},
  validity: createValidity(),
  validities: { _default: {} },
  locale: '_default',
  required: false,
  min: 0,
  max: Infinity,
  ...overrides,
});

describe('resolveMediaValue()', () => {
  const file = new File([''], 'photo.jpg');
  const files = /** @type {any} */ ({ 'blob:https://example.com/1': { file } });

  test('returns the original file name for the blob URL of a file just attached', () => {
    ['file', 'image'].forEach((fieldType) => {
      expect(resolveMediaValue({ fieldType, value: 'blob:https://example.com/1', files })).toBe(
        'photo.jpg',
      );
    });
  });

  test('returns undefined for a blob URL without an attached file', () => {
    expect(
      resolveMediaValue({ fieldType: 'image', value: 'blob:https://example.com/2', files }),
    ).toBeUndefined();
    expect(
      resolveMediaValue({
        fieldType: 'image',
        value: 'blob:https://example.com/3',
        files: /** @type {any} */ ({ 'blob:https://example.com/3': {} }),
      }),
    ).toBeUndefined();
  });

  test('returns any other value as is', () => {
    expect(resolveMediaValue({ fieldType: 'image', value: '/uploads/a.jpg', files })).toBe(
      '/uploads/a.jpg',
    );
    expect(resolveMediaValue({ fieldType: 'image', value: null, files })).toBeNull();
    expect(resolveMediaValue({ fieldType: 'image', value: 3, files })).toBe(3);
    expect(
      resolveMediaValue({ fieldType: 'string', value: 'blob:https://example.com/1', files }),
    ).toBe('blob:https://example.com/1');
  });
});

describe('prepareListField()', () => {
  test('skips a field validated already at the same key path', () => {
    const validity = createValidity();

    const result = prepareListField(
      createArgs({
        value: [],
        validity,
        required: true,
        validities: { _default: { tags: createValidity() } },
        fieldConfig: /** @type {any} */ ({ name: 'tags', widget: 'list', pattern: ['^x$', ''] }),
      }),
    );

    expect(result).toEqual({ skip: true, keyPath: 'tags', value: [], empty: false });
    expect(validity).toEqual(createValidity());
  });

  test('flags a required list without items as missing', () => {
    const validity = createValidity();
    const result = prepareListField(createArgs({ value: [], validity, required: true }));

    expect(result).toEqual({ skip: false, keyPath: 'tags', value: [], empty: true });
    expect(validity.valueMissing).toBe(true);
  });

  test('counts the items flattened in the value map', () => {
    const validity = createValidity();

    const result = prepareListField(
      createArgs({
        valueMap: { 'tags.0': 'a', 'tags.1': 'b', other: 'c' },
        validity,
        min: 3,
      }),
    );

    expect(result).toEqual({ skip: false, keyPath: 'tags', value: undefined, empty: false });
    expect(validity.rangeUnderflow).toBe(true);
  });

  test('flags a list holding too many items', () => {
    const validity = createValidity();

    prepareListField(createArgs({ value: ['a', 'b', 'c'], validity, max: 2 }));

    expect(validity.rangeOverflow).toBe(true);
  });

  test('tests the pattern of a List field without subfields against the joined items', () => {
    const fieldConfig = /** @type {any} */ ({
      name: 'tags',
      widget: 'list',
      pattern: ['^[a-z,]+$', 'Lowercase letters only'],
    });

    const valid = createValidity();

    prepareListField(createArgs({ value: ['a', 'b', 'c'], fieldConfig, validity: valid }));
    expect(valid.patternMismatch).toBe(false);

    const invalid = createValidity();

    prepareListField(createArgs({ value: ['a', 'B'], fieldConfig, validity: invalid }));
    expect(invalid.patternMismatch).toBe(true);
  });

  test('joins the items in list order, converting a number and `null` like Decap CMS', () => {
    const fieldConfig = /** @type {any} */ ({
      name: 'tags',
      widget: 'list',
      pattern: ['^1,,b$', 'Exact'],
    });

    const validity = createValidity();

    prepareListField(
      createArgs({
        valueMap: { 'tags.2': 'b', 'tags.0': 1, 'tags.1': null },
        fieldConfig,
        validity,
      }),
    );

    expect(validity.patternMismatch).toBe(false);
  });

  test('uses the string widget by default, which takes no multiple values', () => {
    const fieldConfig = /** @type {any} */ ({ name: 'tags', pattern: ['^x$', 'Only x'] });
    const validity = createValidity();

    prepareListField(createArgs({ value: ['a', 'b'], fieldConfig, validity }));

    expect(validity.patternMismatch).toBe(false);
  });

  test('doesn’t test the pattern of a List field with subfields', () => {
    [{ field: { name: 'item' } }, { fields: [] }, { types: [] }].forEach((options) => {
      const fieldConfig = /** @type {any} */ ({
        name: 'tags',
        widget: 'list',
        pattern: ['^x$', 'Only x'],
        ...options,
      });

      const validity = createValidity();

      prepareListField(createArgs({ value: ['a'], fieldConfig, validity }));

      expect(validity.patternMismatch).toBe(false);
    });
  });

  test('tests the pattern of a multiple Relation or Select field', () => {
    ['relation', 'select'].forEach((widget) => {
      const fieldConfig = /** @type {any} */ ({
        name: 'tags',
        widget,
        multiple: true,
        pattern: ['^a,b$', 'Exact'],
      });

      const validity = createValidity();

      prepareListField(createArgs({ value: ['a', 'c'], fieldConfig, validity }));

      expect(validity.patternMismatch).toBe(true);
    });
  });

  test('tests the pattern of a multiple File or Image field against the file names', () => {
    const fieldConfig = /** @type {any} */ ({
      name: 'images',
      widget: 'image',
      multiple: true,
      pattern: ['^[^,]+\\.jpg(,[^,]+\\.jpg)*$', 'JPEG only'],
    });

    const files = /** @type {any} */ ({
      'blob:https://example.com/1': { file: new File([''], 'new.jpg') },
      'blob:https://example.com/2': { file: new File([''], 'new.png') },
    });

    const valid = createValidity();

    prepareListField(
      createArgs({
        keyPath: 'images',
        value: ['/uploads/old.jpg', 'blob:https://example.com/1'],
        fieldConfig,
        files,
        validity: valid,
      }),
    );
    expect(valid.patternMismatch).toBe(false);

    const invalid = createValidity();

    prepareListField(
      createArgs({
        keyPath: 'images',
        value: ['/uploads/old.jpg', 'blob:https://example.com/2'],
        fieldConfig,
        files,
        validity: invalid,
      }),
    );
    expect(invalid.patternMismatch).toBe(true);
  });

  test('doesn’t test the pattern of a custom field taking an array', () => {
    const fieldConfig = /** @type {any} */ ({
      name: 'tags',
      widget: 'my-custom',
      pattern: ['^x$', 'Only x'],
    });

    const validity = createValidity();

    prepareListField(createArgs({ value: ['a'], fieldConfig, validity }));

    expect(validity.patternMismatch).toBe(false);
  });

  test('doesn’t test the pattern of an empty list, or with an invalid pattern option', () => {
    const empty = createValidity();

    prepareListField(
      createArgs({
        value: [],
        fieldConfig: /** @type {any} */ ({ name: 'tags', widget: 'list', pattern: ['^x$', ''] }),
        validity: empty,
      }),
    );
    expect(empty.patternMismatch).toBe(false);

    const invalidOption = createValidity();

    prepareListField(
      createArgs({
        value: ['a'],
        fieldConfig: /** @type {any} */ ({ name: 'tags', widget: 'list', pattern: '^x$' }),
        validity: invalidOption,
      }),
    );
    expect(invalidOption.patternMismatch).toBe(false);
  });
});

describe('PREPARE_FIELD_FUNCTIONS', () => {
  test('has a function for the Object, KeyValue and Code fields', () => {
    expect(Object.keys(PREPARE_FIELD_FUNCTIONS)).toEqual(['object', 'keyvalue', 'code']);
  });

  describe('object', () => {
    const prepare = PREPARE_FIELD_FUNCTIONS.object;

    test('treats an object value as a value', () => {
      const validity = createValidity();
      const value = { title: 'Hello' };

      expect(prepare(createArgs({ keyPath: 'meta', value, validity, required: true }))).toEqual({
        skip: false,
        keyPath: 'meta',
        value,
        empty: false,
      });
      expect(validity.valueMissing).toBe(false);
    });

    test('flags a required object removed with `null` as missing', () => {
      const validity = createValidity();

      expect(
        prepare(createArgs({ keyPath: 'meta', value: null, validity, required: true })),
      ).toEqual({ skip: false, keyPath: 'meta', value: null, empty: true });
      expect(validity.valueMissing).toBe(true);
    });

    test('tells from the subfields whether an object without a value is there', () => {
      const present = createValidity();

      expect(
        prepare(
          createArgs({
            keyPath: 'meta',
            valueMap: { 'meta.title': 'Hello' },
            validity: present,
            required: true,
          }),
        ),
      ).toEqual({ skip: false, keyPath: 'meta', value: undefined, empty: false });
      expect(present.valueMissing).toBe(false);

      // A key that merely starts with the same name isn’t a subfield
      const absent = createValidity();

      expect(
        prepare(
          createArgs({
            keyPath: 'meta',
            valueMap: { metadata: 'x', 'meta2.title': 'y' },
            validity: absent,
            required: true,
          }),
        ),
      ).toEqual({ skip: false, keyPath: 'meta', value: undefined, empty: true });
      expect(absent.valueMissing).toBe(true);
    });

    test('doesn’t flag an optional empty object', () => {
      const validity = createValidity();

      expect(prepare(createArgs({ keyPath: 'meta', value: null, validity })).empty).toBe(true);
      expect(validity.valueMissing).toBe(false);
    });
  });

  describe('keyvalue', () => {
    const prepare = PREPARE_FIELD_FUNCTIONS.keyvalue;

    test('passes the arguments to the KeyValue validator and returns its result', () => {
      vi.mocked(validateKeyValueField).mockReturnValue({ skip: false, keyPath: 'pairs' });

      const args = createArgs({ keyPath: 'pairs.key', value: 'v', required: true, min: 1, max: 5 });

      expect(prepare(args)).toEqual({ skip: false, keyPath: 'pairs', value: 'v', empty: false });
      expect(validateKeyValueField).toHaveBeenCalledExactlyOnceWith({
        keyPath: 'pairs.key',
        getFieldArgs: args.getFieldArgs,
        validity: args.validity,
        validities: args.validities,
        locale: '_default',
        required: true,
        min: 1,
        max: 5,
      });
    });

    test('returns whether the field is skipped or empty', () => {
      vi.mocked(validateKeyValueField).mockReturnValue({
        skip: true,
        keyPath: 'pairs',
        empty: true,
      });

      expect(prepare(createArgs({ keyPath: 'pairs' }))).toEqual({
        skip: true,
        keyPath: 'pairs',
        value: undefined,
        empty: true,
      });
    });
  });

  describe('code', () => {
    const prepare = PREPARE_FIELD_FUNCTIONS.code;

    test('passes the arguments to the Code resolver and returns its result', () => {
      vi.mocked(resolveCodeField).mockReturnValue({
        skip: false,
        keyPath: 'snippet',
        value: 'console.log(1);',
      });

      const fieldConfig = /** @type {any} */ ({ name: 'snippet', widget: 'code' });
      const valueMap = { 'snippet.code': 'console.log(1);', 'snippet.lang': 'js' };
      const args = createArgs({ keyPath: 'snippet.code', value: 'x', valueMap, fieldConfig });

      expect(prepare(args)).toEqual({
        skip: false,
        keyPath: 'snippet',
        value: 'console.log(1);',
        empty: false,
      });
      expect(resolveCodeField).toHaveBeenCalledExactlyOnceWith({
        keyPath: 'snippet.code',
        value: 'x',
        valueMap,
        fieldConfig,
        validities: args.validities,
        locale: '_default',
      });
    });

    test('returns whether the field is skipped', () => {
      vi.mocked(resolveCodeField).mockReturnValue({
        skip: true,
        keyPath: 'snippet.lang',
        value: 'js',
      });

      expect(prepare(createArgs({ keyPath: 'snippet.lang', value: 'js' }))).toEqual({
        skip: true,
        keyPath: 'snippet.lang',
        value: 'js',
        empty: false,
      });
    });
  });
});

describe('relaxEmptyFieldValidity()', () => {
  /**
   * Create a validity state with every flag set.
   * @returns {EntryValidityState} Validity state.
   */
  const createFlaggedValidity = () => ({
    valid: false,
    valueMissing: true,
    tooShort: true,
    tooLong: true,
    rangeUnderflow: true,
    rangeOverflow: true,
    patternMismatch: true,
    typeMismatch: true,
    customError: true,
  });

  test('clears the constraint flags, but keeps a missing value when enforcing required', () => {
    const validity = createFlaggedValidity();

    relaxEmptyFieldValidity(validity, true);

    expect(validity).toEqual({
      valid: false,
      valueMissing: true,
      tooShort: false,
      tooLong: true,
      rangeUnderflow: false,
      rangeOverflow: true,
      patternMismatch: false,
      typeMismatch: false,
      customError: true,
    });
  });

  test('clears a missing value too when not enforcing required', () => {
    const validity = createFlaggedValidity();

    relaxEmptyFieldValidity(validity, false);

    expect(validity.valueMissing).toBe(false);
    expect(validity.patternMismatch).toBe(false);
    expect(validity.rangeOverflow).toBe(true);
  });

  test('adds the cleared flags to an empty validity state', () => {
    /** @type {EntryValidityState} */
    const validity = {};

    relaxEmptyFieldValidity(validity, false);

    expect(validity).toEqual({
      patternMismatch: false,
      tooShort: false,
      rangeUnderflow: false,
      typeMismatch: false,
      valueMissing: false,
    });
  });
});
