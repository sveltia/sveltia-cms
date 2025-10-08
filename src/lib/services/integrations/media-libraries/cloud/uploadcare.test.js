import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import uploadcareService, {
  generateSignature,
  getLibraryOptions,
  getPublicKey,
  isEnabled,
  list,
  parseResults,
  search,
  upload,
} from './uploadcare';

// Mock dependencies
vi.mock('svelte/store', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return {
    ...actual,
    get: vi.fn(),
  };
});

vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(),
}));

vi.mock('$lib/services/utils/file', () => ({
  formatFileName: vi.fn((name) => name),
}));

// Setup global fetch mock
global.fetch = vi.fn();

describe('integrations/media-libraries/cloud/uploadcare', () => {
  const mockPublicKey = 'abcdef1234567890abcd';
  const mockSecretKey = 'fedcba0987654321fedc';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the siteConfig to return uploadcare config
    vi.mocked(get).mockReturnValue({
      media_libraries: {
        uploadcare: {
          config: {
            publicKey: mockPublicKey,
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(uploadcareService.serviceType).toBe('cloud_storage');
      expect(uploadcareService.serviceId).toBe('uploadcare');
      expect(uploadcareService.serviceLabel).toBe('Uploadcare');
      expect(uploadcareService.serviceURL).toBe('https://uploadcare.com/');
      expect(uploadcareService.showServiceLink).toBe(true);
      expect(uploadcareService.hotlinking).toBe(true);
      expect(uploadcareService.authType).toBe('api_key');
      expect(uploadcareService.developerURL).toBe('https://uploadcare.com/docs/');
      expect(uploadcareService.apiKeyURL).toBe('https://app.uploadcare.com/projects/-/api-keys/');
      expect(uploadcareService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import/no-named-as-default-member
      expect(uploadcareService.list).toBeDefined();
      // eslint-disable-next-line import/no-named-as-default-member
      expect(uploadcareService.search).toBeDefined();
    });

    it('should validate public key format', () => {
      const { apiKeyPattern } = uploadcareService;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      expect(apiKeyPattern.test('abcdef1234567890abcd')).toBe(true);
      expect(apiKeyPattern.test('0123456789abcdef0123')).toBe(true);
      expect(apiKeyPattern.test('short')).toBe(false);
      expect(apiKeyPattern.test('123456789012345678901')).toBe(false); // too long (21 chars)
      expect(apiKeyPattern.test('abcdefg1234567890abc')).toBe(false); // contains 'g' (invalid hex)
    });
  });

  describe('getPublicKey', () => {
    it('should return the public key from config', () => {
      const key = getPublicKey();

      expect(key).toBe(mockPublicKey);
      expect(get).toHaveBeenCalled();
    });

    it('should return undefined when config is missing', () => {
      vi.mocked(get).mockReturnValue({});

      const key = getPublicKey();

      expect(key).toBeUndefined();
    });

    it('should return undefined when uploadcare config is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {},
      });

      const key = getPublicKey();

      expect(key).toBeUndefined();
    });
  });

  describe('getLibraryOptions', () => {
    it('should return uploadcare library options from media_libraries', () => {
      const options = getLibraryOptions();

      expect(options).toBeDefined();
      expect(options?.config?.publicKey).toBe(mockPublicKey);
    });

    it('should return undefined when config is missing', () => {
      vi.mocked(get).mockReturnValue({});

      const options = getLibraryOptions();

      expect(options).toBeUndefined();
    });

    it('should support legacy media_library config', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'uploadcare',
          config: {
            publicKey: 'legacy-public-key',
          },
        },
      });

      const options = getLibraryOptions();

      expect(options).toBeDefined();
      expect(options?.config?.publicKey).toBe('legacy-public-key');
    });

    it('should return undefined for non-uploadcare media_library', () => {
      vi.mocked(get).mockReturnValue({
        media_library: {
          name: 'other-service',
          config: {},
        },
      });

      const options = getLibraryOptions();

      expect(options).toBeUndefined();
    });
  });

  describe('isEnabled', () => {
    it('should return true when public key is configured', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should return false when config is missing', () => {
      vi.mocked(get).mockReturnValue({});

      expect(isEnabled()).toBe(false);
    });

    it('should return false when public key is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {},
          },
        },
      });

      expect(isEnabled()).toBe(false);
    });

    it('should return false when uploadcare config is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {},
      });

      expect(isEnabled()).toBe(false);
    });
  });

  describe('generateSignature', () => {
    /** @type {Crypto} */
    let originalCrypto;

    beforeEach(() => {
      // Save original crypto and mock it
      originalCrypto = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          subtle: {
            importKey: vi.fn().mockResolvedValue({}),
            sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          },
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // Restore original crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    });

    it('should generate signature from secret key and expire timestamp', async () => {
      const expire = Math.floor(Date.now() / 1000) + 1800;
      const signature = await generateSignature(mockSecretKey, expire);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      expect(global.crypto.subtle.sign).toHaveBeenCalled();
    });

    it('should return hex string', async () => {
      const expire = Math.floor(Date.now() / 1000) + 1800;
      const signature = await generateSignature(mockSecretKey, expire);

      expect(signature).toMatch(/^[0-9a-f]+$/);
    });

    it('should use HMAC-SHA256', async () => {
      const expire = Math.floor(Date.now() / 1000) + 1800;

      await generateSignature(mockSecretKey, expire);

      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
    });

    it('should produce different signatures for different expire times', async () => {
      const expire1 = 1000000000;
      const expire2 = 2000000000;

      // Mock different outputs
      vi.spyOn(global.crypto.subtle, 'sign')
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4]).buffer)
        .mockResolvedValueOnce(new Uint8Array([5, 6, 7, 8]).buffer);

      const signature1 = await generateSignature(mockSecretKey, expire1);
      const signature2 = await generateSignature(mockSecretKey, expire2);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('parseResults', () => {
    it('should parse image files correctly', () => {
      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: { image: { width: 1920, height: 1080 } },
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'abc123',
        description: 'image.jpg',
        previewURL: 'https://ucarecdn.com/abc123/-/preview/400x400/',
        downloadURL: 'https://ucarecdn.com/abc123/',
        fileName: 'image.jpg',
        lastModified: new Date('2025-01-01T00:00:00.000Z'),
        size: 12345,
        kind: 'image',
      });
    });

    it('should parse video files correctly', () => {
      const mockResults = [
        {
          uuid: 'def456',
          original_filename: 'video.mp4',
          original_file_url: 'https://ucarecdn.com/def456/video.mp4',
          size: 98765,
          mime_type: 'video/mp4',
          is_image: false,
          is_ready: true,
          content_info: { video: { duration: 120 } },
          datetime_uploaded: '2025-01-02T00:00:00.000Z',
          datetime_stored: '2025-01-02T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'def456',
        description: 'video.mp4',
        previewURL: 'https://ucarecdn.com/def456/-/preview/400x400/',
        downloadURL: 'https://ucarecdn.com/def456/',
        fileName: 'video.mp4',
        lastModified: new Date('2025-01-02T00:00:00.000Z'),
        size: 98765,
        kind: 'video',
      });
    });

    it('should parse other file types correctly', () => {
      const mockResults = [
        {
          uuid: 'ghi789',
          original_filename: 'document.pdf',
          original_file_url: 'https://ucarecdn.com/ghi789/document.pdf',
          size: 54321,
          mime_type: 'application/pdf',
          is_image: false,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-03T00:00:00.000Z',
          datetime_stored: '2025-01-03T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'ghi789',
        description: 'document.pdf',
        previewURL: 'https://ucarecdn.com/ghi789/-/preview/400x400/',
        downloadURL: 'https://ucarecdn.com/ghi789/',
        fileName: 'document.pdf',
        lastModified: new Date('2025-01-03T00:00:00.000Z'),
        size: 54321,
        kind: 'other',
      });
    });

    it('should parse multiple files correctly', () => {
      const mockResults = [
        {
          uuid: 'file1',
          original_filename: 'image1.jpg',
          original_file_url: 'https://ucarecdn.com/file1/image1.jpg',
          size: 100,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
        {
          uuid: 'file2',
          original_filename: 'image2.png',
          original_file_url: 'https://ucarecdn.com/file2/image2.png',
          size: 200,
          mime_type: 'image/png',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-02T00:00:00.000Z',
          datetime_stored: '2025-01-02T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('file1');
      expect(results[1].id).toBe('file2');
    });

    it('should use custom cdnBase when configured', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
              cdnBase: 'https://custom-cdn.example.com',
            },
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0].previewURL).toBe(
        'https://custom-cdn.example.com/abc123/-/preview/400x400/',
      );
      expect(results[0].downloadURL).toBe('https://custom-cdn.example.com/abc123/');
    });

    it('should include filename in downloadURL when autoFilename is true', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
            },
            settings: {
              autoFilename: true,
            },
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0].downloadURL).toBe('https://ucarecdn.com/abc123/image.jpg');
    });

    it('should not include filename when autoFilename is false', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
            },
            settings: {
              autoFilename: false,
            },
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0].downloadURL).toBe('https://ucarecdn.com/abc123/');
    });

    it('should include defaultOperations in downloadURL when configured', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
            },
            settings: {
              defaultOperations: '/quality/smart/-/format/auto/',
            },
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0].downloadURL).toBe(
        'https://ucarecdn.com/abc123/-/quality/smart/-/format/auto/',
      );
    });

    it('should combine defaultOperations with autoFilename', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
            },
            settings: {
              autoFilename: true,
              defaultOperations: '/quality/smart/-/format/auto/',
            },
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0].downloadURL).toBe(
        'https://ucarecdn.com/abc123/-/quality/smart/-/format/auto/image.jpg',
      );
    });

    it('should use all options together: cdnBase, defaultOperations, and autoFilename', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
              cdnBase: 'https://custom-cdn.example.com',
            },
            settings: {
              autoFilename: true,
              defaultOperations: '/quality/smart/-/format/auto/',
            },
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults);

      expect(results).toHaveLength(1);
      expect(results[0].previewURL).toBe(
        'https://custom-cdn.example.com/abc123/-/preview/400x400/',
      );
      expect(results[0].downloadURL).toBe(
        'https://custom-cdn.example.com/abc123/-/quality/smart/-/format/auto/image.jpg',
      );
    });

    it('should use field-level config over global config', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          uploadcare: {
            config: {
              publicKey: mockPublicKey,
              cdnBase: 'https://global-cdn.example.com',
            },
            settings: {
              autoFilename: false,
              defaultOperations: '/global/operations/',
            },
          },
        },
      });

      const fieldConfig = /** @type {import('$lib/types/public').ImageField} */ ({
        name: 'test_image',
        widget: 'image',
        media_library: {
          name: 'uploadcare',
          config: {
            cdnBase: 'https://field-cdn.example.com',
          },
          settings: {
            autoFilename: true,
            defaultOperations: '/field/operations/',
          },
        },
      });

      const mockResults = [
        {
          uuid: 'abc123',
          original_filename: 'image.jpg',
          original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
          size: 12345,
          mime_type: 'image/jpeg',
          is_image: true,
          is_ready: true,
          content_info: null,
          datetime_uploaded: '2025-01-01T00:00:00.000Z',
          datetime_stored: '2025-01-01T00:00:00.000Z',
          datetime_removed: null,
        },
      ];

      const results = parseResults(mockResults, { fieldConfig });

      expect(results).toHaveLength(1);
      expect(results[0].previewURL).toBe('https://field-cdn.example.com/abc123/-/preview/400x400/');
      expect(results[0].downloadURL).toBe(
        'https://field-cdn.example.com/abc123/-/field/operations/image.jpg',
      );
    });
  });

  describe('list', () => {
    it('should fetch files successfully', async () => {
      const mockResponse = {
        results: [
          {
            uuid: 'abc123',
            original_filename: 'image.jpg',
            original_file_url: 'https://ucarecdn.com/abc123/image.jpg',
            size: 12345,
            mime_type: 'image/jpeg',
            is_image: true,
            is_ready: true,
            content_info: null,
            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            datetime_stored: '2025-01-01T00:00:00.000Z',
            datetime_removed: null,
          },
        ],
        next: null,
        total: 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await list({ apiKey: mockSecretKey });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.uploadcare.com/files/'),
        expect.objectContaining({
          headers: {
            Accept: 'application/vnd.uploadcare-v0.7+json',
            Authorization: `Uploadcare.Simple ${mockPublicKey}:${mockSecretKey}`,
          },
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('abc123');
    });

    it('should handle pagination', async () => {
      const mockResponsePage1 = {
        results: [
          {
            uuid: 'file1',
            original_filename: 'image1.jpg',
            original_file_url: 'https://ucarecdn.com/file1/image1.jpg',
            size: 100,
            mime_type: 'image/jpeg',
            is_image: true,
            is_ready: true,
            content_info: null,
            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            datetime_stored: '2025-01-01T00:00:00.000Z',
            datetime_removed: null,
          },
        ],
        next: 'https://api.uploadcare.com/files/?page=2',
        total: 2,
      };

      const mockResponsePage2 = {
        results: [
          {
            uuid: 'file2',
            original_filename: 'image2.jpg',
            original_file_url: 'https://ucarecdn.com/file2/image2.jpg',
            size: 200,
            mime_type: 'image/jpeg',
            is_image: true,
            is_ready: true,
            content_info: null,
            datetime_uploaded: '2025-01-02T00:00:00.000Z',
            datetime_stored: '2025-01-02T00:00:00.000Z',
            datetime_removed: null,
          },
        ],
        next: null,
        total: 2,
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage1),
          }),
        )
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage2),
          }),
        );

      const results = await list({ apiKey: mockSecretKey });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('file1');
      expect(results[1].id).toBe('file2');
    });

    it('should reject when public key is not configured', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(list({ apiKey: '' })).rejects.toThrow('Uploadcare public key is not configured');
    });

    it('should reject when API request fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: false,
          statusText: 'Unauthorized',
        }),
      );

      await expect(list({ apiKey: mockSecretKey })).rejects.toThrow(
        'Failed to fetch files: Unauthorized',
      );
    });

    it('should limit to 5 pages', async () => {
      const mockResponse = {
        results: [
          {
            uuid: 'file',
            original_filename: 'image.jpg',
            original_file_url: 'https://ucarecdn.com/file/image.jpg',
            size: 100,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: 'https://api.uploadcare.com/files/?page=next',
        total: 1000,
      };

      const mockResponseLast = {
        ...mockResponse,
        next: null,
      };

      // Mock 5 pages - last page should have next: null
      for (let i = 0; i < 4; i += 1) {
        vi.mocked(fetch).mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponse),
          }),
        );
      }

      // Last page with next: null
      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponseLast),
        }),
      );

      const results = await list({ apiKey: mockSecretKey });

      expect(fetch).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5); // 1 result per page
    });
  });

  describe('search', () => {
    it('should search files successfully', async () => {
      const mockResponse = {
        results: [
          {
            uuid: 'abc123',
            original_filename: 'test-image.jpg',
            original_file_url: 'https://ucarecdn.com/abc123/test-image.jpg',
            size: 12345,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
          {
            uuid: 'def456',
            original_filename: 'other-file.png',
            original_file_url: 'https://ucarecdn.com/def456/other-file.png',
            size: 54321,
            mime_type: 'image/png',
            content_info: null,

            datetime_uploaded: '2025-01-02T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: null,
        total: 2,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await search('test', { apiKey: mockSecretKey });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1); // Only 'test-image.jpg' matches
      expect(results[0].id).toBe('abc123');
      expect(results[0].fileName).toBe('test-image.jpg');
    });

    it('should filter results case-insensitively', async () => {
      const mockResponse = {
        results: [
          {
            uuid: 'file1',
            original_filename: 'TEST-Image.jpg',
            original_file_url: 'https://ucarecdn.com/file1/TEST-Image.jpg',
            size: 100,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
          {
            uuid: 'file2',
            original_filename: 'other.jpg',
            original_file_url: 'https://ucarecdn.com/file2/other.jpg',
            size: 200,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-02T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: null,
        total: 2,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await search('test', { apiKey: mockSecretKey });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('file1');
    });

    it('should handle pagination during search', async () => {
      const mockResponsePage1 = {
        results: [
          {
            uuid: 'file1',
            original_filename: 'search-result-1.jpg',
            original_file_url: 'https://ucarecdn.com/file1/search-result-1.jpg',
            size: 100,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: 'https://api.uploadcare.com/files/?page=2',
        total: 2,
      };

      const mockResponsePage2 = {
        results: [
          {
            uuid: 'file2',
            original_filename: 'search-result-2.jpg',
            original_file_url: 'https://ucarecdn.com/file2/search-result-2.jpg',
            size: 200,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-02T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: null,
        total: 2,
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage1),
          }),
        )
        .mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponsePage2),
          }),
        );

      const results = await search('result', { apiKey: mockSecretKey });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('file1');
      expect(results[1].id).toBe('file2');
    });

    it('should reject when public key is not configured', async () => {
      vi.mocked(get).mockReturnValue({});

      await expect(search('test', { apiKey: '' })).rejects.toThrow(
        'Uploadcare public key is not configured',
      );
    });

    it('should reject when API request fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: false,
          statusText: 'Bad Request',
        }),
      );

      await expect(search('test', { apiKey: mockSecretKey })).rejects.toThrow(
        'Failed to fetch files: Bad Request',
      );
    });

    it('should limit to 10 pages for search', async () => {
      const mockResponse = {
        results: [
          {
            uuid: 'file',
            original_filename: 'searchable-image.jpg',
            original_file_url: 'https://ucarecdn.com/file/searchable-image.jpg',
            size: 100,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: 'https://api.uploadcare.com/files/?page=next',
        total: 1000,
      };

      // Mock 10 pages
      for (let i = 0; i < 10; i += 1) {
        vi.mocked(fetch).mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponse),
          }),
        );
      }

      const results = await search('searchable', { apiKey: mockSecretKey });

      expect(fetch).toHaveBeenCalledTimes(10);
      expect(results).toHaveLength(10); // 1 matching result per page
    });

    it('should return empty array when no results match', async () => {
      const mockResponse = {
        results: [
          {
            uuid: 'file1',
            original_filename: 'image.jpg',
            original_file_url: 'https://ucarecdn.com/file1/image.jpg',
            size: 100,
            mime_type: 'image/jpeg',
            content_info: null,

            datetime_uploaded: '2025-01-01T00:00:00.000Z',
            is_image: true,
            is_ready: true,
          },
        ],
        next: null,
        total: 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const results = await search('nonexistent', { apiKey: mockSecretKey });

      expect(results).toHaveLength(0);
    });
  });

  describe('upload', () => {
    /** @type {Crypto} */
    let originalCrypto;

    beforeEach(() => {
      vi.mocked(get).mockReturnValue({
        media_libraries: { uploadcare: { config: { publicKey: mockPublicKey } } },
      });
      // Save original crypto and mock it
      originalCrypto = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          subtle: {
            importKey: vi.fn().mockResolvedValue({}),
            sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          },
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // Restore original crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    });

    it('should upload a single file successfully', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

      const mockResponse = {
        'test.jpg': 'abc-123',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const result = await upload([mockFile], { apiKey: mockSecretKey });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'abc-123',
        fileName: 'test.jpg',
        kind: 'image',
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://upload.uploadcare.com/base/',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should upload multiple files successfully', async () => {
      const mockFile1 = new File(['content 1'], 'file1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content 2'], 'file2.png', { type: 'image/png' });

      const mockResponse = {
        'file1.jpg': 'abc-123',
        'file2.png': 'def-456',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const result = await upload([mockFile1, mockFile2], { apiKey: mockSecretKey });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('abc-123');
      expect(result[1].id).toBe('def-456');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should include signature in FormData', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue({
            'test.jpg': { uuid: 'abc-123' },
          }),
        }),
      );

      await upload([mockFile], { apiKey: mockSecretKey });

      const formData = vi.mocked(fetch).mock.calls[0]?.[1]?.body;

      expect(formData).toBeInstanceOf(FormData);

      // Verify crypto was called to generate signature
      expect(global.crypto.subtle.importKey).toHaveBeenCalled();
      expect(global.crypto.subtle.sign).toHaveBeenCalled();
    });

    it('should reject when public key is not configured', async () => {
      vi.mocked(get).mockReturnValue({ media_libraries: {} });

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(upload([mockFile], { apiKey: mockSecretKey })).rejects.toThrow(
        'Uploadcare public key is not configured',
      );
    });

    it('should reject when API key is not provided', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(upload([mockFile], /** @type {any} */ ({}))).rejects.toThrow(
        'Uploadcare secret key is not provided',
      );
    });

    it('should handle upload failure', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        }),
      );

      await expect(upload([mockFile], { apiKey: mockSecretKey })).rejects.toThrow();
    });

    it('should handle empty file array', async () => {
      const result = await upload([], { apiKey: mockSecretKey });

      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should generate valid signature format', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue({
            'test.jpg': { uuid: 'abc-123' },
          }),
        }),
      );

      await upload([mockFile], { apiKey: mockSecretKey });

      // Verify signature generation was called with correct algorithm
      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
    });
  });
});
