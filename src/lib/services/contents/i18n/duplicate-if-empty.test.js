// @ts-nocheck
import { describe, expect, test, vi } from 'vitest';

import {
  DUPLICATE_IF_EMPTY_FIELD_TYPES,
  findDuplicateIfEmptyField,
  followsDefaultLocale,
  getMainValueKeyPath,
  isDuplicateIfEmptyField,
  isFieldEmpty,
} from '$lib/services/contents/i18n/duplicate-if-empty';

vi.mock('$lib/services/contents/entry/fields', () => ({
  /**
   * Check if the field takes multiple values, as told by its `multiple` option only.
   * @param {any} fieldConfig Field configuration.
   * @returns {boolean} Result.
   */
  isFieldMultiple: (fieldConfig) => !!fieldConfig.multiple,
}));

describe('Test isDuplicateIfEmptyField()', () => {
  test('matches a supported field type with the `duplicate_if_empty` option', () => {
    DUPLICATE_IF_EMPTY_FIELD_TYPES.forEach((widget) => {
      expect(isDuplicateIfEmptyField({ name: 'f', widget, i18n: 'duplicate_if_empty' })).toBe(true);
    });

    // The field type defaults to String
    expect(isDuplicateIfEmptyField({ name: 'f', i18n: 'duplicate_if_empty' })).toBe(true);
  });

  test('does not match another option', () => {
    [true, false, 'translate', 'duplicate', 'none', undefined].forEach((i18n) => {
      expect(isDuplicateIfEmptyField({ name: 'f', widget: 'string', i18n })).toBe(false);
    });
  });

  test('does not match an unsupported field type', () => {
    ['boolean', 'list', 'object', 'relation', 'select', 'keyvalue', 'uuid'].forEach((widget) => {
      expect(isDuplicateIfEmptyField({ name: 'f', widget, i18n: 'duplicate_if_empty' })).toBe(
        false,
      );
    });
  });

  test('does not match a field taking multiple files', () => {
    expect(
      isDuplicateIfEmptyField({
        name: 'f',
        widget: 'image',
        multiple: true,
        i18n: 'duplicate_if_empty',
      }),
    ).toBe(false);
  });
});

describe('Test getMainValueKeyPath()', () => {
  test('returns the key path of a field other than Code', () => {
    expect(getMainValueKeyPath({ name: 'title', widget: 'string' }, 'title')).toBe('title');
  });

  test('returns the key path of a Code field outputting the code only', () => {
    expect(
      getMainValueKeyPath({ name: 'code', widget: 'code', output_code_only: true }, 'code'),
    ).toBe('code');
  });

  test('returns the key path of the code in a Code field outputting an object', () => {
    expect(getMainValueKeyPath({ name: 'code', widget: 'code' }, 'code')).toBe('code.code');
    expect(
      getMainValueKeyPath(
        { name: 'code', widget: 'code', keys: { code: 'src', lang: 'type' } },
        'block.code',
      ),
    ).toBe('block.code.src');
  });
});

describe('Test isFieldEmpty()', () => {
  test('checks the main value of the field', () => {
    const fieldConfig = { name: 'code', widget: 'code' };

    expect(isFieldEmpty({ content: {}, fieldConfig, keyPath: 'code' })).toBe(true);
    expect(
      isFieldEmpty({
        content: { code: {}, 'code.code': '', 'code.lang': 'js' },
        fieldConfig,
        keyPath: 'code',
      }),
    ).toBe(true);
    expect(
      isFieldEmpty({ content: { code: {}, 'code.code': 'x' }, fieldConfig, keyPath: 'code' }),
    ).toBe(false);
  });
});

describe('Test findDuplicateIfEmptyField()', () => {
  const title = { name: 'title', widget: 'string', i18n: 'duplicate_if_empty' };
  const body = { name: 'body', widget: 'string', i18n: true };
  const code = { name: 'code', widget: 'code', i18n: 'duplicate_if_empty' };
  const codeOnly = { ...code, output_code_only: true };
  const list = { name: 'list', widget: 'list', i18n: 'duplicate_if_empty' };
  /** @type {Record<string, any>} */
  const fields = { title, body, code, 'obj.code': code, 'obj.codeOnly': codeOnly, list };
  /**
   * Look up a field.
   * @param {string} keyPath Key path.
   * @returns {any} Field.
   */
  const getFieldConfig = (keyPath) => fields[keyPath];

  test('finds the field at the key path', () => {
    expect(findDuplicateIfEmptyField('title', getFieldConfig)).toEqual({
      fieldConfig: title,
      fieldKeyPath: 'title',
    });
    expect(findDuplicateIfEmptyField('code', getFieldConfig)).toEqual({
      fieldConfig: code,
      fieldKeyPath: 'code',
    });
  });

  test('finds a Code field above its code or language', () => {
    expect(findDuplicateIfEmptyField('code.code', getFieldConfig)).toEqual({
      fieldConfig: code,
      fieldKeyPath: 'code',
    });
    expect(findDuplicateIfEmptyField('obj.code.lang', getFieldConfig)).toEqual({
      fieldConfig: code,
      fieldKeyPath: 'obj.code',
    });
  });

  test('returns `undefined` for any other value', () => {
    expect(findDuplicateIfEmptyField('body', getFieldConfig)).toBeUndefined();
    expect(findDuplicateIfEmptyField('list', getFieldConfig)).toBeUndefined();
    expect(findDuplicateIfEmptyField('unknown', getFieldConfig)).toBeUndefined();
    expect(findDuplicateIfEmptyField('body.x', getFieldConfig)).toBeUndefined();
    expect(findDuplicateIfEmptyField('obj.codeOnly.code', getFieldConfig)).toBeUndefined();
  });
});

describe('followsDefaultLocale()', () => {
  const fieldConfig = { name: 'title', widget: 'string' };
  const args = { fieldConfig, sourceLocale: 'en', targetLocale: 'fr' };

  test('follows when the target value is empty or the default locale’s previous value', () => {
    expect(followsDefaultLocale({ ...args, targetValue: '', previousValue: 'A' })).toBe(true);
    expect(followsDefaultLocale({ ...args, targetValue: 'A', previousValue: 'A' })).toBe(true);
  });

  test('does not follow when the target has a value of its own', () => {
    expect(followsDefaultLocale({ ...args, targetValue: 'B', previousValue: 'A' })).toBe(false);
  });
});
