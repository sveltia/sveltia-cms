import { describe, expect, test } from 'vitest';

import { getEditorFieldConfig, getFieldEditorFlags, getFieldInputLabels } from './field-flags';

/**
 * @import { Field } from '$lib/types/public';
 */

describe('Test getFieldInputLabels()', () => {
  const labels = { prefix: '$', suffix: 'USD', before_input: '**Before**', after_input: 'After' };

  test('returns all the labels for a String field', () => {
    expect(getFieldInputLabels({ name: 'price', widget: 'string', ...labels })).toEqual({
      prefix: '$',
      suffix: 'USD',
      beforeInputLabel: '**Before**',
      afterInputLabel: 'After',
      hasExtraLabels: true,
    });
  });

  test('treats a field without a type as a String field', () => {
    expect(getFieldInputLabels(/** @type {Field} */ ({ name: 'price', ...labels }))).toEqual({
      prefix: '$',
      suffix: 'USD',
      beforeInputLabel: '**Before**',
      afterInputLabel: 'After',
      hasExtraLabels: true,
    });
  });

  test.each(['boolean', 'number'])('ignores prefix and suffix for a %s field', (widget) => {
    expect(getFieldInputLabels(/** @type {Field} */ ({ name: 'f', widget, ...labels }))).toEqual({
      prefix: undefined,
      suffix: undefined,
      beforeInputLabel: '**Before**',
      afterInputLabel: 'After',
      hasExtraLabels: true,
    });
  });

  test('ignores all the labels for other field types', () => {
    expect(
      getFieldInputLabels(/** @type {Field} */ ({ name: 'f', widget: 'text', ...labels })),
    ).toEqual({
      prefix: undefined,
      suffix: undefined,
      beforeInputLabel: undefined,
      afterInputLabel: undefined,
      hasExtraLabels: false,
    });
  });

  test('reports no extra labels when none is set', () => {
    expect(getFieldInputLabels({ name: 'title', widget: 'string' }).hasExtraLabels).toBe(false);
  });

  test.each([
    [{ prefix: '$' }],
    [{ suffix: 'USD' }],
    [{ before_input: 'Before' }],
    [{ after_input: 'After' }],
  ])('reports extra labels when only %o is set', (option) => {
    expect(getFieldInputLabels({ name: 'title', widget: 'string', ...option }).hasExtraLabels).toBe(
      true,
    );
  });
});

describe('Test getFieldEditorFlags()', () => {
  const defaults = { autoSet: false, locked: false, isDuplicated: false, isNew: false };

  test('returns false for both flags for a plain field', () => {
    expect(
      getFieldEditorFlags({ ...defaults, fieldConfig: { name: 'title', widget: 'string' } }),
    ).toEqual({ hidden: false, readonly: false });
  });

  test('honors the readonly option', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'title', widget: 'string', readonly: true },
      }),
    ).toEqual({ hidden: false, readonly: true });
  });

  test('makes a UUID field read-only by default, which the readonly option can unlock', () => {
    expect(
      getFieldEditorFlags({ ...defaults, fieldConfig: { name: 'id', widget: 'uuid' } }).readonly,
    ).toBe(true);
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'id', widget: 'uuid', readonly: false },
      }).readonly,
    ).toBe(false);
  });

  test('hides a Compute field and makes it read-only', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: /** @type {Field} */ ({ name: 'slug', widget: 'compute', value: '' }),
      }),
    ).toEqual({ hidden: true, readonly: true });
  });

  test('makes a field set on save read-only, and hides it in a new entry', () => {
    const fieldConfig = /** @type {Field} */ ({ name: 'date', widget: 'datetime' });

    expect(getFieldEditorFlags({ ...defaults, fieldConfig, autoSet: true })).toEqual({
      hidden: false,
      readonly: true,
    });
    expect(getFieldEditorFlags({ ...defaults, fieldConfig, autoSet: true, isNew: true })).toEqual({
      hidden: true,
      readonly: true,
    });
    expect(getFieldEditorFlags({ ...defaults, fieldConfig, isNew: true })).toEqual({
      hidden: false,
      readonly: false,
    });
  });

  test.each(['locked', 'isDuplicated'])('makes the field read-only when %s', (key) => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'title', widget: 'string', readonly: false },
        [key]: true,
      }),
    ).toEqual({ hidden: false, readonly: true });
  });
});

describe('Test getEditorFieldConfig()', () => {
  test.each(['select', 'relation'])('sets dropdown_threshold to 0 for an inline %s', (widget) => {
    const fieldConfig = /** @type {Field} */ ({ name: 'f', widget, dropdown_threshold: 5 });
    const result = getEditorFieldConfig({ fieldConfig, inline: true });

    expect(result).toEqual({ ...fieldConfig, dropdown_threshold: 0 });
    expect(result).not.toBe(fieldConfig);
    expect(fieldConfig).toHaveProperty('dropdown_threshold', 5);
  });

  test('returns the same configuration for a Select field that isn’t inline', () => {
    const fieldConfig = /** @type {Field} */ ({ name: 'f', widget: 'select', options: [] });

    expect(getEditorFieldConfig({ fieldConfig, inline: false })).toBe(fieldConfig);
  });

  test.each(['string', 'boolean', undefined])(
    'returns the same configuration for an inline %s field',
    (widget) => {
      const fieldConfig = /** @type {Field} */ ({ name: 'f', widget });

      expect(getEditorFieldConfig({ fieldConfig, inline: true })).toBe(fieldConfig);
    },
  );
});
