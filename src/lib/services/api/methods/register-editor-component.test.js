/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

import { preloadImmutable } from '$lib/services/api/immutable';

vi.mock('$lib/services/api/immutable', () => ({
  preloadImmutable: vi.fn(),
}));
// There is no document here, so check the selector syntax roughly; the function itself is tested
// along with the rich text component utilities
vi.mock('$lib/services/contents/fields/rich-text/components/utils', async (importOriginal) => ({
  ...(await importOriginal()),
  // @ts-ignore
  isValidSelector: (selector) => !!selector && !selector.endsWith('('),
}));

const { registerEditorComponent } =
  await import('$lib/services/api/methods/register-editor-component');

describe('CMS.registerEditorComponent()', () => {
  const validDefinition = {
    id: 'test-component',
    label: 'Test Component',
    pattern: /test/,
    toBlock: () => 'block',
    toPreview: () => 'preview',
    fields: [],
  };

  test('registers valid component definition', () => {
    expect(() => registerEditorComponent(validDefinition)).not.toThrow();
  });

  test('normalizes the template tags of a field-based component', () => {
    const definition = {
      ...validDefinition,
      id: 'normalized-component',
      summary: '{{ fields.id }}',
      fields: [{ name: 'id', widget: 'compute', value: '{{ fields.key|upper }}' }],
    };

    registerEditorComponent(definition);

    expect(definition.summary).toBe('{{fields.id}}');
    expect(definition.fields[0].value).toBe('{{fields.key | upper}}');
  });

  test('throws TypeError if definition is not an object', () => {
    // @ts-ignore
    expect(() => registerEditorComponent(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEditorComponent(undefined)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEditorComponent('invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEditorComponent(123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEditorComponent([])).toThrow(
      'The `definition` option for `CMS.registerEditorComponent()` must be an object',
    );
  });

  test('throws with proper error message for non-object definition', () => {
    // @ts-ignore
    expect(() => registerEditorComponent(null)).toThrow(
      'The `definition` option for `CMS.registerEditorComponent()` must be an object',
    );
  });

  test('throws TypeError if id is not a non-empty string', () => {
    const definition = { ...validDefinition, id: 123 };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(TypeError);

    const whitespaceDefinition = { ...validDefinition, id: '   ' };

    // @ts-ignore
    expect(() => registerEditorComponent(whitespaceDefinition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid id', () => {
    const definition = { ...validDefinition, id: 123 };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(
      'The `definition.id` must be a non-empty string',
    );
  });

  test('accepts a definition without the optional label and toPreview', () => {
    const { label: _label, toPreview: _toPreview, ...definition } = validDefinition;

    expect(() => registerEditorComponent(definition)).not.toThrow();
  });

  test('throws TypeError if label is not a non-empty string', () => {
    const definition = { ...validDefinition, label: 123 };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(TypeError);

    const whitespaceDefinition = { ...validDefinition, label: '   ' };

    // @ts-ignore
    expect(() => registerEditorComponent(whitespaceDefinition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid label', () => {
    const definition = { ...validDefinition, label: 123 };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(
      'The `definition.label` must be a non-empty string',
    );
  });

  test('throws TypeError if pattern is not a RegExp', () => {
    const definition = { ...validDefinition, pattern: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(TypeError);

    const definition2 = { ...validDefinition, pattern: {} };

    // @ts-ignore
    expect(() => registerEditorComponent(definition2)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid pattern', () => {
    const definition = { ...validDefinition, pattern: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(
      'The `definition.pattern` must be a RegExp',
    );
  });

  test('throws TypeError if toBlock is not a function', () => {
    const definition = { ...validDefinition, toBlock: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid toBlock', () => {
    const definition = { ...validDefinition, toBlock: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(
      'The `definition.toBlock` must be a function',
    );
  });

  test('throws TypeError if toPreview is not a function', () => {
    const definition = { ...validDefinition, toPreview: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid toPreview', () => {
    const definition = { ...validDefinition, toPreview: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(
      'The `definition.toPreview` must be a function',
    );
  });

  test('registers a component with the HTML syntax', () => {
    expect(() =>
      registerEditorComponent({
        ...validDefinition,
        htmlSelector: 'aside.note, figure > img',
        fromBlockHTML: () => ({}),
        toBlockHTML: () => '<aside class="note"></aside>',
      }),
    ).not.toThrow();
  });

  test('throws with proper error messages for the invalid HTML syntax', () => {
    const htmlOptions = {
      htmlSelector: 'aside.note',
      fromBlockHTML: () => ({}),
      toBlockHTML: () => '<aside class="note"></aside>',
    };

    /**
     * Get a function registering a component with the given HTML options.
     * @param {Record<string, any>} options Options to override.
     * @returns {() => void} Function.
     */
    const register = (options) => () =>
      // @ts-ignore
      registerEditorComponent({ ...validDefinition, ...htmlOptions, ...options });

    const togetherMessage =
      'The `definition.htmlSelector`, `definition.fromBlockHTML` and `definition.toBlockHTML` ' +
      'must be given together';

    expect(register({ htmlSelector: undefined })).toThrow(togetherMessage);
    expect(register({ fromBlockHTML: undefined })).toThrow(togetherMessage);
    expect(register({ toBlockHTML: undefined })).toThrow(togetherMessage);
    expect(register({ htmlSelector: '' })).toThrow(
      'The `definition.htmlSelector` must be a valid CSS selector',
    );
    expect(register({ htmlSelector: 42 })).toThrow(
      'The `definition.htmlSelector` must be a valid CSS selector',
    );
    expect(register({ htmlSelector: 'aside:has(' })).toThrow(
      'The `definition.htmlSelector` must be a valid CSS selector',
    );
    expect(register({ htmlSelector: 'aside, .note' })).toThrow(
      'Each selector in the `definition.htmlSelector` must name the element type it matches',
    );
    expect(register({ fromBlockHTML: 'invalid' })).toThrow(
      'The `definition.fromBlockHTML` must be a function',
    );
    expect(register({ toBlockHTML: 'invalid' })).toThrow(
      'The `definition.toBlockHTML` must be a function',
    );
  });

  test('throws TypeError if fields is not an array', () => {
    const definition = { ...validDefinition, fields: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(TypeError);

    const definition2 = { ...validDefinition, fields: {} };

    // @ts-ignore
    expect(() => registerEditorComponent(definition2)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid fields', () => {
    const definition = { ...validDefinition, fields: 'invalid' };

    // @ts-ignore
    expect(() => registerEditorComponent(definition)).toThrow(
      'The `definition.fields` must be an array',
    );
  });

  test('accepts optional icon and collapsed properties', () => {
    const definition = {
      ...validDefinition,
      icon: 'star',
      collapsed: true,
    };

    expect(() => registerEditorComponent(definition)).not.toThrow();
  });

  test('accepts empty fields array', () => {
    const definition = { ...validDefinition, fields: [] };

    expect(() => registerEditorComponent(definition)).not.toThrow();
  });

  test('accepts fields array with items', () => {
    const definition = {
      ...validDefinition,
      fields: [{ name: 'field1', widget: 'string' }],
    };

    expect(() => registerEditorComponent(definition)).not.toThrow();
  });

  test('accepts fromBlock method when present', () => {
    const definition = {
      ...validDefinition,
      fromBlock: () => ({}),
    };

    expect(() => registerEditorComponent(definition)).not.toThrow();
  });

  test('preloads Immutable.js only if `toPreview` takes the field list', () => {
    registerEditorComponent(validDefinition);
    registerEditorComponent({ ...validDefinition, toPreview: undefined });
    expect(preloadImmutable).not.toHaveBeenCalled();

    registerEditorComponent({
      ...validDefinition,
      toPreview: (
        /** @type {any} */ _props,
        /** @type {any} */ _getAsset,
        /** @type {any} */ _fields,
      ) => 'preview',
    });
    expect(preloadImmutable).toHaveBeenCalledOnce();
  });

  describe('pattern-based inline components', () => {
    const inlineDefinition = {
      id: 'wikilink',
      label: 'Wikilink',
      type: /** @type {const} */ ('inline'),
      pattern: /\[\[(.+?)\]\]/,
      trigger: '[[',
      fromInline: (/** @type {RegExpMatchArray} */ match) => ({ page: match[1] }),
      toInline: ({ page = '' }) => `[[${page}]]`,
      toPreview: ({ page = '' }) => `<a>${page}</a>`,
      onInsert: async () => ({ page: 'A' }),
      onEdit: async () => null,
    };

    test('registers a valid definition without fields', async () => {
      const { customComponentRegistry } = await import('$lib/services/api/registries');

      expect(() => registerEditorComponent(inlineDefinition)).not.toThrow();
      expect(customComponentRegistry.get('wikilink')).toBe(inlineDefinition);
    });

    test('accepts `fromBlock` and `toBlock` in place of the inline functions', () => {
      expect(() =>
        registerEditorComponent(
          /** @type {any} */ ({
            id: 'legacy',
            type: 'inline',
            pattern: /@\w+/,
            fromBlock: () => ({}),
            toBlock: () => '',
          }),
        ),
      ).not.toThrow();
    });

    test('throws if `toInline` is missing', () => {
      expect(() =>
        registerEditorComponent({ ...inlineDefinition, toInline: /** @type {any} */ (undefined) }),
      ).toThrow('The `definition.toInline` must be a function');
    });

    test.each(['fromInline', 'toPreview', 'onInsert', 'onEdit'])(
      'throws if `%s` is not a function',
      (name) => {
        expect(() => registerEditorComponent({ ...inlineDefinition, [name]: 'x' })).toThrow(
          `The \`definition.${name}\` must be a function`,
        );
      },
    );

    test('throws if `trigger` is not a non-empty string', () => {
      expect(() =>
        registerEditorComponent({ ...inlineDefinition, trigger: /** @type {any} */ (1) }),
      ).toThrow('The `definition.trigger` must be a non-empty string');
      expect(() => registerEditorComponent({ ...inlineDefinition, trigger: '' })).toThrow(
        TypeError,
      );
    });

    test('throws if `pattern` is not a RegExp', () => {
      expect(() =>
        registerEditorComponent({ ...inlineDefinition, pattern: /** @type {any} */ ('x') }),
      ).toThrow('The `definition.pattern` must be a RegExp');
    });
  });
});
