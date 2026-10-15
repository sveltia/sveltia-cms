import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCollectors } from '$lib/test/config-parser';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.invalid_list_variable_type': 'List variable type must be object, got {widget}',
  'config.error.invalid_list_field': 'List field cannot have multiple options',
};

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ strings: mockI18nStrings, locale: 'en-US' }),
);

const mockAddMessage = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkName: vi.fn(() => true),
}));

const mockParseFieldConfig = vi.fn();
const mockParseFields = vi.fn();

vi.mock('$lib/services/config/parser/fields/registry', () => ({
  parseFieldConfig: mockParseFieldConfig,
  parseFields: mockParseFields,
}));

/**
 * Create a fresh context object for testing.
 * @returns {ConfigParserContext} Context instance.
 */
function createContext() {
  return {
    cmsConfig: { backend: { name: 'github', repo: 'test/repo' } },
    collection: { name: 'test', files: [], label: 'Test' },
    typedKeyPath: 'config.collections.0.fields.0',
  };
}

describe('List Field Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkFieldType', () => {
    it('should allow object field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('object', context, collectors);

      expect(result).toBe(true);
    });

    it('should reject string field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('string', context, collectors);

      expect(result).toBe(false);
      expect(mockAddMessage).toHaveBeenCalled();
    });

    it('should reject number field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('number', context, collectors);

      expect(result).toBe(false);
    });

    it('should reject boolean field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('boolean', context, collectors);

      expect(result).toBe(false);
    });

    it('should reject select field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('select', context, collectors);

      expect(result).toBe(false);
    });
  });

  describe('parseListFieldConfig', () => {
    it('should parse list field with object subfield', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          field: {
            name: 'item',
            widget: 'string',
          },
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockParseFieldConfig).toHaveBeenCalled();
    });

    it('should parse list field with types', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          types: [
            {
              name: 'type1',
              widget: 'object',
              fields: [{ name: 'f1', widget: 'string' }],
            },
          ],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockParseFields).toHaveBeenCalled();
    });

    it('should error when field and subfields are both present', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          field: { name: 'f1', widget: 'string' },
          fields: [{ name: 'f2', widget: 'string' }],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_list_field',
        }),
      );
    });

    it('should error when field and types are both present', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          field: { name: 'f1', widget: 'string' },
          types: [{ name: 't1', widget: 'object', fields: [] }],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_list_field',
        }),
      );
    });

    it('should error when fields and types are both present', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          fields: [{ name: 'f1', widget: 'string' }],
          types: [{ name: 't1', widget: 'object', fields: [] }],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_list_field',
        }),
      );
    });

    it('should handle types with invalid field type', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          types: [
            {
              name: 'type1',
              widget: 'string', // Invalid: not object
              fields: [{ name: 'f1', widget: 'string' }],
            },
          ],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      // Should not parse fields when type is invalid
      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should handle types without fields', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          types: [
            {
              name: 'type1',
              widget: 'object',
              // no fields
            },
          ],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      // Should not parse fields when none exist
      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should error on an empty subfield or type list', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      parseListFieldConfig({
        config: { name: 'items', widget: 'list', fields: [] },
        context,
        collectors,
      });
      parseListFieldConfig({
        config: { name: 'items', widget: 'list', types: [] },
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledTimes(2);
      expect(mockAddMessage).toHaveBeenCalledWith({
        strKey: 'list_field_no_subfields',
        context,
        collectors,
      });
      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should accept a list without subfields, which holds plain values', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      parseListFieldConfig({ config: { name: 'tags', widget: 'list' }, context, collectors });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should accept a thumbnail that names a subfield', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const subfields = [
        { name: 'image', widget: 'image' },
        { name: 'caption', widget: 'string' },
      ];

      parseListFieldConfig({
        config: { name: 'items', widget: 'list', fields: subfields, thumbnail: 'image' },
        context,
        collectors,
      });

      parseListFieldConfig({
        config: { name: 'items', widget: 'list', fields: subfields, thumbnail: 'fields.image' },
        context,
        collectors,
      });

      parseListFieldConfig({
        config: {
          name: 'items',
          widget: 'list',
          types: [{ name: 'photo', fields: subfields }],
          thumbnail: 'image',
        },
        context,
        collectors,
      });

      parseListFieldConfig({
        config: {
          name: 'images',
          widget: 'list',
          field: { name: 'image', widget: 'image' },
          thumbnail: 'image',
        },
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a thumbnail that names a subfield of another type', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      parseListFieldConfig({
        config: {
          name: 'items',
          widget: 'list',
          fields: [{ name: 'caption', widget: 'string' }],
          thumbnail: 'caption',
        },
        context,
        collectors,
      });

      parseListFieldConfig({
        config: {
          name: 'tags',
          widget: 'list',
          field: { name: 'tag', widget: 'string' },
          thumbnail: 'tag',
        },
        context,
        collectors,
      });

      expect(mockAddMessage.mock.calls.map(([args]) => args)).toEqual([
        {
          strKey: 'thumbnail_field_not_media',
          values: { name: 'caption', widget: 'string' },
          context,
          collectors,
        },
        {
          strKey: 'thumbnail_field_not_media',
          values: { name: 'tag', widget: 'string' },
          context,
          collectors,
        },
      ]);
    });

    it('should error on a thumbnail that names no subfield', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      parseListFieldConfig({
        config: {
          name: 'items',
          widget: 'list',
          fields: [{ name: 'image', widget: 'image' }],
          thumbnail: 'photo',
        },
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'option_field_not_found',
        values: { option: 'thumbnail', name: 'photo' },
        context,
        collectors,
      });
    });
  });

  describe('checkDefaultValue', () => {
    /**
     * Run the check against a List field with the given options.
     * @param {Record<string, any>} options List field options.
     * @returns {Promise<{ context: ConfigParserContext, collectors: ConfigParserCollectors }>}
     * Arguments passed to the check, to match a reported message against.
     */
    const check = async (options) => {
      const { checkDefaultValue } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      checkDefaultValue({
        config: { name: 'items', widget: 'list', ...options },
        context,
        collectors,
      });

      return { context, collectors };
    };

    it('should skip a missing default', async () => {
      await check({});
      await check({ fields: [{ name: 'title', widget: 'string' }] });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should skip a default that is not an array, which the schema reports', async () => {
      await check({ default: { title: 'Title' }, fields: [{ name: 'title', widget: 'string' }] });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should accept plain values in a simple list', async () => {
      await check({ default: ['a', 'b'] });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on an object in a simple list', async () => {
      const { context, collectors } = await check({ default: ['a', { title: 'b' }] });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_object',
        context,
        collectors,
      });
    });

    it('should error on an object in a list with a single field of a plain type', async () => {
      const { context, collectors } = await check({
        field: { name: 'tag', widget: 'string' },
        default: [{ tag: 'a' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_object',
        context,
        collectors,
      });
    });

    it('should treat a single field without a widget as a String field', async () => {
      await check({ field: { name: 'tag' }, default: [{ tag: 'a' }] });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'list_field_invalid_default_object' }),
      );
    });

    it('should accept an object in a list with a single Object or KeyValue field', async () => {
      await check({
        field: { name: 'author', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
        default: [{ name: 'Alice' }],
      });
      await check({ field: { name: 'meta', widget: 'keyvalue' }, default: [{ key: 'value' }] });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should accept an object in a list with a single custom field', async () => {
      await check({ field: { name: 'geo', widget: 'my-custom' }, default: [{ lat: 0, lng: 0 }] });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should accept objects with known properties in a list with fields', async () => {
      await check({
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'body', widget: 'text' },
        ],
        default: [{ title: 'A', body: 'a' }, { title: 'B' }],
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a plain value in a list with fields', async () => {
      const { context, collectors } = await check({
        fields: [{ name: 'title', widget: 'string' }],
        default: ['A', { title: 'B' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_item',
        values: { value: 'A' },
        context,
        collectors,
      });
    });

    it('should error on each unknown property in a list with fields', async () => {
      const { context, collectors } = await check({
        fields: [{ name: 'title', widget: 'string' }],
        default: [{ title: 'A', titel: 'A', body: 'a' }],
      });

      expect(mockAddMessage).toHaveBeenCalledTimes(2);
      expect(mockAddMessage).toHaveBeenCalledWith({
        strKey: 'list_field_invalid_default_key',
        values: { key: 'titel' },
        context,
        collectors,
      });
      expect(mockAddMessage).toHaveBeenCalledWith({
        strKey: 'list_field_invalid_default_key',
        values: { key: 'body' },
        context,
        collectors,
      });
    });

    it('should accept objects naming a type and its fields in a list with types', async () => {
      await check({
        types: [{ name: 'text', fields: [{ name: 'body', widget: 'text' }] }, { name: 'divider' }],
        default: [{ type: 'text', body: 'a' }, { type: 'divider' }],
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should respect a custom typeKey', async () => {
      await check({
        typeKey: 'kind',
        types: [{ name: 'text', fields: [{ name: 'body', widget: 'text' }] }],
        default: [{ kind: 'text', body: 'a' }],
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a plain value in a list with types', async () => {
      const { context, collectors } = await check({
        types: [{ name: 'text' }],
        default: [1],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_item',
        values: { value: '1' },
        context,
        collectors,
      });
    });

    it('should error on an item without the type key', async () => {
      const { context, collectors } = await check({
        typeKey: 'kind',
        types: [{ name: 'text', fields: [{ name: 'body', widget: 'text' }] }],
        default: [{ body: 'a' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_default_missing_type',
        values: { typeKey: 'kind' },
        context,
        collectors,
      });
    });

    it('should error on an item naming an unknown type', async () => {
      const { context, collectors } = await check({
        types: [{ name: 'text' }],
        default: [{ type: 'image' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_type',
        values: { typeKey: 'type', value: 'image' },
        context,
        collectors,
      });
    });

    it('should error on a property that is not a field of the named type', async () => {
      const { context, collectors } = await check({
        types: [
          { name: 'text', fields: [{ name: 'body', widget: 'text' }] },
          { name: 'image', fields: [{ name: 'src', widget: 'image' }] },
        ],
        default: [{ type: 'text', src: 'a.png' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_key',
        values: { key: 'src' },
        context,
        collectors,
      });
    });

    it('should run as part of parseListFieldConfig', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      parseListFieldConfig({
        config: { name: 'items', widget: 'list', default: [{ title: 'a' }] },
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_invalid_default_object',
        context,
        collectors,
      });
    });
  });

  describe('checkMapKeyField', () => {
    /**
     * Run the check against a List field with the given options.
     * @param {Record<string, any>} options List field options.
     * @returns {Promise<{ context: ConfigParserContext, collectors: ConfigParserCollectors }>}
     * Arguments passed to the check, to match a reported message against.
     */
    const check = async (options) => {
      const { checkMapKeyField } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      checkMapKeyField({
        config: { name: 'items', widget: 'list', ...options },
        context,
        collectors,
      });

      return { context, collectors };
    };

    it('should skip a missing option, an empty name and a value of another type', async () => {
      await check({});
      await check({ map_key_field: '' });
      await check({ map_key_field: 1 });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should accept a String subfield, explicit or by default', async () => {
      await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'string', i18n: 'duplicate' }, { name: 'title' }],
      });
      await check({ map_key_field: 'key', fields: [{ name: 'key' }] });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should accept a String subfield in every variable type', async () => {
      await check({
        map_key_field: 'key',
        types: [
          { name: 'book', fields: [{ name: 'key', widget: 'string' }] },
          { name: 'web', fields: [{ name: 'key' }, { name: 'url' }] },
        ],
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a list without subfields or variable types', async () => {
      const { context, collectors } = await check({ map_key_field: 'key' });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_no_subfields',
        context,
        collectors,
      });

      mockAddMessage.mockClear();

      const result = await check({ map_key_field: 'key', field: { name: 'key' } });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_no_subfields',
        context: result.context,
        collectors: result.collectors,
      });
    });

    it('should error on a missing subfield', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        fields: [{ name: 'title' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_not_found',
        values: { name: 'key', type: undefined },
        context,
        collectors,
      });
    });

    it('should error on each variable type missing the subfield', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        types: [
          { name: 'book', fields: [{ name: 'key' }] },
          { name: 'web', fields: [{ name: 'url' }] },
          { name: 'empty' },
        ],
      });

      expect(mockAddMessage).toHaveBeenCalledTimes(2);
      expect(mockAddMessage).toHaveBeenCalledWith({
        strKey: 'list_field_map_key_missing_in_type',
        values: { name: 'key', type: 'web' },
        context,
        collectors,
      });
      expect(mockAddMessage).toHaveBeenCalledWith({
        strKey: 'list_field_map_key_missing_in_type',
        values: { name: 'key', type: 'empty' },
        context,
        collectors,
      });
    });

    it('should accept a single-value Relation or Select subfield', async () => {
      await check({
        map_key_field: 'page',
        fields: [
          { name: 'page', widget: 'relation', collection: 'pages', value_field: '{{slug}}' },
          { name: 'xyz' },
        ],
      });
      await check({
        map_key_field: 'size',
        fields: [
          { name: 'size', widget: 'select', options: ['small', { label: 'L', value: 'large' }] },
        ],
      });
      await check({
        map_key_field: 'key',
        types: [
          {
            name: 'link',
            fields: [{ name: 'key', widget: 'relation', collection: 'pages', multiple: false }],
          },
          { name: 'custom', fields: [{ name: 'key' }] },
        ],
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a subfield of another type', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'number' }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_invalid_type',
        values: { name: 'key', widget: 'number' },
        context,
        collectors,
      });
    });

    it('should error on a Relation or Select subfield taking multiple values', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'relation', collection: 'pages', multiple: true }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_multiple',
        values: { name: 'key' },
        context,
        collectors,
      });

      mockAddMessage.mockClear();

      await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'select', options: ['a', 'b'], multiple: true }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'list_field_map_key_multiple' }),
      );
    });

    it('should error on a Select subfield with an option value other than a string', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'select', options: ['a', { label: 'B', value: 1.5 }] }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_option_not_string',
        values: { name: 'key' },
        context,
        collectors,
      });

      mockAddMessage.mockClear();

      await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'select', options: [2] }],
      });

      expect(mockAddMessage).toHaveBeenCalledOnce();

      mockAddMessage.mockClear();

      // Missing or invalid options are reported by the Select field parser
      await check({ map_key_field: 'key', fields: [{ name: 'key', widget: 'select' }] });
      await check({
        map_key_field: 'key',
        fields: [{ name: 'key', widget: 'select', options: 'a' }],
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a subfield that is optional in any locale', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        fields: [{ name: 'key', required: false }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_not_required',
        values: { name: 'key' },
        context,
        collectors,
      });

      mockAddMessage.mockClear();

      await check({ map_key_field: 'key', fields: [{ name: 'key', required: ['en'] }] });

      expect(mockAddMessage).toHaveBeenCalledOnce();
    });

    it('should error on a subfield that only exists in the default locale', async () => {
      const { context, collectors } = await check({
        map_key_field: 'key',
        fields: [{ name: 'key', i18n: false }],
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'list_field_map_key_not_localized',
        values: { name: 'key' },
        context,
        collectors,
      });

      mockAddMessage.mockClear();

      await check({ map_key_field: 'key', fields: [{ name: 'key', i18n: 'none' }] });

      expect(mockAddMessage).toHaveBeenCalledOnce();
    });

    it('should be run by parseListFieldConfig', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      parseListFieldConfig({
        config: { name: 'items', widget: 'list', map_key_field: 'key', fields: [{ name: 'a' }] },
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'list_field_map_key_not_found' }),
      );
    });
  });
});
