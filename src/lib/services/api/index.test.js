import { describe, expect, test, vi } from 'vitest';

// The methods are tested in their own modules
vi.mock('./methods/get-field-type', () => ({
  getFieldType: vi.fn(),
}));
vi.mock('./methods/init', () => ({
  init: vi.fn(),
}));
vi.mock('./methods/register-custom-format', () => ({
  registerCustomFormat: vi.fn(),
}));
vi.mock('./methods/register-custom-page', () => ({
  registerCustomPage: vi.fn(),
}));
vi.mock('./methods/register-editor-component', () => ({
  registerEditorComponent: vi.fn(),
}));
vi.mock('./methods/register-event-listener', () => ({
  registerEventListener: vi.fn(),
}));
vi.mock('./methods/register-field-type', () => ({
  registerFieldType: vi.fn(),
}));
vi.mock('./methods/register-preview-style', () => ({
  registerPreviewStyle: vi.fn(),
}));
vi.mock('./methods/register-preview-template', () => ({
  registerPreviewTemplate: vi.fn(),
}));
vi.mock('./methods/register-string-transformation', () => ({
  registerStringTransformation: vi.fn(),
}));
vi.mock('./methods/render-rich-text', () => ({
  renderRichText: vi.fn(),
}));

const CMS = (await import('.')).default;

describe('CMS aliases', () => {
  test('registerWidget is an alias of registerFieldType', () => {
    expect(CMS.registerWidget).toBe(CMS.registerFieldType);
  });

  test('getWidget is an alias of getFieldType', () => {
    // @ts-ignore
    expect(CMS.getWidget).toBe(CMS.getFieldType);
  });

  test('does not log a compatibility warning for getWidget', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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

describe('CMS.React', () => {
  test('is the React instance bundled with the CMS', async () => {
    const { default: React } = await import('react');
    const { React: ReactExport } = await import('.');

    expect(CMS.React).toBe(React);
    expect(ReactExport).toBe(React);
    expect(typeof CMS.React.useState).toBe('function');
  });

  test('does not log a warning', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // eslint-disable-next-line no-unused-expressions
    CMS.React;
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

  test('registerCustomPage method is accessible', () => {
    expect(typeof CMS.registerCustomPage).toBe('function');
  });

  test('registerPreviewStyle method is accessible', () => {
    expect(typeof CMS.registerPreviewStyle).toBe('function');
  });

  test('registerPreviewTemplate method is accessible', () => {
    expect(typeof CMS.registerPreviewTemplate).toBe('function');
  });

  test('registerStringTransformation method is accessible', () => {
    expect(typeof CMS.registerStringTransformation).toBe('function');
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
