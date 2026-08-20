/* eslint-disable max-classes-per-file */

/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// Set up window and document objects BEFORE any imports
// @ts-ignore
global.Element = class Element {};
// @ts-ignore
global.HTMLElement = class HTMLElement {};

// @ts-ignore
global.window = {
  CMS: undefined,
  // @ts-ignore
  initCMS: undefined,
  CMS_MANUAL_INIT: true,
  location: /** @type {Location} */ ({ href: 'https://sveltia.dev/admin/' }),
  currentScript: null,
  querySelector: vi.fn(() => null),
  Element: global.Element,
  HTMLElement: global.HTMLElement,
};

// @ts-ignore
global.document = {
  readyState: 'complete',
  currentScript: null,
  querySelector: vi.fn(() => null),
  addEventListener: vi.fn(),
  // @ts-ignore
  createElement: vi.fn(() => ({})),
  // @ts-ignore
  createElementNS: vi.fn(() => ({})),
};

// Mock dependencies BEFORE import
vi.mock('immutable', () => ({
  Map: class ImmutableMap {},
}));
vi.mock('svelte', () => ({
  mount: vi.fn(),
}));
vi.mock('@sveltia/utils/object', () => ({
  // @ts-ignore
  isObject: (val) => typeof val === 'object' && val !== null && !Array.isArray(val),
}));
vi.mock('$lib/services/utils/string', () => ({
  // @ts-ignore
  isNonEmptyString: (val) => typeof val === 'string' && val.trim().length > 0,
}));
vi.mock('$lib/services/api/field-types', () => ({
  getFieldTypeDefinition: vi.fn(),
}));
vi.mock('$lib/services/api/registries', () => ({
  customComponentRegistry: new Map(),
  customFieldTypeRegistry: new Map(),
  customFileFormatRegistry: new Map(),
  customPreviewStyleRegistry: new Set(),
  customPreviewTemplateRegistry: new Map(),
  eventHookRegistry: new Set(),
}));
// Don't mock compatibility.js - import the real module to get proper coverage
vi.mock('$lib/services/api/events', () => ({
  eventHookRegistry: new Set(),
  SUPPORTED_EVENT_TYPES: [
    'preSave',
    'postSave',
    'prePublish',
    'postPublish',
    'preUnpublish',
    'postUnpublish',
  ],
}));
vi.mock('$lib/components/app.svelte', () => ({
  default: {},
}));

// Now import after all setup
const CMS = (await import('.')).default;
const { customPreviewStyleRegistry } = await import('$lib/services/api/registries');
const { getFieldTypeDefinition } = await import('$lib/services/api/field-types');

describe('CMS.init()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initializes with no options', async () => {
    await expect(CMS.init()).resolves.toBeUndefined();
  });

  test('initializes with valid config object', async () => {
    const config = { backend: { name: 'github' } };

    // @ts-ignore
    await expect(CMS.init({ config })).resolves.toBeUndefined();
  });

  test('throws TypeError if config is not an object', async () => {
    // @ts-ignore
    await expect(CMS.init({ config: 'invalid' })).rejects.toThrow(TypeError);
    // @ts-ignore
    await expect(CMS.init({ config: 123 })).rejects.toThrow(TypeError);
    // @ts-ignore
    await expect(CMS.init({ config: true })).rejects.toThrow(TypeError);
    // @ts-ignore
    await expect(CMS.init({ config: [] })).rejects.toThrow(TypeError);
  });

  test('throws with proper error message for invalid config', async () => {
    // @ts-ignore
    await expect(CMS.init({ config: 'invalid' })).rejects.toThrow(
      'The `config` option for `CMS.init()` must be an object',
    );
  });

  test('allows undefined config', async () => {
    await expect(CMS.init({ config: undefined })).resolves.toBeUndefined();
    await expect(CMS.init({})).resolves.toBeUndefined();
  });

  test('handles document loading state', async () => {
    // Set up for document loading state
    const originalReadyState = global.document.readyState;
    const originalAddEventListener = global.window.addEventListener;

    // @ts-ignore
    global.document.readyState = 'loading';
    // @ts-ignore
    global.document.querySelector = vi.fn(() => null);
    // @ts-ignore
    global.window.addEventListener = vi.fn();

    // Re-import to test with loading state
    vi.resetModules();

    // Reset the global state for fresh import
    // @ts-ignore
    global.document.readyState = 'loading';
    // @ts-ignore
    global.document.querySelector = vi.fn(() => null);
    // @ts-ignore
    global.window.addEventListener = vi.fn((event, handler) => {
      if (event === 'DOMContentLoaded') {
        // Simulate the DOM ready event immediately
        handler();
      }
    });

    const { default: CMSLoading } = await import('.');

    await expect(CMSLoading.init()).resolves.toBeUndefined();

    // Verify addEventListener was called for DOMContentLoaded
    expect(global.window.addEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function),
      { once: true },
    );

    // Restore
    // @ts-ignore
    global.document.readyState = originalReadyState;
    // @ts-ignore
    global.window.addEventListener = originalAddEventListener;
  });
});

describe('CMS.registerCustomFormat()', () => {
  test('registers format with both parser and formatter', () => {
    const fromFile = () => {};
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', '.test', { fromFile, toFile })).not.toThrow();
  });

  test('registers format with only parser', () => {
    const fromFile = () => {};

    expect(() => CMS.registerCustomFormat('test', '.test', { fromFile })).not.toThrow();
  });

  test('registers format with only formatter', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', '.test', { toFile })).not.toThrow();
  });

  test('throws TypeError if name is not a non-empty string', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat(123, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat(null, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat({}, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('   ', '.test', { toFile })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid name', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat(123, '.test', { toFile })).toThrow(
      'The `name` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  });

  test('throws TypeError if extension is not a non-empty string', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', 123, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', null, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', {}, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', '   ', { toFile })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid extension', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', 123, { toFile })).toThrow(
      'The `extension` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  });

  test('throws Error if neither fromFile nor toFile is provided', () => {
    expect(() => CMS.registerCustomFormat('test', '.test', {})).toThrow(Error);
    expect(() => CMS.registerCustomFormat('test', '.test')).toThrow(Error);
  });

  test('throws with proper error message for missing methods', () => {
    expect(() => CMS.registerCustomFormat('test', '.test', {})).toThrow(
      'At least one of `fromFile` or `toFile` must be provided to `CMS.registerCustomFormat()`',
    );
  });

  test('throws TypeError if fromFile is provided but not a function', () => {
    const toFile = () => {};

    expect(() =>
      // @ts-ignore
      CMS.registerCustomFormat('test', '.test', { fromFile: 'invalid', toFile }),
    ).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', '.test', { fromFile: 123, toFile })).toThrow(
      TypeError,
    );
  });

  test('throws with proper error message for invalid fromFile', () => {
    const toFile = () => {};

    expect(() =>
      // @ts-ignore
      CMS.registerCustomFormat('test', '.test', { fromFile: 'invalid', toFile }),
    ).toThrow('The `fromFile` option for `CMS.registerCustomFormat()` must be a function');
  });

  test('throws TypeError if toFile is provided but not a function', () => {
    const fromFile = () => {};

    expect(() =>
      // @ts-ignore
      CMS.registerCustomFormat('test', '.test', { fromFile, toFile: 'invalid' }),
    ).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', '.test', { fromFile, toFile: 123 })).toThrow(
      TypeError,
    );
  });

  test('throws with proper error message for invalid toFile', () => {
    const fromFile = () => {};

    expect(() =>
      // @ts-ignore
      CMS.registerCustomFormat('test', '.test', { fromFile, toFile: 'invalid' }),
    ).toThrow('The `toFile` option for `CMS.registerCustomFormat()` must be a function');
  });

  test('accepts async functions as parser/formatter', () => {
    const asyncFromFile = async () => {};
    const asyncToFile = async () => {};

    expect(() =>
      // @ts-ignore
      CMS.registerCustomFormat('test', '.test', { fromFile: asyncFromFile, toFile: asyncToFile }),
    ).not.toThrow();
  });
});

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
    expect(() => CMS.registerEditorComponent(validDefinition)).not.toThrow();
  });

  test('throws TypeError if definition is not an object', () => {
    // @ts-ignore
    expect(() => CMS.registerEditorComponent(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerEditorComponent(undefined)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerEditorComponent('invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerEditorComponent(123)).toThrow(TypeError);
  });

  test('throws with proper error message for non-object definition', () => {
    // @ts-ignore
    expect(() => CMS.registerEditorComponent(null)).toThrow(
      'The `definition` option for `CMS.registerEditorComponent()` must be an object',
    );
  });

  test('throws TypeError if id is not a non-empty string', () => {
    const definition = { ...validDefinition, id: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);

    const whitespaceDefinition = { ...validDefinition, id: '   ' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(whitespaceDefinition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid id', () => {
    const definition = { ...validDefinition, id: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.id` must be a non-empty string',
    );
  });

  test('throws TypeError if label is not a non-empty string', () => {
    const definition = { ...validDefinition, label: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);

    const whitespaceDefinition = { ...validDefinition, label: '   ' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(whitespaceDefinition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid label', () => {
    const definition = { ...validDefinition, label: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.label` must be a non-empty string',
    );
  });

  test('throws TypeError if pattern is not a RegExp', () => {
    const definition = { ...validDefinition, pattern: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);

    const definition2 = { ...validDefinition, pattern: {} };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition2)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid pattern', () => {
    const definition = { ...validDefinition, pattern: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.pattern` must be a RegExp',
    );
  });

  test('throws TypeError if toBlock is not a function', () => {
    const definition = { ...validDefinition, toBlock: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid toBlock', () => {
    const definition = { ...validDefinition, toBlock: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.toBlock` must be a function',
    );
  });

  test('throws TypeError if toPreview is not a function', () => {
    const definition = { ...validDefinition, toPreview: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid toPreview', () => {
    const definition = { ...validDefinition, toPreview: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.toPreview` must be a function',
    );
  });

  test('throws TypeError if fields is not an array', () => {
    const definition = { ...validDefinition, fields: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);

    const definition2 = { ...validDefinition, fields: {} };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition2)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid fields', () => {
    const definition = { ...validDefinition, fields: 'invalid' };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.fields` must be an array',
    );
  });

  test('accepts optional icon and collapsed properties', () => {
    const definition = {
      ...validDefinition,
      icon: 'star',
      collapsed: true,
    };

    expect(() => CMS.registerEditorComponent(definition)).not.toThrow();
  });

  test('accepts empty fields array', () => {
    const definition = { ...validDefinition, fields: [] };

    expect(() => CMS.registerEditorComponent(definition)).not.toThrow();
  });

  test('accepts fields array with items', () => {
    const definition = {
      ...validDefinition,
      fields: [{ name: 'field1', widget: 'string' }],
    };

    expect(() => CMS.registerEditorComponent(definition)).not.toThrow();
  });

  test('accepts fromBlock method when present', () => {
    const definition = {
      ...validDefinition,
      fromBlock: () => ({}),
    };

    expect(() => CMS.registerEditorComponent(definition)).not.toThrow();
  });
});

describe('CMS.registerPreviewStyle()', () => {
  beforeEach(() => {
    customPreviewStyleRegistry.clear();
  });

  test('registers stylesheet URL', () => {
    expect(() => CMS.registerPreviewStyle('https://example.com/style.css')).not.toThrow();
    expect(customPreviewStyleRegistry).toContain('https://example.com/style.css');
  });

  test('registers stylesheet file path', () => {
    expect(() => CMS.registerPreviewStyle('/assets/style.css')).not.toThrow();
    expect(customPreviewStyleRegistry).toContain('https://sveltia.dev/assets/style.css');
  });

  test('registers raw CSS string', () => {
    expect(() => CMS.registerPreviewStyle('body { color: red; }', { raw: true })).not.toThrow();
    expect(customPreviewStyleRegistry.size).toBe(1);
    expect([...customPreviewStyleRegistry][0]).toMatch(/^blob:/);
  });

  test('throws TypeError if non-raw style is not a valid URL or file path', () => {
    expect(() => CMS.registerPreviewStyle('http://')).toThrow(TypeError);
  });

  test('throws with proper error message for invalid non-raw style', () => {
    expect(() => CMS.registerPreviewStyle('http://')).toThrow(
      'The `style` option for `CMS.registerPreviewStyle()` must be a valid URL or file path when `raw` is false',
    );
  });

  test('throws TypeError if style is not a non-empty string', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle(123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle({})).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle('   ')).toThrow(TypeError);
  });

  test('throws with proper error message for invalid style', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle(123)).toThrow(
      'The `style` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
  });

  test('throws TypeError if raw option is not a boolean', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle('body {}', { raw: 'true' })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle('body {}', { raw: 1 })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid raw option', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle('body {}', { raw: 'true' })).toThrow(
      'The `raw` option for `CMS.registerPreviewStyle()` must be a boolean',
    );
  });

  test('defaults raw option to false', () => {
    expect(() => CMS.registerPreviewStyle('https://example.com/style.css')).not.toThrow();
  });
});

describe('CMS.registerEventListener()', () => {
  test('registers valid event listener', () => {
    // @ts-ignore
    const listener = {
      name: 'preSave',
      handler: () => {},
    };

    // @ts-ignore
    expect(() => CMS.registerEventListener(listener)).not.toThrow();
  });

  test('registers all supported event types', () => {
    const eventTypes = [
      'preSave',
      'postSave',
      'prePublish',
      'postPublish',
      'preUnpublish',
      'postUnpublish',
    ];

    eventTypes.forEach((eventType) => {
      // @ts-ignore
      const listener = {
        name: eventType,
        handler: () => {},
      };

      // @ts-ignore
      expect(() => CMS.registerEventListener(listener)).not.toThrow();
    });
  });

  test('throws TypeError if listener is not an object', () => {
    // @ts-ignore
    expect(() => CMS.registerEventListener(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerEventListener(undefined)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerEventListener('invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerEventListener(123)).toThrow(TypeError);
  });

  test('throws with proper error message for non-object listener', () => {
    // @ts-ignore
    expect(() => CMS.registerEventListener(null)).toThrow('The event listener must be an object');
  });

  test('throws TypeError if name is not a string', () => {
    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        // @ts-ignore
        name: 123,
        handler: () => {},
      }),
    ).toThrow(TypeError);

    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        // @ts-ignore
        name: null,
        handler: () => {},
      }),
    ).toThrow(TypeError);
  });

  test('throws TypeError if handler is not a function', () => {
    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: 'invalid',
      }),
    ).toThrow(TypeError);

    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: {},
      }),
    ).toThrow(TypeError);
  });

  test('throws with proper error message for missing properties', () => {
    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: 'invalid',
      }),
    ).toThrow(
      'The event listener must have a string `name` property and a function `handler` property',
    );
  });

  test('throws RangeError if event type is not supported', () => {
    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        // @ts-ignore
        name: 'unsupportedEvent',
        handler: () => {},
      }),
    ).toThrow(RangeError);
  });

  test('throws with proper error message for unsupported event type', () => {
    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        // @ts-ignore
        name: 'invalidEvent',
        handler: () => {},
      }),
    ).toThrow('Unsupported event listener name "invalidEvent"');
  });

  test('accepts async handler functions', () => {
    // @ts-ignore
    expect(() =>
      CMS.registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: async () => {},
      }),
    ).not.toThrow();
  });
});

describe('CMS.registerPreviewTemplate()', () => {
  test('registers a preview template successfully', () => {
    const component = () => null;

    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('posts', component)).not.toThrow();
  });

  test('throws TypeError when name is not a non-empty string', () => {
    const component = () => null;

    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate(123, component)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('   ', component)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate(123, component)).toThrow(
      'The `name` option for `CMS.registerPreviewTemplate()` must be a non-empty string',
    );
  });

  test('throws TypeError when component is not a function', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('posts', 'not-a-function')).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('posts', 'not-a-function')).toThrow(
      'The `component` option for `CMS.registerPreviewTemplate()` must be a React component',
    );
  });

  test('allows registering multiple templates', () => {
    const component1 = () => null;
    const component2 = () => null;

    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('posts', component1)).not.toThrow();
    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('pages', component2)).not.toThrow();
  });

  test('replaces existing template with same name', () => {
    const component1 = () => null;
    const component2 = () => null;

    // @ts-ignore
    CMS.registerPreviewTemplate('posts', component1);
    // @ts-ignore
    CMS.registerPreviewTemplate('posts', component2);

    // No error should be thrown
    expect(true).toBe(true);
  });
});

describe('CMS.registerFieldType()', () => {
  test('registers field type with function control', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control)).not.toThrow();
  });

  test('registers field type with string control', () => {
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', 'StringControl')).not.toThrow();
  });

  test('registers field type with control and preview', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview)).not.toThrow();
  });

  test('registers field type with control, preview, and schema', () => {
    const control = () => null;
    const preview = () => null;
    const schema = { default: 'test' };

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, schema)).not.toThrow();
  });

  test('throws TypeError if name is not a non-empty string', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType(123, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType(null, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType({}, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType(undefined, control)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('   ', control)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid name', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType(123, control)).toThrow(
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
      expect(() => CMS.registerFieldType(type, control)).toThrow(Error);
      // Ensure it's an Error, not a TypeError
      // @ts-ignore
      expect(() => CMS.registerFieldType(type, control)).not.toThrow(TypeError);
    });
  });

  test('throws with proper error message for reserved built-in field type', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('string', control)).toThrow(
      'The field type name "string" is reserved for a built-in field type. ' +
        'Choose a different name for your custom field type.',
    );

    // @ts-ignore
    expect(() => CMS.registerFieldType('markdown', control)).toThrow(
      'The field type name "markdown" is reserved for a built-in field type. ' +
        'Choose a different name for your custom field type.',
    );
  });

  test('throws TypeError if control is not a function or string', () => {
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', 123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', {})).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', [])).toThrow(TypeError);
  });

  test('throws with proper error message for invalid control', () => {
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', 123)).toThrow(
      'The `control` option for `CMS.registerFieldType()` must be a React component or a string',
    );
  });

  test('throws TypeError if preview is provided but not a function', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, 'invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, 123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, {})).toThrow(TypeError);
  });

  test('throws with proper error message for invalid preview', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, 'invalid')).toThrow(
      'The `preview` option for `CMS.registerFieldType()` must be a React component',
    );
  });

  test('accepts undefined preview', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, undefined)).not.toThrow();
  });

  test('throws TypeError if schema is provided but not an object', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, 'invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, 123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, [])).toThrow(TypeError);
  });

  test('throws with proper error message for invalid schema', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, 'invalid')).toThrow(
      'The `schema` option for `CMS.registerFieldType()` must be an object',
    );
  });

  test('accepts undefined schema', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, undefined)).not.toThrow();
  });

  test('accepts empty schema object', () => {
    const control = () => null;
    const preview = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview, {})).not.toThrow();
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
    expect(() => CMS.registerFieldType('test', control, preview, schema)).not.toThrow();
  });

  test('accepts async control function', () => {
    const control = async () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control)).not.toThrow();
  });

  test('accepts async preview function', () => {
    const control = () => null;
    const preview = async () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control, preview)).not.toThrow();
  });

  test('registerWidget is an alias for registerFieldType', () => {
    expect(CMS.registerWidget).toBe(CMS.registerFieldType);
  });

  test('registerWidget uses same validation as registerFieldType', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerWidget('test-widget', control)).not.toThrow();

    // @ts-ignore
    expect(() => CMS.registerWidget(123, control)).toThrow(TypeError);
  });
});

describe('CMS.getFieldType()', () => {
  beforeEach(() => {
    vi.mocked(getFieldTypeDefinition).mockReset();
  });

  test('returns the field type definition for the given name', () => {
    const definition = { control: () => null, preview: () => null };

    // @ts-ignore
    vi.mocked(getFieldTypeDefinition).mockReturnValue(definition);

    expect(CMS.getFieldType('select')).toBe(definition);
    expect(getFieldTypeDefinition).toHaveBeenCalledExactlyOnceWith('select');
  });

  test('returns undefined for an unavailable field type', () => {
    vi.mocked(getFieldTypeDefinition).mockReturnValue(undefined);

    expect(CMS.getFieldType('list')).toBeUndefined();
  });

  test('throws TypeError for an invalid name', () => {
    // @ts-ignore
    expect(() => CMS.getFieldType()).toThrow(TypeError);
    expect(() => CMS.getFieldType('')).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.getFieldType(123)).toThrow(TypeError);
    expect(getFieldTypeDefinition).not.toHaveBeenCalled();
  });

  test('getWidget is an alias of getFieldType', () => {
    // @ts-ignore
    expect(CMS.getWidget).toBe(CMS.getFieldType);
  });

  test('does not log a compatibility warning for getWidget', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(getFieldTypeDefinition).mockReturnValue(undefined);
    // @ts-ignore
    CMS.getWidget('select');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('CMS Proxy - unsupported functions', () => {
  test('returns undefined for unsupported functions', () => {
    // @ts-ignore
    expect(CMS.getBackend).toBeDefined();
    // @ts-ignore
    expect(CMS.getBackend()).toBeUndefined();
  });

  test('logs warning for unsupported CMS functions with COMPATIBILITY_URL', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Test with a known unsupported function
    // @ts-ignore
    CMS.getBackend();
    expect(consoleSpy).toHaveBeenCalled();

    const { calls } = consoleSpy.mock;
    const lastCall = calls[calls.length - 1];

    // The format string is in the first argument
    expect(lastCall[0]).toContain('not supported');
    // The function name is the second argument
    expect(lastCall[1]).toBe('getBackend');
    // Verify COMPATIBILITY_URL is included as the third argument
    expect(lastCall[2]).toContain('https://sveltiacms.app/en/docs/migration');
    consoleSpy.mockRestore();
  });

  test('returns undefined for non-existent properties not in unsupported list', () => {
    // @ts-ignore
    expect(CMS.nonExistentProperty).toBeUndefined();
    // @ts-ignore
    expect(CMS.anotherRandomProperty).toBeUndefined();
  });

  test('does not log warning for non-existent properties', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    consoleSpy.mockClear(); // Clear any previous calls

    // @ts-ignore
    const result = CMS.someRandomProperty;

    expect(result).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('CMS - supported methods', () => {
  test('init method is accessible', () => {
    expect(typeof CMS.init).toBe('function');
  });

  test('registerCustomFormat method is accessible', () => {
    expect(typeof CMS.registerCustomFormat).toBe('function');
  });

  test('registerEditorComponent method is accessible', () => {
    expect(typeof CMS.registerEditorComponent).toBe('function');
  });

  test('registerEventListener method is accessible', () => {
    expect(typeof CMS.registerEventListener).toBe('function');
  });

  test('registerPreviewStyle method is accessible', () => {
    expect(typeof CMS.registerPreviewStyle).toBe('function');
  });

  test('registerPreviewTemplate method is accessible', () => {
    expect(typeof CMS.registerPreviewTemplate).toBe('function');
  });

  test('registerFieldType method is accessible', () => {
    expect(typeof CMS.registerFieldType).toBe('function');
  });

  test('registerWidget method is accessible', () => {
    expect(typeof CMS.registerWidget).toBe('function');
  });

  test('getFieldType method is accessible', () => {
    expect(typeof CMS.getFieldType).toBe('function');
  });

  test('getWidget method is accessible', () => {
    // @ts-ignore
    expect(typeof CMS.getWidget).toBe('function');
  });
});
