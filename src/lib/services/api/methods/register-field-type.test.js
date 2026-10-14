/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

import { preloadImmutable } from '$lib/services/api/immutable';
import { preloadReactDom } from '$lib/services/api/react-dom';

vi.mock('$lib/services/api/immutable', () => ({
  preloadImmutable: vi.fn(),
}));
vi.mock('$lib/services/api/react-dom', () => ({
  preloadReactDom: vi.fn(),
}));

const { customFieldTypeRegistry } = await import('$lib/services/api/registries');
const { registerFieldType } = await import('$lib/services/api/methods/register-field-type');

describe('CMS.registerFieldType()', () => {
  test('registers field type with function control', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control)).not.toThrow();
    // The components will receive Immutable Maps, so the library is loaded ahead of time
    expect(preloadImmutable).toHaveBeenCalled();
    expect(preloadReactDom).toHaveBeenCalled();
  });

  test('registers field type with wrapped components', () => {
    const control = { $$typeof: Symbol.for('react.forward_ref'), render: () => null };
    const preview = { $$typeof: Symbol.for('react.memo'), type: () => null };

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview)).not.toThrow();
  });

  test('registers field type with string control', () => {
    // @ts-ignore
    expect(() => registerFieldType('test', 'StringControl')).not.toThrow();
  });

  test('registers field type with control and preview', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview)).not.toThrow();
  });

  test('registers field type with control, preview, and schema', () => {
    const control = () => null;
    const preview = () => null;
    const schema = { default: 'test' };

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, schema)).not.toThrow();
  });

  test('throws TypeError if name is not a non-empty string', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType(123, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType(null, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType({}, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType(undefined, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('   ', control)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid name', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType(123, control)).toThrow(
      'The `name` option for `CMS.registerFieldType()` must be a non-empty string',
    );
  });

  test('throws Error if name is a built-in field type', () => {
    const control = () => null;

    // Test with various built-in field types
    const builtInTypes = [
      'boolean',
      'code',
      'color',
      'datetime',
      'file',
      'image',
      'list',
      'markdown',
      'number',
      'object',
      'richtext',
      'select',
      'string',
      'text',
    ];

    builtInTypes.forEach((type) => {
      // @ts-ignore
      expect(() => registerFieldType(type, control)).toThrow(Error);
      // Ensure it's an Error, not a TypeError
      // @ts-ignore
      expect(() => registerFieldType(type, control)).not.toThrow(TypeError);
    });
  });

  test('throws with proper error message for reserved built-in field type', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType('string', control)).toThrow(
      'The field type name "string" is reserved for a built-in field type. ' +
        'Choose a different name for your custom field type.',
    );

    // @ts-ignore
    expect(() => registerFieldType('markdown', control)).toThrow(
      'The field type name "markdown" is reserved for a built-in field type. ' +
        'Choose a different name for your custom field type.',
    );
  });

  test('throws TypeError if control is not a function or string', () => {
    // @ts-ignore
    expect(() => registerFieldType('test', 123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', {})).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', [])).toThrow(TypeError);
  });

  test('throws with proper error message for invalid control', () => {
    // @ts-ignore
    expect(() => registerFieldType('test', 123)).toThrow(
      'The `control` option for `CMS.registerFieldType()` must be a React component or a string',
    );
  });

  test('throws TypeError if preview is provided but not a function', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, 'invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', control, 123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', control, {})).toThrow(TypeError);
  });

  test('throws with proper error message for invalid preview', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, 'invalid')).toThrow(
      'The `preview` option for `CMS.registerFieldType()` must be a React component',
    );
  });

  test('accepts undefined preview', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, undefined)).not.toThrow();
  });

  test('throws TypeError if schema is provided but not an object', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, 'invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, 123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, [])).toThrow(TypeError);
  });

  test('throws with proper error message for invalid schema', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, 'invalid')).toThrow(
      'The `schema` option for `CMS.registerFieldType()` must be an object',
    );
  });

  test('accepts undefined schema', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, undefined)).not.toThrow();
  });

  test('accepts empty schema object', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, {})).not.toThrow();
  });

  test('accepts schema with properties', () => {
    const control = () => null;
    const preview = () => null;

    const schema = {
      default: 'test',
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
      },
    };

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview, schema)).not.toThrow();
  });

  test('accepts async control function', () => {
    const control = async () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control)).not.toThrow();
  });

  test('accepts async preview function', () => {
    const control = () => null;
    const preview = async () => null;

    // @ts-ignore
    expect(() => registerFieldType('test', control, preview)).not.toThrow();
  });

  test('registers the components given as positional arguments', () => {
    const control = () => null;
    const preview = () => null;
    const schema = { properties: {} };

    // @ts-ignore
    registerFieldType('positional', control, preview, schema);

    expect(customFieldTypeRegistry.get('positional')).toEqual({
      control,
      preview,
      summary: undefined,
      schema,
    });
  });

  describe('with a definition object', () => {
    test('registers the components, including a summary', () => {
      const controlComponent = () => null;
      const previewComponent = () => null;
      const summaryComponent = () => null;
      const schema = { properties: {} };

      expect(() =>
        registerFieldType({
          name: 'definition',
          // @ts-ignore
          controlComponent,
          // @ts-ignore
          previewComponent,
          // @ts-ignore
          summaryComponent,
          schema,
        }),
      ).not.toThrow();
      expect(customFieldTypeRegistry.get('definition')).toEqual({
        control: controlComponent,
        preview: previewComponent,
        summary: summaryComponent,
        schema,
      });
      expect(preloadImmutable).toHaveBeenCalled();
      expect(preloadReactDom).toHaveBeenCalled();
    });

    test('registers a control reused from another field type by name', () => {
      registerFieldType({ name: 'definition-string', controlComponent: 'StringControl' });

      expect(customFieldTypeRegistry.get('definition-string')).toEqual({
        control: 'StringControl',
        preview: undefined,
        summary: undefined,
        schema: undefined,
      });
    });

    test('ignores the other arguments', () => {
      const controlComponent = () => null;
      const preview = () => null;

      // @ts-ignore
      registerFieldType({ name: 'definition-only', controlComponent }, 'x', preview);

      expect(customFieldTypeRegistry.get('definition-only')?.control).toBe(controlComponent);
      expect(customFieldTypeRegistry.get('definition-only')?.preview).toBeUndefined();
    });

    test('throws if the name is missing, invalid or reserved', () => {
      const controlComponent = () => null;

      // @ts-ignore
      expect(() => registerFieldType({ controlComponent })).toThrow(
        'The `name` option for `CMS.registerFieldType()` must be a non-empty string',
      );
      // @ts-ignore
      expect(() => registerFieldType({ name: '', controlComponent })).toThrow(TypeError);
      // @ts-ignore
      expect(() => registerFieldType({ name: 'string', controlComponent })).toThrow(
        'The field type name "string" is reserved for a built-in field type.',
      );
    });

    test('throws if a component is invalid, naming the option as given', () => {
      const controlComponent = () => null;

      // @ts-ignore
      expect(() => registerFieldType({ name: 'bad' })).toThrow(
        'The `controlComponent` option for `CMS.registerFieldType()` must be a React component ' +
          'or a string',
      );
      expect(() =>
        // @ts-ignore
        registerFieldType({ name: 'bad', controlComponent, previewComponent: 'x' }),
      ).toThrow(
        'The `previewComponent` option for `CMS.registerFieldType()` must be a React component',
      );
      expect(() =>
        // @ts-ignore
        registerFieldType({ name: 'bad', controlComponent, summaryComponent: {} }),
      ).toThrow(
        'The `summaryComponent` option for `CMS.registerFieldType()` must be a React component',
      );
      // @ts-ignore
      expect(() => registerFieldType({ name: 'bad', controlComponent, schema: [] })).toThrow(
        'The `schema` option for `CMS.registerFieldType()` must be an object',
      );
      expect(customFieldTypeRegistry.has('bad')).toBe(false);
    });

    test('accepts a wrapped summary component', () => {
      const controlComponent = () => null;
      const summaryComponent = { $$typeof: Symbol.for('react.memo'), type: () => null };

      expect(() =>
        // @ts-ignore
        registerFieldType({ name: 'wrapped-summary', controlComponent, summaryComponent }),
      ).not.toThrow();
    });
  });
});
