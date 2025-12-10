/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// Set up window and document objects BEFORE any imports
// @ts-ignore
global.window = {
  CMS: undefined,
  // @ts-ignore
  initCMS: undefined,
  CMS_MANUAL_INIT: true,
  currentScript: null,
  querySelector: vi.fn(() => null),
};

// @ts-ignore
global.document = {
  readyState: 'complete',
  currentScript: null,
  querySelector: vi.fn(() => null),
  addEventListener: vi.fn(),
};

// Mock dependencies BEFORE import
vi.mock('create-react-class');
vi.mock('react');
vi.mock('immutable', () => ({
  Map: class ImmutableMap {},
}));
vi.mock('svelte', () => ({
  mount: vi.fn(),
}));
vi.mock('$lib/services/contents/editor', () => ({
  customPreviewStyleRegistry: new Set(),
}));
vi.mock('$lib/services/contents/file/config', () => ({
  customFileFormatRegistry: new Map(),
}));
vi.mock('$lib/services/contents/widgets/markdown/components/definitions', () => ({
  customComponentRegistry: new Map(),
}));
vi.mock('$lib/services/contents/draft/events', () => ({
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
// @ts-ignore
const CMS = (await import('./main.js')).default;

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

  test('throws TypeError if name is not a string', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat(123, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat(null, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat({}, '.test', { toFile })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid name', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat(123, '.test', { toFile })).toThrow(
      'The `name` option for `CMS.registerCustomFormat()` must be a string',
    );
  });

  test('throws TypeError if extension is not a string', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', 123, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', null, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', {}, { toFile })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid extension', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => CMS.registerCustomFormat('test', 123, { toFile })).toThrow(
      'The `extension` option for `CMS.registerCustomFormat()` must be a string',
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

  test('throws TypeError if id is not a string', () => {
    const definition = { ...validDefinition, id: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid id', () => {
    const definition = { ...validDefinition, id: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.id` must be a string',
    );
  });

  test('throws TypeError if label is not a string', () => {
    const definition = { ...validDefinition, label: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(TypeError);
  });

  test('throws with proper error message for invalid label', () => {
    const definition = { ...validDefinition, label: 123 };

    // @ts-ignore
    expect(() => CMS.registerEditorComponent(definition)).toThrow(
      'The `definition.label` must be a string',
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
  test('registers stylesheet URL', () => {
    expect(() => CMS.registerPreviewStyle('https://example.com/style.css')).not.toThrow();
  });

  test('registers stylesheet file path', () => {
    expect(() => CMS.registerPreviewStyle('/assets/style.css')).not.toThrow();
  });

  test('registers raw CSS string', () => {
    expect(() => CMS.registerPreviewStyle('body { color: red; }', { raw: true })).not.toThrow();
  });

  test('throws TypeError if style is not a string', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle(123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle({})).toThrow(TypeError);
  });

  test('throws with proper error message for invalid style', () => {
    // @ts-ignore
    expect(() => CMS.registerPreviewStyle(123)).toThrow(
      'The `style` option for `CMS.registerPreviewStyle()` must be a string',
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
  test('accepts preview template without throwing', () => {
    const component = () => null;

    // @ts-ignore
    expect(() => CMS.registerPreviewTemplate('test', component)).not.toThrow();
  });

  test('logs warning about unsupported custom preview templates', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const component = () => null;

    // @ts-ignore
    CMS.registerPreviewTemplate('test', component);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Custom preview templates are not yet supported in Sveltia CMS.',
    );
    consoleSpy.mockRestore();
  });
});

describe('CMS.registerFieldType()', () => {
  test('accepts field type registration without throwing', () => {
    const control = () => null;

    // @ts-ignore
    expect(() => CMS.registerFieldType('test', control)).not.toThrow();
  });

  test('logs warning about unsupported custom field types', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const control = () => null;

    // @ts-ignore
    CMS.registerFieldType('test', control);
    expect(consoleSpy).toHaveBeenCalledWith('Custom field types (widgets) are not yet supported in Sveltia CMS.');
    consoleSpy.mockRestore();
  });

  test('registerWidget is an alias for registerFieldType', () => {
    expect(CMS.registerWidget).toBe(CMS.registerFieldType);
  });
});

describe('CMS Proxy - unsupported functions', () => {
  test('returns undefined for unsupported functions', () => {
    // @ts-ignore
    expect(CMS.getBackend).toBeDefined();
    // @ts-ignore
    expect(CMS.getBackend()).toBeUndefined();
  });

  test('logs warning for unsupported CMS functions', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // @ts-ignore
    CMS.getBackend();
    expect(consoleSpy).toHaveBeenCalled();

    const { calls } = consoleSpy.mock;

    expect(calls[calls.length - 1][0]).toContain('not supported');
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
});
