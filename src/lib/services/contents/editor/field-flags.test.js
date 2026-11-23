import { describe, expect, test } from 'vitest';

import {
  getEditorFieldConfig,
  getFieldEditorFlags,
  getFieldInputLabels,
  TRANSLATABLE_FIELD_TYPES,
} from './field-flags';

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
    ).toEqual({ hidden: false, readonly: false, subfieldsReadonly: false });
  });

  test('honors the readonly option', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'title', widget: 'string', readonly: true },
      }),
    ).toEqual({ hidden: false, readonly: true, subfieldsReadonly: true });
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

  test('lets the read_only option unlock a UUID field, but not override a lock', () => {
    /** @type {Field} */
    const fieldConfig = { name: 'id', widget: 'uuid', read_only: false };

    expect(getFieldEditorFlags({ ...defaults, fieldConfig }).readonly).toBe(false);
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'id', widget: 'uuid', read_only: true },
      }).readonly,
    ).toBe(true);
    expect(getFieldEditorFlags({ ...defaults, fieldConfig, locked: true }).readonly).toBe(true);
    expect(getFieldEditorFlags({ ...defaults, fieldConfig, isDuplicated: true }).readonly).toBe(
      true,
    );
  });

  test('hides a Compute field and makes it read-only', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: /** @type {Field} */ ({ name: 'slug', widget: 'compute', value: '' }),
      }),
    ).toEqual({ hidden: true, readonly: true, subfieldsReadonly: false });
  });

  test('makes a field set on save read-only, and hides it in a new entry', () => {
    const fieldConfig = /** @type {Field} */ ({ name: 'date', widget: 'datetime' });

    expect(getFieldEditorFlags({ ...defaults, fieldConfig, autoSet: true })).toEqual({
      hidden: false,
      readonly: true,
      subfieldsReadonly: false,
    });
    expect(getFieldEditorFlags({ ...defaults, fieldConfig, autoSet: true, isNew: true })).toEqual({
      hidden: true,
      readonly: true,
      subfieldsReadonly: false,
    });
    expect(getFieldEditorFlags({ ...defaults, fieldConfig, isNew: true })).toEqual({
      hidden: false,
      readonly: false,
      subfieldsReadonly: false,
    });
  });

  // Each subfield works out the lock itself
  test('makes the field read-only when locked', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'title', widget: 'string', readonly: false },
        locked: true,
      }),
    ).toEqual({ hidden: false, readonly: true, subfieldsReadonly: false });
  });

  // A subfield made translatable has a value of its own, so it can still be edited
  test('makes only the field read-only when duplicated', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'items', widget: 'list' },
        isDuplicated: true,
      }),
    ).toEqual({ hidden: false, readonly: true, subfieldsReadonly: false });
  });

  test('makes a subfield of a read-only field read-only, which it can’t opt out of', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'title', widget: 'string', readonly: false },
        parentReadonly: true,
      }),
    ).toEqual({ hidden: false, readonly: true, subfieldsReadonly: true });
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'id', widget: 'uuid', readonly: false },
        parentReadonly: true,
      }).readonly,
    ).toBe(true);
  });

  test('passes the readonly option of a List or Object field down to the subfields', () => {
    expect(
      getFieldEditorFlags({
        ...defaults,
        fieldConfig: { name: 'items', widget: 'list', readonly: true },
      }).subfieldsReadonly,
    ).toBe(true);
    // The UUID default only applies to the field itself
    expect(
      getFieldEditorFlags({ ...defaults, fieldConfig: { name: 'id', widget: 'uuid' } })
        .subfieldsReadonly,
    ).toBe(false);
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

describe('Test TRANSLATABLE_FIELD_TYPES', () => {
  test('lists the field types the Translate button supports', () => {
    expect(TRANSLATABLE_FIELD_TYPES).toEqual([
      'richtext',
      'markdown',
      'string',
      'text',
      'list',
      'object',
    ]);
  });
});
