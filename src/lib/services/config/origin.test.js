import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { fetchCmsConfig } from '$lib/services/config/loader';

import { cmsConfig, initCmsConfig } from '.';

// The site URL falls back to `DEV_SITE_URL` on the dev server and to the page origin in production.
// A `file:` page or a sandboxed frame has the opaque origin `null`, which is stood in for here, as
// the fallback is what the parser doesn’t check: it only validates a `site_url` that is set
vi.mock('$lib/services/config/constants', () => ({ DEV_SITE_URL: 'null' }));

vi.mock('@sveltia/utils/crypto', () => ({
  getHash: vi.fn().mockResolvedValue('mock-hash'),
}));

vi.mock('$lib/services/config/loader', () => ({
  fetchCmsConfig: vi.fn(),
}));

vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: vi.fn(),
}));

vi.mock('$lib/services/config/schema', () => ({
  getConfigSchemas: vi.fn().mockReturnValue(undefined),
  validateConfigSchema: vi.fn(),
}));

vi.mock('$lib/services/config/folders/assets', () => ({
  getAllAssetFolders: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/config/folders/entries', () => ({
  getAllEntryFolders: vi.fn().mockReturnValue([]),
}));

vi.mock('$lib/services/assets/folders', () => ({
  allAssetFolders: { current: [] },
  selectedAssetFolder: { current: undefined },
}));

vi.mock('$lib/services/contents', () => ({
  allEntryFolders: { current: [] },
}));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: { devModeEnabled: false },
}));

vi.mock('$lib/services/backends', () => ({
  initBackend: vi.fn(),
  validBackendNames: ['github'],
  gitBackendServices: { github: {} },
}));

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
  locale: { current: 'en', set: vi.fn() },
}));

describe('initCmsConfig with an opaque page origin', () => {
  beforeAll(() => {
    // The test runs in Node, which has no `window`; a secure context is all that’s needed
    global.window = /** @type {any} */ ({ isSecureContext: true });
  });

  afterAll(() => {
    // @ts-ignore The stub is removed again
    delete global.window;
  });

  it('should load the configuration and leave the base URL empty', async () => {
    vi.mocked(fetchCmsConfig).mockResolvedValue(
      /** @type {any} */ ({
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: 'uploads',
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'posts',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
      }),
    );

    await initCmsConfig();

    const config = /** @type {any} */ (cmsConfig.current);

    expect(config?._siteURL).toBe('null');
    expect(config?._baseURL).toBe('');
  });
});
