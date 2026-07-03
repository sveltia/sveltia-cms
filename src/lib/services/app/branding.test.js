/* eslint-disable jsdoc/require-jsdoc */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import {
  appIconURLs,
  appLogoType,
  appLogoURL,
  appManifestURL,
  appTitle,
  DEFAULT_APP_LOGO_URL,
  DEFAULT_APP_TITLE,
} from './branding.js';

// Mock the cmsConfig store
vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    subscribe: vi.fn(),
  },
}));

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

  describe('appTitle derived store', () => {
    it('returns DEFAULT_APP_TITLE when config is null', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        callback(undefined);
        return vi.fn();
      });

      let value;

      const unsubscribe = appTitle.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_TITLE);
      unsubscribe();
    });

    it('returns DEFAULT_APP_TITLE when app_title is not set', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({});
        return vi.fn();
      });

      let value;

      const unsubscribe = appTitle.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_TITLE);
      unsubscribe();
    });

    it('returns custom app_title from config', () => {
      const customTitle = 'My Custom CMS';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: customTitle });
        return vi.fn();
      });

      let value;

      const unsubscribe = appTitle.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(customTitle);
      unsubscribe();
    });
  });

  describe('appLogoURL derived store', () => {
    it('returns DEFAULT_APP_LOGO_URL when config is null', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        callback(undefined);
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_LOGO_URL);
      unsubscribe();
    });

    it('returns logo.src from config when available', () => {
      const logoURL = 'https://example.com/logo.png';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(logoURL);
      unsubscribe();
    });

    it('returns deprecated logo_url when logo.src is not available', () => {
      const logoURL = 'https://example.com/legacy-logo.svg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo_url: logoURL });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(logoURL);
      unsubscribe();
    });

    it('prefers logo.src over deprecated logo_url', () => {
      const newLogoURL = 'https://example.com/new-logo.png';
      const oldLogoURL = 'https://example.com/old-logo.svg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: newLogoURL }, logo_url: oldLogoURL });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(newLogoURL);
      unsubscribe();
    });

    it('returns DEFAULT_APP_LOGO_URL when no logo is configured', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: 'Some CMS' });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_LOGO_URL);
      unsubscribe();
    });
  });

  describe('appLogoType derived store', () => {
    it('extracts MIME type from data URL', () => {
      const dataURL = 'data:image/png;base64,iVBORw0KG';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: dataURL } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/png');
      unsubscribe();
    });

    it('extracts SVG MIME type from data URL', () => {
      const dataURL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: dataURL } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/svg+xml');
      unsubscribe();
    });

    it('detects MIME type from file extension for PNG', () => {
      const url = 'https://example.com/logo.png';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/png');
      unsubscribe();
    });

    it('detects MIME type from file extension for SVG', () => {
      const url = 'https://example.com/logo.svg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/svg+xml');
      unsubscribe();
    });

    it('detects MIME type from file extension for JPEG', () => {
      const url = 'https://example.com/logo.jpg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/jpeg');
      unsubscribe();
    });

    it('returns undefined for unknown file type', () => {
      const url = 'https://example.com/logo.unknown';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBeUndefined();
      unsubscribe();
    });

    it('returns image/svg+xml when using DEFAULT_APP_LOGO_URL', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        callback(undefined);
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/svg+xml');
      unsubscribe();
    });
  });

  describe('appIconURLs derived store', () => {
    beforeEach(() => {
      // Reset all mocks including module mocks
      vi.clearAllMocks();
      vi.resetModules();
      global.fetch = vi.fn();
    });

    it('generates small and large icon URLs from logo', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      // Mock the config with a logo
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // Mock fetch to return the blob
      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock transformImage to return transformed blob
      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      // Mock encodeBase64 to return base64 string
      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-encoded-data');

      /** @type {{ small: string; large: string } | undefined} */
      let value;

      const unsubscribe = appIconURLs.subscribe((v) => {
        value = v;
      });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(value).toBeDefined();
      });

      expect(value).toEqual({
        small: 'data:image/webp;base64,base64-encoded-data',
        large: 'data:image/webp;base64,base64-encoded-data',
      });

      expect(global.fetch).toHaveBeenCalledWith(logoURL);
      expect(transformImage).toHaveBeenCalledTimes(2);
      expect(encodeBase64).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it('calls transformImage with correct options for large icon', async () => {
      const logoURL = 'https://example.com/logo.svg';
      const mockBlob = new Blob(['fake-svg-data'], { type: 'image/svg+xml' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage, THUMBNAIL_TRANSFORM_OPTIONS } =
        await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      const unsubscribe = appIconURLs.subscribe(() => {});

      await vi.waitFor(() => {
        expect(transformImage).toHaveBeenCalled();
      });

      // Check that large icon uses default THUMBNAIL_TRANSFORM_OPTIONS
      expect(transformImage).toHaveBeenCalledWith(mockBlob, THUMBNAIL_TRANSFORM_OPTIONS);

      unsubscribe();
    });

    it('calls transformImage with correct options for small icon', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage, THUMBNAIL_TRANSFORM_OPTIONS } =
        await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      const unsubscribe = appIconURLs.subscribe(() => {});

      await vi.waitFor(() => {
        expect(transformImage).toHaveBeenCalledTimes(2);
      });

      // Check that small icon has 192x192 dimensions
      expect(transformImage).toHaveBeenCalledWith(mockBlob, {
        ...THUMBNAIL_TRANSFORM_OPTIONS,
        width: 192,
        height: 192,
      });

      unsubscribe();
    });

    it('returns undefined when fetch fails', async () => {
      const logoURL = 'https://example.com/logo.png';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // Mock fetch to fail
      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      });

      /** @type {{ small: string; large: string } | undefined} */
      let value;

      const unsubscribe = appIconURLs.subscribe((v) => {
        value = v;
      });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(value).toBeUndefined();
      });

      expect(global.fetch).toHaveBeenCalledWith(logoURL);

      unsubscribe();
    });

    it('returns undefined when fetch throws an error', async () => {
      const logoURL = 'https://example.com/logo.png';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // Mock fetch to throw error
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      /** @type {{ small: string; large: string } | undefined} */
      let value;

      const unsubscribe = appIconURLs.subscribe((v) => {
        value = v;
      });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(value).toBeUndefined();
      });

      expect(global.fetch).toHaveBeenCalledWith(logoURL);

      unsubscribe();
    });

    it('returns undefined when image transformation fails', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      // Mock transformImage to throw error
      vi.mocked(transformImage).mockRejectedValue(new Error('Transform error'));

      /** @type {{ small: string; large: string } | undefined} */
      let value;

      const unsubscribe = appIconURLs.subscribe((v) => {
        value = v;
      });

      // Wait for async operation to complete
      await vi.waitFor(() => {
        expect(value).toBeUndefined();
      });

      unsubscribe();
    });
  });

  describe('appManifestURL derived store', () => {
    let blobContentMap = new Map();

    beforeEach(() => {
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
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: 'Test CMS' });
        return vi.fn();
      });

      let value;

      const unsubscribe = appManifestURL.subscribe((v) => {
        value = v;
      });

      // Since appIconURLs would be undefined initially, manifest should be undefined
      expect(value).toBeUndefined();

      unsubscribe();
    });

    it('generates manifest with valid structure when iconURLs becomes available', async () => {
      const customTitle = 'My Custom CMS';
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: customTitle, logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-encoded-data');

      /** @type {string | undefined} */
      let manifestValue;

      const unsubscribe = appManifestURL.subscribe((v) => {
        manifestValue = v;
      });

      // Wait for async icon generation to complete
      await vi.waitFor(() => {
        expect(manifestValue).toBeDefined();
      });

      expect(manifestValue).toMatch(/^data:application\/manifest\+json,/);

      // Decode and parse the manifest
      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (manifestValue).replace('data:application/manifest+json,', ''),
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

      unsubscribe();
    });

    it('uses DEFAULT_APP_TITLE when app_title is not configured', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-svg-data'], { type: 'image/svg+xml' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      /** @type {string | undefined} */
      let manifestValue;

      const unsubscribe = appManifestURL.subscribe((v) => {
        manifestValue = v;
      });

      await vi.waitFor(() => {
        expect(manifestValue).toBeDefined();
      });

      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (manifestValue).replace('data:application/manifest+json,', ''),
      );

      const manifest = JSON.parse(manifestJSON);

      expect(manifest.name).toBe(DEFAULT_APP_TITLE);
      expect(manifest.short_name).toBe(DEFAULT_APP_TITLE);

      unsubscribe();
    });

    it('properly encodes special characters in manifest JSON', async () => {
      const titleWithSpecialChars = 'CMS & "Content" <Management>';
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: titleWithSpecialChars, logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-data');

      /** @type {string | undefined} */
      let manifestValue;

      const unsubscribe = appManifestURL.subscribe((v) => {
        manifestValue = v;
      });

      await vi.waitFor(() => {
        expect(manifestValue).toBeDefined();
      });

      // Should be able to decode and parse without errors
      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (manifestValue).replace('data:application/manifest+json,', ''),
      );

      const manifest = JSON.parse(manifestJSON);

      expect(manifest.name).toBe(titleWithSpecialChars);
      expect(manifest.short_name).toBe(titleWithSpecialChars);

      unsubscribe();
    });

    it('includes both 512x512 and 192x192 icon sizes', async () => {
      const logoURL = 'https://example.com/logo.png';
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const mockTransformedBlob = new Blob(['fake-webp-data'], { type: 'image/webp' });

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      // @ts-expect-error - partial mock of Response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { transformImage } = await import('$lib/services/utils/media/image/transform');

      vi.mocked(transformImage).mockResolvedValue(mockTransformedBlob);

      const { encodeBase64 } = await import('@sveltia/utils/file');

      vi.mocked(encodeBase64).mockResolvedValue('base64-icon-data');

      /** @type {string | undefined} */
      let manifestValue;

      const unsubscribe = appManifestURL.subscribe((v) => {
        manifestValue = v;
      });

      await vi.waitFor(() => {
        expect(manifestValue).toBeDefined();
      });

      const manifestJSON = decodeURIComponent(
        /** @type {string} */ (manifestValue).replace('data:application/manifest+json,', ''),
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

      unsubscribe();
    });
  });
});
