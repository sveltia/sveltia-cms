/* eslint-disable jsdoc/require-jsdoc */
// @vitest-environment jsdom

import { encodeBase64 } from '@sveltia/utils/file';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import {
  THUMBNAIL_TRANSFORM_OPTIONS,
  transformImage,
} from '$lib/services/utils/media/image/transform';

import {
  appIconURLs,
  appLogoType,
  appLogoURL,
  appManifestURL,
  appTitle,
  DEFAULT_APP_LOGO_URL,
  DEFAULT_APP_TITLE,
} from './branding.js';

// Mock the cmsConfig state with a real reactive box, so that the derived state and the effect in
// the module under test react to changes made by the tests
vi.mock('$lib/services/config', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { cmsConfig: createRawState(undefined) };
});

// Mock the mime library
vi.mock('mime', () => ({
  default: {
    getType: vi.fn((url) => {
      if (url.endsWith('.png')) return 'image/png';
      if (url.endsWith('.svg')) return 'image/svg+xml';
      if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
      if (url.endsWith('.webp')) return 'image/webp';
      return null;
    }),
  },
}));

// Mock the image transformation utilities
vi.mock('$lib/services/utils/media/image/transform', () => ({
  THUMBNAIL_TRANSFORM_OPTIONS: {
    format: 'webp',
    quality: 85,
    width: 512,
    height: 512,
    fit: 'contain',
  },
  transformImage: vi.fn(),
}));

// Mock the file utilities
vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn(),
}));

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

describe('branding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('exports DEFAULT_APP_TITLE', () => {
      expect(DEFAULT_APP_TITLE).toBe('Sveltia CMS');
    });

    it('exports DEFAULT_APP_LOGO_URL as a data URL', () => {
      expect(DEFAULT_APP_LOGO_URL).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('DEFAULT_APP_LOGO_URL contains valid base64 content', () => {
      const base64Part = DEFAULT_APP_LOGO_URL.split(',')[1];

      expect(() => {
        atob(base64Part);
      }).not.toThrow();
    });
  });

  describe('appTitle derived state', () => {
    it('returns DEFAULT_APP_TITLE when config is null', () => {
      cmsConfig.current = /** @type {any} */ (undefined);

      const value = appTitle.current;

      expect(value).toBe(DEFAULT_APP_TITLE);
    });

    it('returns DEFAULT_APP_TITLE when app_title is not set', () => {
      cmsConfig.current = /** @type {any} */ ({});

      const value = appTitle.current;

      expect(value).toBe(DEFAULT_APP_TITLE);
    });

    it('returns custom app_title from config', () => {
      const customTitle = 'My Custom CMS';

      cmsConfig.current = /** @type {any} */ ({ app_title: customTitle });

      const value = appTitle.current;

      expect(value).toBe(customTitle);
    });
  });

  describe('appLogoURL derived state', () => {
    it('returns DEFAULT_APP_LOGO_URL when config is null', () => {
      cmsConfig.current = /** @type {any} */ (undefined);

      const value = appLogoURL.current;

      expect(value).toBe(DEFAULT_APP_LOGO_URL);
    });

    it('returns logo.src from config when available', () => {
      const logoURL = 'https://example.com/logo.png';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      const value = appLogoURL.current;

      expect(value).toBe(logoURL);
    });

    it('returns deprecated logo_url when logo.src is not available', () => {
      const logoURL = 'https://example.com/legacy-logo.svg';

      cmsConfig.current = /** @type {any} */ ({ logo_url: logoURL });

      const value = appLogoURL.current;

      expect(value).toBe(logoURL);
    });

    it('prefers logo.src over deprecated logo_url', () => {
      const newLogoURL = 'https://example.com/new-logo.png';
      const oldLogoURL = 'https://example.com/old-logo.svg';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: newLogoURL }, logo_url: oldLogoURL });

      const value = appLogoURL.current;

      expect(value).toBe(newLogoURL);
    });

    it('returns DEFAULT_APP_LOGO_URL when no logo is configured', () => {
      cmsConfig.current = /** @type {any} */ ({ app_title: 'Some CMS' });

      const value = appLogoURL.current;

      expect(value).toBe(DEFAULT_APP_LOGO_URL);
    });
  });

  describe('appLogoType derived state', () => {
    it('extracts MIME type from data URL', () => {
      const dataURL = 'data:image/png;base64,iVBORw0KG';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: dataURL } });

      const value = appLogoType.current;

      expect(value).toBe('image/png');
    });

    it('extracts SVG MIME type from data URL', () => {
      const dataURL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: dataURL } });

      const value = appLogoType.current;

      expect(value).toBe('image/svg+xml');
    });

    it('detects MIME type from file extension for PNG', () => {
      const url = 'https://example.com/logo.png';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: url } });

      const value = appLogoType.current;

      expect(value).toBe('image/png');
    });

    it('detects MIME type from file extension for SVG', () => {
      const url = 'https://example.com/logo.svg';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: url } });

      const value = appLogoType.current;

      expect(value).toBe('image/svg+xml');
    });

    it('detects MIME type from file extension for JPEG', () => {
      const url = 'https://example.com/logo.jpg';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: url } });

      const value = appLogoType.current;

      expect(value).toBe('image/jpeg');
    });

    it('returns undefined for unknown file type', () => {
      const url = 'https://example.com/logo.unknown';

      cmsConfig.current = /** @type {any} */ ({ logo: { src: url } });

      const value = appLogoType.current;

      expect(value).toBeUndefined();
    });

    it('returns image/svg+xml when using DEFAULT_APP_LOGO_URL', () => {
      cmsConfig.current = /** @type {any} */ (undefined);

      const value = appLogoType.current;

      expect(value).toBe('image/svg+xml');
    });
  });

  describe('appIconURLs state', () => {
    beforeEach(async () => {
      // Reset the state and let the effect settle before the mocks are set up
      cmsConfig.current = undefined;
      appIconURLs.current = undefined;
      await wait();
      vi.clearAllMocks();
      global.fetch = vi.fn();
    });

    it('generates small and large icon URLs from logo', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // Mock fetch to return the blob
      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock transformImage to return transformed blob
      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      // Mock encodeBase64 to return base64 string
      vi.mocked(encodeBase64).mockResolvedValue('base64-encoded-data');

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(appIconURLs.current).toBeDefined();
      });

      expect(appIconURLs.current).toEqual({
        small: 'data:image/webp;base64,base64-encoded-data',
        large: 'data:image/webp;base64,base64-encoded-data',
      });

      expect(global.fetch).toHaveBeenCalledWith(logoURL);
      expect(transformImage).toHaveBeenCalledTimes(2);
      expect(encodeBase64).toHaveBeenCalledTimes(2);
    });

    it('calls transformImage with correct options for large icon', async () => {
      const logoURL = 'https://example.com/logo.svg';
      const mockBlob = new Blob(['fake-svg-data'], { type: 'image/svg+xml' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      await vi.waitFor(() => {
        expect(transformImage).toHaveBeenCalled();
      });

      // Check that large icon uses default THUMBNAIL_TRANSFORM_OPTIONS
      expect(transformImage).toHaveBeenCalledWith(mockBlob, THUMBNAIL_TRANSFORM_OPTIONS);
    });

    it('calls transformImage with correct options for small icon', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      await vi.waitFor(() => {
        expect(transformImage).toHaveBeenCalledTimes(2);
      });

      // Check that small icon has 192x192 dimensions
      expect(transformImage).toHaveBeenCalledWith(mockBlob, {
        ...THUMBNAIL_TRANSFORM_OPTIONS,
        width: 192,
        height: 192,
      });
    });

    it('returns undefined when fetch fails', async () => {
      const logoURL = 'https://example.com/logo.png';

      // Mock fetch to fail
      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      });

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(appIconURLs.current).toBeUndefined();
      });

      expect(global.fetch).toHaveBeenCalledWith(logoURL);
    });

    it('returns undefined when fetch throws an error', async () => {
      const logoURL = 'https://example.com/logo.png';

      // Mock fetch to throw error
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(appIconURLs.current).toBeUndefined();
      });

      expect(global.fetch).toHaveBeenCalledWith(logoURL);
    });

    it('returns undefined when image transformation fails', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock transformImage to throw error
      vi.mocked(transformImage).mockRejectedValue(new Error('Transform error'));

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(appIconURLs.current).toBeUndefined();
      });
    });
  });

  describe('appManifestURL derived state', () => {
    let blobContentMap = new Map();

    beforeEach(async () => {
      // Reset the state and let the effect settle before the mocks are set up
      cmsConfig.current = undefined;
      appIconURLs.current = undefined;
      await wait();
      vi.clearAllMocks();
      global.fetch = vi.fn();
      blobContentMap = new Map();

      // Mock window.location for manifest URL generation
      if (typeof window === 'undefined') {
        globalThis.window = {
          // @ts-expect-error - partial Location mock for testing
          location: {
            origin: 'http://localhost:5173',
            pathname: '/',
          },
        };
      } else {
        // @ts-expect-error - partial Location mock for testing
        window.location = {
          origin: 'http://localhost:5173',
          pathname: '/',
        };
      }

      // Capture blob content when Blob is created
      const OriginalBlob = Blob;

      // @ts-expect-error - test mock of Blob constructor
      globalThis.Blob = class TestBlob extends OriginalBlob {
        /**
         * Test blob constructor that captures content.
         * @param {BlobPart[]} blobParts Blob parts to store.
         * @param {BlobPropertyBag} options Blob options.
         */
        constructor(blobParts, options) {
          super(blobParts, options);

          // Store the content for later retrieval
          if (blobParts && blobParts.length > 0) {
            const content = blobParts[0];

            blobContentMap.set(this, typeof content === 'string' ? content : content.toString());
          }
        }
      };

      // Mock URL.createObjectURL to return a data URL with the actual manifest content
      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
        const content = blobContentMap.get(blob) || '{}';

        return `data:application/manifest+json,${encodeURIComponent(content)}`;
      });
    });

    afterEach(() => {
      // Restore original Blob
      const OriginalBlob = Blob;

      globalThis.Blob = OriginalBlob;
      vi.clearAllMocks();
      vi.restoreAllMocks();
    });

    it('returns undefined when iconURLs is not available', () => {
      cmsConfig.current = /** @type {any} */ ({ app_title: 'Test CMS' });

      const value = appManifestURL.current;

      // Since appIconURLs would be undefined initially, manifest should be undefined
      expect(value).toBeUndefined();
    });

    it('generates manifest with valid structure when iconURLs becomes available', async () => {
      const customTitle = 'My Custom CMS';
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      vi.mocked(encodeBase64).mockResolvedValue('base64-encoded-data');

      cmsConfig.current = /** @type {any} */ ({ app_title: customTitle, logo: { src: logoURL } });

      // Wait for async icon generation to complete
      await vi.waitFor(() => {
        expect(appManifestURL.current).toBeDefined();
      });

      expect(appManifestURL.current).toMatch(/^data:application\/manifest\+json,/);

      // Decode and parse the manifest
      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (appManifestURL.current).replace(
          'data:application/manifest+json,',
          '',
        ),
      );

      const manifest = JSON.parse(manifestJSON);

      expect(manifest).toMatchObject({
        name: customTitle,
        short_name: customTitle,
        start_url: 'http://localhost:5173/',
        display: 'standalone',
      });

      expect(manifest.icons).toHaveLength(2);

      // Verify we have both sizes (order may vary based on implementation)
      const sizes = manifest.icons.map((/** @type {{ sizes: string }} */ icon) => icon.sizes);

      expect(sizes).toContain('512x512');
      expect(sizes).toContain('192x192');

      // All icons should be webp
      manifest.icons.forEach((/** @type {{ type: string; src: string }} */ icon) => {
        expect(icon.type).toBe('image/webp');
        expect(icon.src).toContain('data:image/webp;base64,');
      });
    });

    it('uses DEFAULT_APP_TITLE when app_title is not configured', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-svg-data'], { type: 'image/svg+xml' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      await vi.waitFor(() => {
        expect(appManifestURL.current).toBeDefined();
      });

      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (appManifestURL.current).replace(
          'data:application/manifest+json,',
          '',
        ),
      );

      const manifest = JSON.parse(manifestJSON);

      expect(manifest.name).toBe(DEFAULT_APP_TITLE);
      expect(manifest.short_name).toBe(DEFAULT_APP_TITLE);
    });

    it('properly encodes special characters in manifest JSON', async () => {
      const titleWithSpecialChars = 'CMS & "Content" <Management>';
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      cmsConfig.current = /** @type {any} */ ({
        app_title: titleWithSpecialChars,
        logo: { src: logoURL },
      });

      await vi.waitFor(() => {
        expect(appManifestURL.current).toBeDefined();
      });

      // Should be able to decode and parse without errors
      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (appManifestURL.current).replace(
          'data:application/manifest+json,',
          '',
        ),
      );

      const manifest = JSON.parse(manifestJSON);

      expect(manifest.name).toBe(titleWithSpecialChars);
      expect(manifest.short_name).toBe(titleWithSpecialChars);
    });

    it('includes both 512x512 and 192x192 icon sizes', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      vi.mocked(encodeBase64).mockResolvedValue('base64-icon-data');

      cmsConfig.current = /** @type {any} */ ({ logo: { src: logoURL } });

      await vi.waitFor(() => {
        expect(appManifestURL.current).toBeDefined();
      });

      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (appManifestURL.current).replace(
          'data:application/manifest+json,',
          '',
        ),
      );

      const manifest = JSON.parse(manifestJSON);

      // Verify icons array has both required sizes for PWA
      expect(manifest.icons).toHaveLength(2);

      const sizes = manifest.icons.map((/** @type {{ sizes: string }} */ icon) => icon.sizes);

      expect(sizes).toContain('512x512');
      expect(sizes).toContain('192x192');

      // All icons should be webp type
      manifest.icons.forEach((/** @type {{ type: string; src: string }} */ icon) => {
        expect(icon.type).toBe('image/webp');
        expect(icon.src).toContain('data:image/webp;base64,');
      });
    });
  });
});
