// @vitest-environment jsdom

/* eslint-disable jsdoc/require-jsdoc */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fieldStateContext } from '$lib/services/api/field-state';
import {
  getFieldTypeDefinition,
  REUSABLE_BUILTIN_FIELD_TYPES,
} from '$lib/services/api/field-types';
import { customFieldTypeRegistry } from '$lib/services/api/registries';

// The built-in editors and previews are Svelte components, which cannot be compiled and mounted in
// this test environment, so replace them with placeholders and check what is passed to `mount()`
vi.mock('$lib/components/contents/details/fields', () => ({
  editors: Object.fromEntries(
    ['boolean', 'color', 'datetime', 'map', 'number', 'select', 'string', 'text', 'uuid'].map(
      (name) => [name, `${name}-editor`],
    ),
  ),
  previews: Object.fromEntries(
    ['boolean', 'color', 'datetime', 'map', 'number', 'select', 'string', 'text', 'uuid'].map(
      (name) => [name, `${name}-preview`],
    ),
  ),
}));

vi.mock('svelte', () => ({
  mount: vi.fn((component) => ({ component })),
  unmount: vi.fn(),
}));

// Spy on `createElement` to capture the `ref` callback given to the wrapper element
vi.mock('react', async (importOriginal) => {
  /** @type {any} */
  const actual = await importOriginal();

  return { ...actual, createElement: vi.fn(actual.createElement) };
});

const { mount, unmount } = await import('svelte');

// @ts-ignore
global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render a React component created with the `CMS.getFieldType()` API, and return the props object
 * passed to the mocked {@link mount} function, along with helpers to re-render and unmount it.
 * @param {any} component React component.
 * @param {Record<string, any>} props Props for the component.
 * @param {Record<string, any>} [fieldState] State of the field being edited, provided with a React
 * context by the custom field control wrapper.
 * @returns {Promise<Record<string, any>>} Rendering context.
 */
const render = async (component, props, fieldState) => {
  /**
   * Create the element to be rendered, wrapping it with the context provider if needed.
   * @param {Record<string, any>} newProps Props for the component.
   * @returns {any} React element.
   */
  const createTree = (newProps) =>
    fieldState
      ? createElement(
          fieldStateContext.Provider,
          { value: fieldState },
          createElement(component, newProps),
        )
      : createElement(component, newProps);

  const container = document.createElement('div');

  document.body.append(container);

  const root = createRoot(container);

  await act(async () => {
    root.render(createTree(props));
  });

  return {
    container,
    get mountArgs() {
      return /** @type {any} */ (mount).mock.calls[0];
    },
    get svelteProps() {
      return /** @type {any} */ (mount).mock.calls[0][1].props;
    },
    rerender: async (/** @type {Record<string, any>} */ newProps) => {
      await act(async () => {
        root.render(createTree(newProps));
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
};

describe('REUSABLE_BUILTIN_FIELD_TYPES', () => {
  test('contains the self-contained built-in field types only', () => {
    expect(REUSABLE_BUILTIN_FIELD_TYPES).toEqual([
      'boolean',
      'color',
      'datetime',
      'map',
      'number',
      'select',
      'string',
      'text',
      'uuid',
    ]);
  });
});

describe('getFieldTypeDefinition()', () => {
  beforeEach(() => {
    customFieldTypeRegistry.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    customFieldTypeRegistry.clear();
  });

  test('returns a custom field type definition', () => {
    const control = () => null;
    const preview = () => null;
    const schema = { properties: { foo: { type: 'string' } } };

    // @ts-ignore
    customFieldTypeRegistry.set('my-field', { control, preview, schema });

    expect(getFieldTypeDefinition('my-field')).toEqual({ control, preview, schema });
  });

  test('resolves a control referencing another custom field type by name', () => {
    const control = () => null;

    // @ts-ignore
    customFieldTypeRegistry.set('base-field', { control });
    // @ts-ignore
    customFieldTypeRegistry.set('my-field', { control: 'base-field' });

    expect(getFieldTypeDefinition('my-field')?.control).toBe(control);
  });

  test('resolves a control referencing a built-in field type by name', () => {
    // @ts-ignore
    customFieldTypeRegistry.set('my-field', { control: 'select' });

    expect(getFieldTypeDefinition('my-field')?.control).toBe(
      getFieldTypeDefinition('select')?.control,
    );
  });

  test('returns an undefined control for a self-referencing field type', () => {
    // @ts-ignore
    customFieldTypeRegistry.set('my-field', { control: 'my-field' });

    expect(getFieldTypeDefinition('my-field')?.control).toBeUndefined();
  });

  test('returns an undefined control for circular references', () => {
    // @ts-ignore
    customFieldTypeRegistry.set('field-a', { control: 'field-b' });
    // @ts-ignore
    customFieldTypeRegistry.set('field-b', { control: 'field-a' });

    expect(getFieldTypeDefinition('field-a')?.control).toBeUndefined();
  });

  test('returns an undefined control for an unknown reference', () => {
    // @ts-ignore
    customFieldTypeRegistry.set('my-field', { control: 'unknown-field' });

    expect(getFieldTypeDefinition('my-field')?.control).toBeUndefined();
  });

  test('returns components for a reusable built-in field type', () => {
    const definition = getFieldTypeDefinition('select');

    expect(typeof definition?.control).toBe('function');
    expect(typeof definition?.preview).toBe('function');
    expect(definition?.schema).toBeUndefined();
  });

  test('returns the same components for repeated calls', () => {
    expect(getFieldTypeDefinition('string')).toBe(getFieldTypeDefinition('string'));
  });

  test('returns undefined with a warning for a non-reusable built-in field type', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getFieldTypeDefinition('list')).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain('"list"');
    consoleSpy.mockRestore();
  });

  test('returns undefined without a warning for an unknown field type', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getFieldTypeDefinition('unknown')).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('built-in field control component', () => {
  beforeEach(() => {
    customFieldTypeRegistry.clear();
    vi.clearAllMocks();
  });

  test('mounts the built-in editor with props converted from the React props', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('select'));

    const field = {
      name: 'refgroup',
      label: 'Referenced Group',
      widget: 'select',
      options: ['foo', 'bar'],
    };

    const { mountArgs, svelteProps } = await render(control, {
      value: 'foo',
      field,
      forID: 'field-1',
      onChange: vi.fn(),
    });

    expect(mountArgs[0]).toBe('select-editor');
    expect(mountArgs[1].target).toBeInstanceOf(HTMLElement);

    expect({ ...svelteProps }).toEqual({
      locale: '',
      keyPath: 'refgroup',
      typedKeyPath: '',
      fieldId: 'field-1',
      fieldLabel: 'Referenced Group',
      fieldConfig: field,
      currentValue: 'foo',
      required: undefined,
      readonly: undefined,
      invalid: undefined,
    });
  });

  test('accepts an Immutable-like field configuration', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('select'));
    const config = { name: 'refgroup', widget: 'select', options: ['foo'] };
    const field = { toJS: () => config };
    const { svelteProps } = await render(control, { value: 'foo', field, forID: 'field-1' });

    expect(svelteProps.fieldConfig).toEqual(config);
    expect(svelteProps.fieldLabel).toBe('refgroup');
  });

  test('falls back to empty values when no field configuration is given', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));
    const { svelteProps } = await render(control, {});

    expect(svelteProps.fieldConfig).toEqual({});
    expect(svelteProps.keyPath).toBe('');
    expect(svelteProps.fieldId).toBe('');
    expect(svelteProps.fieldLabel).toBe('');
    expect(svelteProps.currentValue).toBeUndefined();
  });

  test('passes through the optional Sveltia-specific props', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));

    const { svelteProps } = await render(control, {
      value: 'foo',
      field: { name: 'title', required: false },
      locale: 'en',
      keyPath: 'content.0.title',
      required: true,
      readonly: true,
      invalid: true,
    });

    expect(svelteProps.locale).toBe('en');
    expect(svelteProps.keyPath).toBe('content.0.title');
    expect(svelteProps.required).toBe(true);
    expect(svelteProps.readonly).toBe(true);
    expect(svelteProps.invalid).toBe(true);
  });

  test('falls back to the `required` option in the field configuration', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));
    const { svelteProps } = await render(control, { field: { name: 'title', required: false } });

    expect(svelteProps.required).toBe(false);
  });

  test('updates the mounted editor instead of remounting it', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));
    const field = { name: 'title', label: 'Title' };
    const context = await render(control, { value: 'foo', field, forID: 'field-1' });
    const { svelteProps } = context;

    await context.rerender({ value: 'bar', field, forID: 'field-2' });

    expect(mount).toHaveBeenCalledOnce();
    expect(svelteProps.currentValue).toBe('bar');
    expect(svelteProps.fieldId).toBe('field-2');
  });

  test('calls `onChange` when the editor writes back a new value', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));
    const onChange = vi.fn();
    const field = { name: 'title' };
    const { svelteProps } = await render(control, { value: 'foo', field, onChange });

    // Simulate the built-in editor updating the bindable `currentValue` prop
    svelteProps.currentValue = 'bar';

    expect(svelteProps.currentValue).toBe('bar');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('bar');

    // The same value should not be reported again
    svelteProps.currentValue = 'bar';

    expect(onChange).toHaveBeenCalledOnce();
  });

  test('does not fail when `onChange` is not given', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));
    const { svelteProps } = await render(control, { value: 'foo', field: { name: 'title' } });

    expect(() => {
      svelteProps.currentValue = 'bar';
    }).not.toThrow();
  });

  test('unmounts the built-in editor when the React component is removed', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));
    const context = await render(control, { value: 'foo', field: { name: 'title' } });

    await context.unmount();

    expect(unmount).toHaveBeenCalledOnce();
  });

  test('accepts a field configuration that only exposes a `get` method', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('select'));
    // Netlify/Decap CMS-style configuration, as found in ported custom field types. Its keys cannot
    // be enumerated, so the options have to be read through the method.
    const config = { name: 'refgroup', options: ['foo'], multiple: false, required: false };

    const field = {
      get: (/** @type {string} */ key, /** @type {any} */ defaultValue) =>
        key in config ? config[/** @type {keyof typeof config} */ (key)] : defaultValue,
    };

    const { svelteProps } = await render(control, { value: 'foo', field, forID: 'field-1' });
    const { fieldConfig } = svelteProps;

    expect(svelteProps.keyPath).toBe('refgroup');
    expect(svelteProps.fieldLabel).toBe('refgroup');
    expect(svelteProps.required).toBe(false);
    expect(fieldConfig.options).toEqual(['foo']);
    expect(fieldConfig.multiple).toBe(false);
    expect(fieldConfig.unknown).toBeUndefined();
    expect('options' in fieldConfig).toBe(true);
    expect('unknown' in fieldConfig).toBe(false);
    // Symbol keys, which Svelte may probe, must not be forwarded to the method
    expect(fieldConfig[Symbol.iterator]).toBeUndefined();
    expect(Symbol.iterator in fieldConfig).toBe(false);
  });

  test('updates a field configuration that only exposes a `get` method', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('select'));

    /**
     * Create a Netlify/Decap CMS-style field configuration.
     * @param {any[]} options Options.
     * @returns {any} Field configuration.
     */
    const makeField = (options) => ({
      get: (/** @type {string} */ key) => ({ name: 'refgroup', options })[key],
    });

    const context = await render(control, { value: 'foo', field: makeField(['foo']) });

    await context.rerender({ value: 'foo', field: makeField(['foo', 'bar']) });

    // Options computed on a later render must reach the built-in editor
    expect(mount).toHaveBeenCalledOnce();
    expect(context.svelteProps.fieldConfig.options).toEqual(['foo', 'bar']);
  });

  test('inherits the state of the field being edited', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('select'));
    // An ad hoc configuration doesn’t describe the field being edited, so its `required` option
    // must not override the state of that field
    const field = { name: 'refgroup', options: ['foo'], required: false };

    const { svelteProps } = await render(
      control,
      { value: 'foo', field, forID: 'field-1' },
      {
        locale: 'en',
        keyPath: 'content.0.refgroup',
        required: true,
        readonly: true,
        invalid: true,
      },
    );

    expect(svelteProps.locale).toBe('en');
    expect(svelteProps.keyPath).toBe('content.0.refgroup');
    expect(svelteProps.required).toBe(true);
    expect(svelteProps.readonly).toBe(true);
    expect(svelteProps.invalid).toBe(true);
  });

  test('prefers the given props over the state of the field being edited', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('select'));
    const field = { name: 'refgroup', options: ['foo'] };

    const { svelteProps } = await render(
      control,
      {
        value: 'foo',
        field,
        locale: 'fr',
        keyPath: 'other',
        required: false,
        readonly: false,
        invalid: false,
      },
      {
        locale: 'en',
        keyPath: 'content.0.refgroup',
        required: true,
        readonly: true,
        invalid: true,
      },
    );

    expect(svelteProps.locale).toBe('fr');
    expect(svelteProps.keyPath).toBe('other');
    expect(svelteProps.required).toBe(false);
    expect(svelteProps.readonly).toBe(false);
    expect(svelteProps.invalid).toBe(false);
  });

  test('does not mount the editor if the wrapper element is missing', async () => {
    const { control } = /** @type {any} */ (getFieldTypeDefinition('string'));

    await render(control, { value: 'foo', field: { name: 'title' } });

    const { ref } = /** @type {any} */ (createElement).mock.calls.findLast(
      (/** @type {any[]} */ [type]) => type === 'div',
    )[1];

    vi.mocked(mount).mockClear();

    // React calls the ref callback with `null` instead of the cleanup function if the component
    // failed to be mounted
    expect(ref(null)).toBeUndefined();
    expect(mount).not.toHaveBeenCalled();
  });
});

describe('built-in field preview component', () => {
  beforeEach(() => {
    customFieldTypeRegistry.clear();
    vi.clearAllMocks();
  });

  test('mounts the built-in preview with props converted from the React props', async () => {
    const { preview } = /** @type {any} */ (getFieldTypeDefinition('select'));
    const field = { name: 'refgroup', widget: 'select', options: ['foo', 'bar'] };

    const { mountArgs, svelteProps } = await render(preview, {
      value: 'foo',
      field,
      locale: 'en',
    });

    expect(mountArgs[0]).toBe('select-preview');

    expect({ ...svelteProps }).toEqual({
      locale: 'en',
      keyPath: 'refgroup',
      typedKeyPath: '',
      fieldConfig: field,
      currentValue: 'foo',
    });
  });

  test('falls back to empty values when no field configuration is given', async () => {
    const { preview } = /** @type {any} */ (getFieldTypeDefinition('select'));
    const { svelteProps } = await render(preview, {});

    expect(svelteProps.locale).toBe('');
    expect(svelteProps.keyPath).toBe('');
    expect(svelteProps.fieldConfig).toEqual({});
  });

  test('inherits the state of the field being previewed', async () => {
    const { preview } = /** @type {any} */ (getFieldTypeDefinition('select'));

    const { svelteProps } = await render(
      preview,
      { value: 'foo', field: { name: 'refgroup' } },
      { locale: 'en', keyPath: 'content.0.refgroup' },
    );

    expect(svelteProps.locale).toBe('en');
    expect(svelteProps.keyPath).toBe('content.0.refgroup');
  });
});
