import { beforeEach, describe, expect, test, vi } from 'vitest';

// @ts-ignore
global.window = {};

// @ts-ignore
global.document = {
  readyState: 'complete',
  querySelector: vi.fn(() => null),
};

vi.mock('$lib/services/config/loader', () => ({
  prefetchCmsConfig: vi.fn(),
}));
vi.mock('svelte', () => ({
  mount: vi.fn(),
}));
vi.mock('$lib/components/app.svelte', () => ({
  default: {},
}));

const { init } = await import('$lib/services/api/methods/init');

describe('CMS.init()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initializes with no options', async () => {
    await expect(init()).resolves.toBeUndefined();
  });

  test('requests the config file ahead of mounting the app', async () => {
    vi.resetModules();

    const { prefetchCmsConfig } = await import('$lib/services/config/loader');
    const { mount } = await import('svelte');
    const { init: freshInit } = await import('$lib/services/api/methods/init');

    await freshInit();

    expect(prefetchCmsConfig).toHaveBeenCalledOnce();
    expect(prefetchCmsConfig).toHaveBeenCalledBefore(vi.mocked(mount));
  });

  test('does not request the config file when a manual config opts out of it', async () => {
    vi.resetModules();

    const { prefetchCmsConfig } = await import('$lib/services/config/loader');
    const { init: freshInit } = await import('$lib/services/api/methods/init');

    // @ts-ignore
    await freshInit({ config: { backend: { name: 'github' }, load_config_file: false } });

    expect(prefetchCmsConfig).not.toHaveBeenCalled();
  });

  test('initializes with valid config object', async () => {
    const config = { backend: { name: 'github' } };

    // @ts-ignore
    await expect(init({ config })).resolves.toBeUndefined();
  });

  test('throws TypeError if config is not an object', async () => {
    // @ts-ignore
    await expect(init({ config: 'invalid' })).rejects.toThrow(TypeError);
    // @ts-ignore
    await expect(init({ config: 123 })).rejects.toThrow(TypeError);
    // @ts-ignore
    await expect(init({ config: true })).rejects.toThrow(TypeError);
    // @ts-ignore
    await expect(init({ config: [] })).rejects.toThrow(TypeError);
  });

  test('throws with proper error message for invalid config', async () => {
    // @ts-ignore
    await expect(init({ config: 'invalid' })).rejects.toThrow(
      'The `config` option for `CMS.init()` must be an object',
    );
  });

  test('allows undefined config', async () => {
    await expect(init({ config: undefined })).resolves.toBeUndefined();
    await expect(init({})).resolves.toBeUndefined();
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

    const { init: loadingInit } = await import('$lib/services/api/methods/init');

    await expect(loadingInit()).resolves.toBeUndefined();

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
