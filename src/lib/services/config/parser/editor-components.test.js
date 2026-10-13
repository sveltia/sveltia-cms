import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  INLINE_COMPONENT_FIELD_TYPES,
  isInlineComponentFieldList,
  parseEditorComponent,
} from '$lib/services/config/parser/editor-components';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/** @type {any} */
const cmsConfig = {};

/**
 * Parse a component with the given options.
 * @param {Record<string, any>} options Component options.
 */
const check = (options) => {
  parseEditorComponent({
    definition: /** @type {any} */ ({ id: 'mention', fields: [], ...options }),
    componentName: 'mention',
    cmsConfig,
    collectors,
  });
};

describe('isInlineComponentFieldList()', () => {
  test.each(INLINE_COMPONENT_FIELD_TYPES)('accepts a single `%s` field', (widget) => {
    expect(isInlineComponentFieldList([{ name: 'value', widget }])).toBe(true);
  });

  test('accepts a field without a type, which is a String field', () => {
    expect(isInlineComponentFieldList([{ name: 'value' }])).toBe(true);
  });

  test.each(['select', 'relation'])('rejects a `%s` field with multiple values', (widget) => {
    expect(
      isInlineComponentFieldList([/** @type {any} */ ({ name: 'value', widget, multiple: true })]),
    ).toBe(false);
    expect(
      isInlineComponentFieldList([/** @type {any} */ ({ name: 'value', widget, multiple: false })]),
    ).toBe(true);
  });

  test.each(['text', 'image', 'list', 'object', 'richtext', 'hidden'])(
    'rejects a `%s` field',
    (widget) => {
      expect(isInlineComponentFieldList([{ name: 'value', widget }])).toBe(false);
    },
  );

  test('rejects no field or several fields', () => {
    expect(isInlineComponentFieldList([])).toBe(false);
    expect(
      isInlineComponentFieldList([
        { name: 'first', widget: 'string' },
        { name: 'second', widget: 'string' },
      ]),
    ).toBe(false);
  });
});

describe('parseEditorComponent()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('reports an `inline` component with fields it can’t have', () => {
    check({ mode: 'inline', fields: [{ name: 'body', widget: 'text' }] });
    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'invalid_inline_component_fields',
      context: { cmsConfig, componentName: 'mention' },
      collectors,
    });
  });

  test('says nothing about a valid `inline` component', () => {
    check({ mode: 'inline', fields: [{ name: 'date', widget: 'datetime' }] });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('says nothing about the fields of a component in another mode', () => {
    check({ fields: [{ name: 'body', widget: 'text' }] });
    check({ mode: 'dialog', fields: [] });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
