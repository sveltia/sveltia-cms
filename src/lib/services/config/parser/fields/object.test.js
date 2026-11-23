import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCollectors } from '$lib/test/config-parser';

// Mock @sveltia/i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.invalid_object_field': 'Object field cannot have both fields and types',
  'config.error.duplicate_names': 'Duplicate name: {name}',
  'config.error_locator.field': 'Field: {field}',
};

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ strings: mockI18nStrings, locale: 'en-US' }),
);

const mockParseFields = vi.fn();
const mockParseVariableTypes = vi.fn();

vi.mock('$lib/services/config/parser/fields/registry', () => ({
  parseFields: mockParseFields,
  parseVariableTypes: mockParseVariableTypes,
}));

const mockAddMessage = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
}));

describe('Object Field Config Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseObjectFieldConfig with fields', () => {
    it('should parse object field with subfields', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'metadata',
        widget: 'object',
        fields: [
          { name: 'author', widget: 'string' },
          { name: 'date', widget: 'datetime' },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'metadata',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockParseFields).toHaveBeenCalledWith(fieldConfig.fields, context, collectors);
    });

    it('should not add error when only fields are present', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
        fields: [{ name: 'title', widget: 'string' }],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_object_field',
        }),
      );
    });
  });

  describe('parseObjectFieldConfig with types', () => {
    it('should parse the variable types under the field’s key path', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      const types = [
        { name: 'text_block', fields: [{ name: 'text', widget: 'text' }] },
        { name: 'image_block', fields: [{ name: 'image', widget: 'image' }] },
      ];

      /** @type {any} */
      const context = { cmsConfig: {}, collection: { name: 'posts' }, typedKeyPath: 'block' };

      parseObjectFieldConfig({
        config: /** @type {any} */ ({ name: 'block', widget: 'object', types }),
        context,
        collectors,
      });

      expect(mockParseVariableTypes).toHaveBeenCalledExactlyOnceWith({
        types,
        typeKeyPath: 'block',
        context,
        collectors,
      });
      expect(mockParseFields).not.toHaveBeenCalled();
    });
  });

  describe('parseObjectFieldConfig validation', () => {
    it('should error when both fields and types are present', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
        fields: [{ name: 'title', widget: 'string' }],
        types: [
          {
            name: 'text',
            fields: [{ name: 'text', widget: 'text' }],
          },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_object_field',
        }),
      );
    });

    it('should not parse fields when validation fails', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should error on an empty subfield or type list', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();
      /** @type {any} */
      const context = { cmsConfig: {}, collection: { name: 'posts' }, typedKeyPath: 'meta' };

      parseObjectFieldConfig({
        config: /** @type {any} */ ({ name: 'meta', widget: 'object', fields: [] }),
        context,
        collectors,
      });

      parseObjectFieldConfig({
        config: /** @type {any} */ ({ name: 'meta', widget: 'object', types: [] }),
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledTimes(2);
      expect(mockAddMessage).toHaveBeenCalledWith({
        strKey: 'object_field_no_subfields',
        context,
        collectors,
      });
      expect(mockParseFields).not.toHaveBeenCalled();
    });
  });

  describe('parseObjectFieldConfig thumbnail option', () => {
    /** @type {any} */
    const context = {
      cmsConfig: {},
      collection: { name: 'posts' },
      typedKeyPath: 'hero',
    };

    const subfields = [
      { name: 'image', widget: 'image' },
      { name: 'caption', widget: 'string' },
    ];

    it('should accept a thumbnail that names a subfield', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      parseObjectFieldConfig({
        config: { name: 'hero', widget: 'object', fields: subfields, thumbnail: 'image' },
        context,
        collectors,
      });

      parseObjectFieldConfig({
        config: { name: 'hero', widget: 'object', fields: subfields, thumbnail: 'fields.image' },
        context,
        collectors,
      });

      parseObjectFieldConfig({
        config: {
          name: 'hero',
          widget: 'object',
          types: [{ name: 'photo', fields: subfields }],
          thumbnail: 'image',
        },
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on a thumbnail that names no subfield', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      parseObjectFieldConfig({
        config: { name: 'hero', widget: 'object', fields: subfields, thumbnail: 'photo' },
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

  describe('parseObjectFieldConfig thumbnail type', () => {
    it('should error on a thumbnail that names a subfield of another type', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();
      /** @type {any} */
      const context = { cmsConfig: {}, collection: { name: 'posts' }, typedKeyPath: 'hero' };

      parseObjectFieldConfig({
        config: {
          name: 'hero',
          widget: 'object',
          fields: [{ name: 'caption', widget: 'string' }],
          thumbnail: 'caption',
        },
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'thumbnail_field_not_media',
        values: { name: 'caption', widget: 'string' },
        context,
        collectors,
      });
    });
  });

  describe('parseObjectFieldConfig default option', () => {
    /** @type {any} */
    const context = { cmsConfig: {}, collection: { name: 'posts' }, typedKeyPath: 'author' };

    const subfields = [
      { name: 'name', widget: 'string' },
      { name: 'email', widget: 'string' },
    ];

    it('should accept a default with known properties', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      parseObjectFieldConfig({
        config: { name: 'author', widget: 'object', fields: subfields, default: { name: 'Alice' } },
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should error on an unknown property in the default', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      parseObjectFieldConfig({
        config: { name: 'author', widget: 'object', fields: subfields, default: { nmae: 'Alice' } },
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'object_field_invalid_default_key',
        values: { key: 'nmae' },
        context,
        collectors,
      });
    });

    it('should check the default against the named variable type', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      const types = [
        { name: 'person', fields: subfields },
        { name: 'company', fields: [{ name: 'name', widget: 'string' }] },
      ];

      parseObjectFieldConfig({
        config: {
          name: 'author',
          widget: 'object',
          typeKey: 'kind',
          types,
          default: { kind: 'person', email: 'alice@example.com' },
        },
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalled();

      parseObjectFieldConfig({
        config: { name: 'author', widget: 'object', types, default: { name: 'Acme' } },
        context,
        collectors,
      });

      parseObjectFieldConfig({
        config: { name: 'author', widget: 'object', types, default: { type: 'robot' } },
        context,
        collectors,
      });

      parseObjectFieldConfig({
        config: {
          name: 'author',
          widget: 'object',
          types,
          default: { type: 'company', email: 'info@example.com' },
        },
        context,
        collectors,
      });

      expect(mockAddMessage.mock.calls.map(([args]) => args)).toEqual([
        {
          strKey: 'object_field_default_missing_type',
          values: { typeKey: 'type' },
          context,
          collectors,
        },
        {
          strKey: 'object_field_invalid_default_type',
          values: { typeKey: 'type', value: 'robot' },
          context,
          collectors,
        },
        {
          strKey: 'object_field_invalid_default_key',
          values: { key: 'email' },
          context,
          collectors,
        },
      ]);
    });

    it('should leave a default of the wrong type to the schema', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      parseObjectFieldConfig({
        config: { name: 'author', widget: 'object', fields: subfields, default: 'Alice' },
        context,
        collectors,
      });

      parseObjectFieldConfig({
        config: { name: 'author', widget: 'object', fields: subfields, default: ['Alice'] },
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });
  });
});
