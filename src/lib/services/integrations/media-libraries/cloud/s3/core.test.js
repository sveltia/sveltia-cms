import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildObjectApiUrl,
  buildObjectUrl,
  deleteS3Objects,
  encodeKey,
  generateAwsSignature,
  isS3ObjectUrl,
  listS3Objects,
  parseS3Results,
  renameS3Object,
  replaceS3Object,
  searchS3Objects,
  signedRequest,
  uploadToS3,
} from './core';

/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-cond-assign */
// Setup global fetch mock
global.fetch = vi.fn();

// Setup DOMParser mock
// @ts-ignore - Mock implementation for testing
global.DOMParser = class {
  /**
   * Mock XML parser.
   * @param {string} xmlString XML string.
   * @returns {object} Parsed document.
   */
  parseFromString(xmlString) {
    /**
     * Parse XML string to Element-like object.
     * @param {string} xml XML.
     * @returns {object} Element.
     */
    const parseElement = (xml) => {
      // Match opening tag, content, and closing tag
      const rootMatch = xml.match(/<(\w+)>([\s\S]*)<\/\1>/);

      if (!rootMatch) {
        return { tagName: '', textContent: '', children: [] };
      }

      const [, tagName, content] = rootMatch;
      // Check if content has nested elements
      const hasChildren = /<\w+>/.test(content);

      if (!hasChildren) {
        // Simple text content
        return {
          tagName,
          textContent: content.trim(),
          children: [],
        };
      }

      // Parse child elements
      const children = [];
      const childRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let match;

      while ((match = childRegex.exec(content)) !== null) {
        const childElement = parseElement(match[0]);

        children.push(childElement);
      }

      return {
        tagName,
        textContent: '',
        children,
      };
    };

    return {
      documentElement: parseElement(xmlString),
    };
  }
};
/* eslint-enable jsdoc/require-jsdoc */
/* eslint-enable no-cond-assign */

// Setup crypto mocks
const mockDigest = vi.spyOn(crypto.subtle, 'digest');
// @ts-ignore - Mock key for testing
const mockImportKey = vi.spyOn(crypto.subtle, 'importKey');
const mockSign = vi.spyOn(crypto.subtle, 'sign');

describe('integrations/media-libraries/cloud/s3/shared utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock crypto.subtle.digest (SHA-256)
    mockDigest.mockResolvedValue(
      new Uint8Array([
        0x6a, 0x09, 0xe6, 0x67, 0xbb, 0x67, 0xae, 0x85, 0x84, 0xca, 0xa7, 0x3b, 0x3c, 0x6e, 0xf3,
        0x72, 0x6a, 0x09, 0xe6, 0x67, 0xbb, 0x67, 0xae, 0x85, 0x84, 0xca, 0xa7, 0x3b, 0x3c, 0x6e,
        0xf3, 0x72,
      ]).buffer,
    );

    // Mock crypto.subtle.importKey
    // @ts-ignore - Mock CryptoKey for testing
    mockImportKey.mockResolvedValue({});

    // Mock crypto.subtle.sign (HMAC)
    mockSign.mockResolvedValue(
      new Uint8Array([
        0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67,
        0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45,
        0x67, 0x89,
      ]).buffer,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildObjectUrl', () => {
    it('should build virtual-hosted-style URL for Amazon S3', () => {
      const url = buildObjectUrl({
        bucket: 'my-bucket',
        key: 'path/to/file.jpg',
        region: 'us-east-1',
        forcePathStyle: false,
      });

      expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/path/to/file.jpg');
    });

    it('should build path-style URL when forced', () => {
      const url = buildObjectUrl({
        bucket: 'my-bucket',
        key: 'path/to/file.jpg',
        region: 'us-west-2',
        forcePathStyle: true,
      });

      expect(url).toBe('https://s3.us-west-2.amazonaws.com/my-bucket/path/to/file.jpg');
    });

    it('should use custom endpoint when provided', () => {
      const url = buildObjectUrl({
        bucket: 'my-bucket',
        key: 'path/to/file.jpg',
        endpoint: 'https://custom.endpoint.com',
      });

      expect(url).toBe('https://custom.endpoint.com/my-bucket/path/to/file.jpg');
    });

    it('should use publicUrl when provided, ignoring endpoint and region', () => {
      const url = buildObjectUrl({
        bucket: 'my-bucket',
        key: 'path/to/file.jpg',
        endpoint: 'https://custom.endpoint.com',
        region: 'us-east-1',
        publicUrl: 'https://pub-abc123.r2.dev',
      });

      expect(url).toBe('https://pub-abc123.r2.dev/path/to/file.jpg');
    });
  });

  describe('parseS3Results', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    it('should parse S3 objects to ExternalAsset format', () => {
      const objects = [
        {
          Key: 'images/photo.jpg',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 1024,
          ETag: '"abc123"',
        },
        {
          Key: 'videos/clip.mp4',
          LastModified: '2025-01-02T00:00:00.000Z',
          Size: 2048,
          ETag: '"def456"',
        },
      ];

      const results = parseS3Results(objects, mockConfig);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'images/photo.jpg',
        description: 'images/photo.jpg',
        fileName: 'photo.jpg',
        size: 1024,
        kind: 'image',
      });
      expect(results[1]).toMatchObject({
        id: 'videos/clip.mp4',
        description: 'videos/clip.mp4',
        fileName: 'clip.mp4',
        size: 2048,
        kind: 'video',
      });
    });

    it('should strip prefix from description', () => {
      const objects = [
        {
          Key: 'uploads/images/photo.jpg',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 1024,
          ETag: '"abc123"',
        },
      ];

      const results = parseS3Results(objects, {
        ...mockConfig,
        prefix: 'uploads/',
      });

      expect(results[0].description).toBe('images/photo.jpg');
      expect(results[0].id).toBe('uploads/images/photo.jpg');
    });

    it('should detect image file kinds', () => {
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];

      const objects = imageExts.map((ext) => ({
        Key: `test.${ext}`,
        LastModified: '2025-01-01T00:00:00.000Z',
        Size: 1024,
        ETag: '"abc"',
      }));

      const results = parseS3Results(objects, mockConfig);

      results.forEach((result) => {
        expect(result.kind).toBe('image');
      });
    });

    it('should detect video file kinds', () => {
      const videoExts = ['mp4', 'webm', 'mov', 'avi'];

      const objects = videoExts.map((ext) => ({
        Key: `test.${ext}`,
        LastModified: '2025-01-01T00:00:00.000Z',
        Size: 1024,
        ETag: '"abc"',
      }));

      const results = parseS3Results(objects, mockConfig);

      results.forEach((result) => {
        expect(result.kind).toBe('video');
      });
    });

    it('should classify unknown extensions as other', () => {
      const objects = [
        {
          Key: 'archive.xyz',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 1024,
          ETag: '"abc"',
        },
      ];

      const results = parseS3Results(objects, mockConfig);

      expect(results[0].kind).toBe('other');
    });

    it('should classify document extensions correctly', () => {
      const objects = [
        {
          Key: 'document.pdf',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 1024,
          ETag: '"abc"',
        },
      ];

      const results = parseS3Results(objects, mockConfig);

      expect(results[0].kind).toBe('document');
    });

    it('should use public_url for previewURL and downloadURL when provided', () => {
      const objects = [
        {
          Key: 'images/photo.jpg',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 1024,
          ETag: '"abc"',
        },
      ];

      const results = parseS3Results(objects, {
        ...mockConfig,
        public_url: 'https://pub-abc123.r2.dev',
      });

      expect(results[0].previewURL).toBe('https://pub-abc123.r2.dev/images/photo.jpg');
      expect(results[0].downloadURL).toBe('https://pub-abc123.r2.dev/images/photo.jpg');
    });

    it('should use public_url with prefix in key for previewURL', () => {
      const objects = [
        {
          Key: 'uploads/photo.jpg',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 1024,
          ETag: '"abc"',
        },
      ];

      const results = parseS3Results(objects, {
        ...mockConfig,
        prefix: 'uploads/',
        public_url: 'https://media.example.com',
      });

      expect(results[0].previewURL).toBe('https://media.example.com/uploads/photo.jpg');
      expect(results[0].downloadURL).toBe('https://media.example.com/uploads/photo.jpg');
    });

    it('should use key as filename when split produces empty string', () => {
      const objects = [
        {
          Key: '/',
          LastModified: '2025-01-01T00:00:00.000Z',
          Size: 0,
          ETag: '"abc"',
        },
      ];

      const results = parseS3Results(objects, mockConfig);

      expect(results[0].fileName).toBe('/');
    });
  });

  describe('generateAwsSignature', () => {
    it('should generate AWS Signature Version 4', async () => {
      const params = {
        method: 'GET',
        url: 'https://my-bucket.s3.us-east-1.amazonaws.com/',
        headers: {
          Host: 'my-bucket.s3.us-east-1.amazonaws.com',
          'x-amz-date': '20250101T000000Z',
          'x-amz-content-sha256':
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 's3',
        date: new Date('2025-01-01T00:00:00.000Z'),
      };

      const signature = await generateAwsSignature(params);

      expect(signature).toContain('AWS4-HMAC-SHA256');
      expect(signature).toContain('Credential=AKIAIOSFODNN7EXAMPLE');
      expect(signature).toContain('SignedHeaders=');
      expect(signature).toContain('Signature=');
    });

    it('should produce stable canonical query string for equal-key params', async () => {
      const params = {
        method: 'GET',
        url: 'https://my-bucket.s3.us-east-1.amazonaws.com/?prefix=a&prefix=b',
        headers: {
          Host: 'my-bucket.s3.us-east-1.amazonaws.com',
          'x-amz-date': '20250101T000000Z',
          'x-amz-content-sha256':
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 's3',
        date: new Date('2025-01-01T00:00:00.000Z'),
      };

      const signature = await generateAwsSignature(params);

      // The function should complete successfully with duplicate query param keys
      expect(signature).toContain('AWS4-HMAC-SHA256');
      expect(signature).toContain('Signature=');
    });
  });

  describe('signedRequest', () => {
    it('should make a signed request', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('success', { status: 200 }));

      const config = {
        access_key_id: 'AKIAIOSFODNN7EXAMPLE',
        bucket: 'test-bucket',
        region: 'us-east-1',
      };

      await signedRequest({
        method: 'GET',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/',
        config,
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://test-bucket.s3.us-east-1.amazonaws.com/',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('AWS4-HMAC-SHA256'),
            Host: 'test-bucket.s3.us-east-1.amazonaws.com',
            'x-amz-date': expect.any(String),
            'x-amz-content-sha256': expect.any(String),
          }),
        }),
      );
    });

    it('should use default region if not provided', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('success', { status: 200 }));

      const config = {
        access_key_id: 'AKIAIOSFODNN7EXAMPLE',
        bucket: 'test-bucket',
      };

      await signedRequest({
        method: 'GET',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/',
        config,
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('listS3Objects', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    it('should list objects from S3', async () => {
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>image1.jpg</Key>
    <LastModified>2025-01-01T00:00:00.000Z</LastModified>
    <Size>1024</Size>
    <ETag>"abc123"</ETag>
  </Contents>
  <Contents>
    <Key>image2.png</Key>
    <LastModified>2025-01-02T00:00:00.000Z</LastModified>
    <Size>2048</Size>
    <ETag>"def456"</ETag>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      const results = await listS3Objects(mockConfig, {
        kind: undefined,
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(2);
      expect(results[0].fileName).toBe('image1.jpg');
      expect(results[1].fileName).toBe('image2.png');
    });

    it('should filter by image kind', async () => {
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>image.jpg</Key>
    <LastModified>2025-01-01T00:00:00.000Z</LastModified>
    <Size>1024</Size>
  </Contents>
  <Contents>
    <Key>document.pdf</Key>
    <LastModified>2025-01-02T00:00:00.000Z</LastModified>
    <Size>2048</Size>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      const results = await listS3Objects(mockConfig, {
        kind: 'image',
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(1);
      expect(results[0].fileName).toBe('image.jpg');
    });

    it('should handle pagination', async () => {
      const page1Response = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>file1.jpg</Key>
    <LastModified>2025-01-01T00:00:00.000Z</LastModified>
    <Size>1024</Size>
  </Contents>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>token123</NextContinuationToken>
</ListBucketResult>`;

      const page2Response = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>file2.jpg</Key>
    <LastModified>2025-01-02T00:00:00.000Z</LastModified>
    <Size>2048</Size>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(page1Response, { status: 200 }))
        .mockResolvedValueOnce(new Response(page2Response, { status: 200 }));

      const results = await listS3Objects(mockConfig, {
        kind: undefined,
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should filter out directories', async () => {
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>folder/</Key>
    <LastModified>2025-01-01T00:00:00.000Z</LastModified>
    <Size>0</Size>
  </Contents>
  <Contents>
    <Key>folder/file.jpg</Key>
    <LastModified>2025-01-02T00:00:00.000Z</LastModified>
    <Size>1024</Size>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      const results = await listS3Objects(mockConfig, {
        kind: undefined,
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(1);
      expect(results[0].fileName).toBe('file.jpg');
    });

    it('should handle errors', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 403 }));

      await expect(
        listS3Objects(mockConfig, {
          kind: undefined,
          apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        }),
      ).rejects.toThrow('Failed to list objects');
    });

    it('should reject when apiKey is missing', async () => {
      await expect(
        listS3Objects(mockConfig, { kind: undefined, apiKey: /** @type {any} */ (undefined) }),
      ).rejects.toThrow('S3 secret access key is required');
    });

    it('should include prefix query param when prefix is configured', async () => {
      const xmlResponse = '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>';

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      await listS3Objects(
        { ...mockConfig, prefix: 'uploads/' },
        { kind: undefined, apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('prefix=uploads%2F'),
        expect.anything(),
      );
    });

    it('should build path-style URL when forcePathStyle is true', async () => {
      const xmlResponse = '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>';

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      await listS3Objects(
        { ...mockConfig, force_path_style: true },
        { kind: undefined, apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('s3.us-east-1.amazonaws.com/test-bucket?'),
        expect.anything(),
      );
    });

    it('should use custom endpoint in list URL when configured', async () => {
      const xmlResponse = '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>';

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      await listS3Objects(
        { ...mockConfig, endpoint: 'https://nyc3.digitaloceanspaces.com' },
        { kind: undefined, apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('nyc3.digitaloceanspaces.com/test-bucket?'),
        expect.anything(),
      );
    });

    it('should handle single Contents item (non-array) response', async () => {
      const xmlResponse =
        '<ListBucketResult>' +
        '<Contents><Key>single.jpg</Key><LastModified>2025-01-01T00:00:00.000Z</LastModified><Size>1024</Size></Contents>' +
        '<IsTruncated>false</IsTruncated>' +
        '</ListBucketResult>';

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      const results = await listS3Objects(mockConfig, {
        kind: undefined,
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(1);
      expect(results[0].fileName).toBe('single.jpg');
    });
  });

  describe('searchS3Objects', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    it('should search objects by filename', async () => {
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>vacation-photo.jpg</Key>
    <LastModified>2025-01-01T00:00:00.000Z</LastModified>
    <Size>1024</Size>
  </Contents>
  <Contents>
    <Key>work-document.pdf</Key>
    <LastModified>2025-01-02T00:00:00.000Z</LastModified>
    <Size>2048</Size>
  </Contents>
  <Contents>
    <Key>another-photo.jpg</Key>
    <LastModified>2025-01-03T00:00:00.000Z</LastModified>
    <Size>1536</Size>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      const results = await searchS3Objects('photo', mockConfig, {
        kind: undefined,
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(2);
      expect(results[0].fileName).toBe('vacation-photo.jpg');
      expect(results[1].fileName).toBe('another-photo.jpg');
    });

    it('should be case-insensitive', async () => {
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>Photo.jpg</Key>
    <LastModified>2025-01-01T00:00:00.000Z</LastModified>
    <Size>1024</Size>
  </Contents>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      vi.mocked(fetch).mockResolvedValue(new Response(xmlResponse, { status: 200 }));

      const results = await searchS3Objects('photo', mockConfig, {
        kind: undefined,
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(1);
    });
  });

  describe('uploadToS3', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    it('should upload files to S3', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const results = await uploadToS3([mockFile], mockConfig, {
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(1);
      expect(results[0].fileName).toBe('test.jpg');
      expect(results[0].kind).toBe('image');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('test.jpg'),
        expect.objectContaining({
          method: 'PUT',
        }),
      );
    });

    it('should apply prefix to uploaded files', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      await uploadToS3(
        [mockFile],
        { ...mockConfig, prefix: 'uploads/' },
        { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('uploads/test.jpg'),
        expect.anything(),
      );
    });

    it('should sanitize path traversal in file names', async () => {
      const mockFile = new File(['content'], '../../secret.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const results = await uploadToS3([mockFile], mockConfig, {
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results[0].fileName).toBe('secret.jpg');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('secret.jpg'), expect.anything());
      expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('..'), expect.anything());
    });

    it('should return empty array for no files', async () => {
      const results = await uploadToS3([], mockConfig, {
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 403 }));

      await expect(
        uploadToS3([mockFile], mockConfig, { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }),
      ).rejects.toThrow('Failed to upload file');
    });

    it('should reject when apiKey is missing', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(
        uploadToS3([mockFile], mockConfig, { apiKey: /** @type {any} */ (undefined) }),
      ).rejects.toThrow('S3 secret access key is required');
    });

    it('should sleep between multiple file uploads', async () => {
      const file1 = new File(['content1'], 'first.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'second.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const results = await uploadToS3([file1, file2], mockConfig, {
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should build path-style upload URL when forcePathStyle is true', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      await uploadToS3(
        [mockFile],
        { ...mockConfig, force_path_style: true },
        { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('s3.us-east-1.amazonaws.com/test-bucket/test.jpg'),
        expect.anything(),
      );
    });

    it('should use custom endpoint in upload URL when configured', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      await uploadToS3(
        [mockFile],
        { ...mockConfig, endpoint: 'https://nyc3.digitaloceanspaces.com' },
        { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('nyc3.digitaloceanspaces.com/test-bucket/test.jpg'),
        expect.anything(),
      );
    });

    it('should use application/octet-stream when file type is empty', async () => {
      const mockFile = new File(['content'], 'data.bin', { type: '' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      await uploadToS3([mockFile], mockConfig, {
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
            'x-amz-acl': 'public-read',
          }),
        }),
      );
    });

    it('should omit x-amz-acl header when acl is false', async () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      await uploadToS3(
        [mockFile],
        { ...mockConfig, acl: false },
        {
          apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'x-amz-acl': expect.anything(),
          }),
        }),
      );
    });

    it('should fall back to file.name when all path components are empty', async () => {
      const mockFile = new File(['content'], '/', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const results = await uploadToS3([mockFile], mockConfig, {
        apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(results[0].fileName).toBe('/');
    });
  });

  describe('encodeKey', () => {
    it('should encode each segment, including the characters SigV4 requires', () => {
      expect(encodeKey("images/my photo (1)!'*.jpg")).toBe(
        'images/my%20photo%20%281%29%21%27%2A.jpg',
      );
      expect(encodeKey('a#b?c+d/e.jpg')).toBe('a%23b%3Fc%2Bd/e.jpg');
    });
  });

  describe('buildObjectApiUrl', () => {
    it('should percent-encode the key so a `#` is not treated as a fragment', () => {
      const url = buildObjectApiUrl(
        { access_key_id: 'AKIA', bucket: 'my-bucket', region: 'us-east-1' },
        'images/a#1.jpg',
      );

      expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/images/a%231.jpg');
      expect(new URL(url).pathname).toBe('/images/a%231.jpg');
    });

    it('should ignore public_url and use the endpoint', () => {
      const url = buildObjectApiUrl(
        {
          access_key_id: 'AKIA',
          bucket: 'my-bucket',
          region: 'auto',
          endpoint: 'https://account.r2.cloudflarestorage.com',
          public_url: 'https://cdn.example.com',
        },
        'images/photo.jpg',
      );

      expect(url).toBe('https://account.r2.cloudflarestorage.com/my-bucket/images/photo.jpg');
    });

    it('should build a virtual-hosted-style URL without an endpoint', () => {
      const url = buildObjectApiUrl(
        { access_key_id: 'AKIA', bucket: 'my-bucket', region: 'us-east-1' },
        'photo.jpg',
      );

      expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/photo.jpg');
    });
  });

  describe('isS3ObjectUrl', () => {
    it('should match the public URL and the API endpoint of the bucket', () => {
      const config = {
        access_key_id: 'AKIA',
        bucket: 'my-bucket',
        region: 'us-east-1',
        public_url: 'https://cdn.example.com',
      };

      expect(isS3ObjectUrl(config, 'https://cdn.example.com/images/a.jpg')).toBe(true);
      expect(isS3ObjectUrl(config, 'https://my-bucket.s3.us-east-1.amazonaws.com/a.jpg')).toBe(
        true,
      );
      expect(isS3ObjectUrl(config, 'https://other-bucket.s3.us-east-1.amazonaws.com/a.jpg')).toBe(
        false,
      );
      expect(isS3ObjectUrl(config, 'https://example.com/a.jpg')).toBe(false);
    });
  });

  describe('deleteS3Objects', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    const options = { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
    /** @type {any} */
    const asset = { id: 'images/photo.jpg', fileName: 'photo.jpg' };

    it('should send a DELETE request for each object', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

      await deleteS3Objects([asset, { ...asset, id: 'images/other.jpg' }], mockConfig, options);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://test-bucket.s3.us-east-1.amazonaws.com/images/photo.jpg',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://test-bucket.s3.us-east-1.amazonaws.com/images/other.jpg',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should not sleep for a single object', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

      await deleteS3Objects([asset], mockConfig, options);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should reject when apiKey is missing', async () => {
      await expect(
        deleteS3Objects([asset], mockConfig, { apiKey: /** @type {any} */ (undefined) }),
      ).rejects.toThrow('S3 secret access key is required');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw when the request fails', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('Access Denied', { status: 403 }));

      await expect(deleteS3Objects([asset], mockConfig, options)).rejects.toThrow(
        'Failed to delete object images/photo.jpg: Access Denied',
      );
    });
  });

  describe('renameS3Object', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    const options = { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
    /** @type {any} */
    const asset = { id: 'images/my photo.jpg', fileName: 'my photo.jpg', size: 1234 };

    it('should copy the object to the new key and delete the original', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const result = await renameS3Object(asset, 'renamed.jpg', mockConfig, options);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://test-bucket.s3.us-east-1.amazonaws.com/images/renamed.jpg',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'x-amz-copy-source': '/test-bucket/images/my%20photo.jpg',
            'x-amz-metadata-directive': 'COPY',
            'x-amz-acl': 'public-read',
          }),
        }),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://test-bucket.s3.us-east-1.amazonaws.com/images/my%20photo.jpg',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'images/renamed.jpg',
          fileName: 'renamed.jpg',
          size: 1234,
          kind: 'image',
        }),
      );
    });

    it('should rename an object at the bucket root', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const result = await renameS3Object(
        { ...asset, id: 'photo.jpg' },
        'renamed.jpg',
        mockConfig,
        options,
      );

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://test-bucket.s3.us-east-1.amazonaws.com/renamed.jpg',
        expect.anything(),
      );
      expect(result.id).toBe('renamed.jpg');
    });

    it('should default the size to 0 and omit the ACL when unsupported', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const result = await renameS3Object(
        { ...asset, size: undefined },
        'renamed.jpg',
        { ...mockConfig, acl: false },
        options,
      );

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          headers: expect.not.objectContaining({ 'x-amz-acl': expect.anything() }),
        }),
      );
      expect(result.size).toBe(0);
    });

    it('should reject when apiKey is missing', async () => {
      await expect(
        renameS3Object(asset, 'renamed.jpg', mockConfig, {
          apiKey: /** @type {any} */ (undefined),
        }),
      ).rejects.toThrow('S3 secret access key is required');
    });

    it('should throw and keep the original when the copy fails', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('Access Denied', { status: 403 }));

      await expect(renameS3Object(asset, 'renamed.jpg', mockConfig, options)).rejects.toThrow(
        'Failed to copy object images/my photo.jpg: Access Denied',
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('replaceS3Object', () => {
    const mockConfig = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    const options = { apiKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
    /** @type {any} */
    const asset = { id: 'images/photo.jpg', fileName: 'photo.jpg', size: 10 };

    it('should overwrite the object under the same key', async () => {
      const file = new File(['new content'], 'whatever.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));

      const result = await replaceS3Object(asset, file, mockConfig, options);

      expect(fetch).toHaveBeenCalledWith(
        'https://test-bucket.s3.us-east-1.amazonaws.com/images/photo.jpg',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'Content-Type': 'image/jpeg' }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'images/photo.jpg', fileName: 'photo.jpg', size: 11 }),
      );
    });

    it('should reject when apiKey is missing', async () => {
      const file = new File(['new content'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(
        replaceS3Object(asset, file, mockConfig, { apiKey: /** @type {any} */ (undefined) }),
      ).rejects.toThrow('S3 secret access key is required');
    });

    it('should throw when the upload fails', async () => {
      const file = new File(['new content'], 'photo.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('Denied', { status: 403 }));

      await expect(replaceS3Object(asset, file, mockConfig, options)).rejects.toThrow(
        'Failed to upload file photo.jpg: Denied',
      );
    });
  });
});
