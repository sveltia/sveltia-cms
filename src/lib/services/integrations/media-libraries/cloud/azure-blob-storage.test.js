// @vitest-environment jsdom

import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import azureBlobStorageService, {
  buildContainerUrl,
  buildRequestUrl,
  getLibraryOptions,
  isEnabled,
  list,
  listBlobs,
  parseBlobResults,
  search,
  searchBlobs,
  upload,
  uploadBlobs,
} from './azure-blob-storage';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn() },
}));

global.fetch = vi.fn();

describe('integrations/media-libraries/cloud/azure-blob-storage', () => {
  const accountName = 'mystorageaccount';
  const container = 'media';
  const token = 'sv=2024-11-04&ss=b&srt=o&sp=rwlac&se=2030-01-01T00%3A00%3A00Z&sig=ab%2Bcd%2F12%3D';
  const containerURL = `https://${accountName}.blob.core.windows.net/${container}`;
  const config = { account_name: accountName, container };

  /**
   * Build a `List Blobs` response body. The service returns compact XML, so no whitespace is added
   * within the elements here either.
   * @param {{ name: string, lastModified?: string, size?: number, type?: string }[]} blobs Blobs.
   * @param {string} [nextMarker] Continuation token.
   * @returns {string} XML.
   */
  const buildListXml = (blobs, nextMarker = '') =>
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      `<EnumerationResults ServiceEndpoint="https://${accountName}.blob.core.windows.net/"`,
      ` ContainerName="${container}"><Blobs>`,
      blobs
        .map(({ name, lastModified, size, type }) =>
          [
            `<Blob><Name>${name}</Name>`,
            lastModified === undefined && size === undefined && type === undefined
              ? ''
              : [
                  '<Properties>',
                  lastModified === undefined
                    ? ''
                    : `<Last-Modified>${lastModified}</Last-Modified>`,
                  size === undefined ? '' : `<Content-Length>${size}</Content-Length>`,
                  type === undefined ? '' : `<Content-Type>${type}</Content-Type>`,
                  '</Properties>',
                ].join(''),
            '</Blob>',
          ].join(''),
        )
        .join(''),
      `</Blobs><NextMarker>${nextMarker}</NextMarker></EnumerationResults>`,
    ].join('');

  const sampleBlob = {
    name: 'photo.jpg',
    lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
    size: 1024,
    type: 'image/jpeg',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockReturnValue({
      media_libraries: { azure_blob_storage: config },
    });
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(azureBlobStorageService.serviceType).toBe('cloud_storage');
      expect(azureBlobStorageService.serviceId).toBe('azure_blob_storage');
      expect(azureBlobStorageService.serviceLabel).toBe('Azure Blob Storage');
      expect(azureBlobStorageService.serviceURL).toBe(
        'https://azure.microsoft.com/products/storage/blobs/',
      );
      expect(azureBlobStorageService.showServiceLink).toBe(true);
      expect(azureBlobStorageService.hotlinking).toBe(true);
      expect(azureBlobStorageService.authType).toBe('api_key');
      expect(azureBlobStorageService.developerURL).toBe(
        'https://learn.microsoft.com/en-us/rest/api/storageservices/blob-service-rest-api',
      );
      expect(azureBlobStorageService.apiKeyURL).toBe(
        'https://portal.azure.com/#browse/Microsoft.Storage%2FStorageAccounts',
      );
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(azureBlobStorageService.isEnabled).toBeDefined();
    });

    it('should validate the SAS token format', () => {
      const { apiKeyPattern } = azureBlobStorageService;

      if (!apiKeyPattern) {
        throw new Error('apiKeyPattern is not defined');
      }

      expect(apiKeyPattern.test(token)).toBe(true);
      expect(apiKeyPattern.test(`?${token}`)).toBe(true);
      expect(apiKeyPattern.test('sp=rwlac&sig=abc')).toBe(true);
      expect(apiKeyPattern.test('sig=abc')).toBe(true);
      // A connection string, an account key or an incomplete token should be rejected
      expect(apiKeyPattern.test('sv=2024-11-04&sp=rwlac')).toBe(false);
      expect(apiKeyPattern.test('sv=2024-11-04&sig=')).toBe(false);
      expect(apiKeyPattern.test('AccountKey=abcdef1234567890==')).toBe(false);
      expect(apiKeyPattern.test('')).toBe(false);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return options from the `media_libraries` option', () => {
      expect(getLibraryOptions()).toEqual(config);
    });

    it('should return options from the legacy `media_library` option', () => {
      vi.mocked(get).mockReturnValue({
        media_library: { name: 'azure_blob_storage', ...config },
      });

      expect(getLibraryOptions()).toEqual({ name: 'azure_blob_storage', ...config });
    });

    it('should return undefined when another library is configured', () => {
      vi.mocked(get).mockReturnValue({ media_library: { name: 'cloudinary' } });

      expect(getLibraryOptions()).toBeUndefined();
    });

    it('should return false when explicitly disabled', () => {
      vi.mocked(get).mockReturnValue({ media_libraries: { azure_blob_storage: false } });

      expect(getLibraryOptions()).toBe(false);
    });

    it('should return field-level options when given', () => {
      const fieldOptions = { account_name: 'other', container: 'field-media' };

      expect(
        getLibraryOptions(
          /** @type {any} */ ({ media_libraries: { azure_blob_storage: fieldOptions } }),
        ),
      ).toEqual(fieldOptions);
    });
  });

  describe('isEnabled', () => {
    it('should return true when the account name and container are given', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should return true when a custom endpoint is given instead of the account name', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: {
          azure_blob_storage: { container, endpoint: 'https://cdn.example.com' },
        },
      });

      expect(isEnabled()).toBe(true);
    });

    it('should return false when the container is missing', () => {
      vi.mocked(get).mockReturnValue({
        media_libraries: { azure_blob_storage: { account_name: accountName } },
      });

      expect(isEnabled()).toBe(false);
    });

    it('should return false when the account name and endpoint are both missing', () => {
      vi.mocked(get).mockReturnValue({ media_libraries: { azure_blob_storage: { container } } });

      expect(isEnabled()).toBe(false);
    });

    it('should return false when not configured', () => {
      vi.mocked(get).mockReturnValue({});

      expect(isEnabled()).toBe(false);
    });
  });

  describe('buildContainerUrl', () => {
    it('should build the default Blob service URL', () => {
      expect(buildContainerUrl(config)).toBe(containerURL);
    });

    it('should use a custom endpoint and trim trailing slashes', () => {
      expect(buildContainerUrl({ ...config, endpoint: 'https://cdn.example.com/' })).toBe(
        'https://cdn.example.com/media',
      );
    });
  });

  describe('buildRequestUrl', () => {
    it('should append the SAS token as given', () => {
      expect(buildRequestUrl({ url: containerURL, token })).toBe(`${containerURL}?${token}`);
    });

    it('should strip a leading question mark or ampersand from the token', () => {
      expect(buildRequestUrl({ url: containerURL, token: `?${token}` })).toBe(
        `${containerURL}?${token}`,
      );
      expect(buildRequestUrl({ url: containerURL, token: `&${token}` })).toBe(
        `${containerURL}?${token}`,
      );
    });

    it('should prepend any extra query parameters', () => {
      const searchParams = new URLSearchParams({ restype: 'container', comp: 'list' });

      expect(buildRequestUrl({ url: containerURL, token, searchParams })).toBe(
        `${containerURL}?restype=container&comp=list&${token}`,
      );
    });
  });

  describe('parseBlobResults', () => {
    it('should convert blobs to assets', () => {
      const [asset] = parseBlobResults(
        [
          {
            Name: 'photo.jpg',
            Properties: {
              'Last-Modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
              'Content-Length': '1024',
              'Content-Type': 'image/jpeg',
            },
          },
        ],
        config,
        token,
      );

      expect(asset).toEqual({
        id: 'photo.jpg',
        description: 'photo.jpg',
        previewURL: `${containerURL}/photo.jpg?${token}`,
        downloadURL: `${containerURL}/photo.jpg`,
        fileName: 'photo.jpg',
        lastModified: new Date('Mon, 01 Jan 2024 00:00:00 GMT'),
        size: 1024,
        kind: 'image',
      });
    });

    it('should omit the last modified date and size when not returned', () => {
      const [asset] = parseBlobResults([{ Name: 'photo.jpg' }], config, token);

      expect(asset.lastModified).toBeUndefined();
      expect(asset.size).toBeUndefined();
    });

    it('should use the public URL for the download and preview URLs', () => {
      const [asset] = parseBlobResults(
        [{ Name: 'photo.jpg' }],
        {
          ...config,
          public_url: 'https://cdn.example.com/',
        },
        token,
      );

      expect(asset.downloadURL).toBe('https://cdn.example.com/photo.jpg');
      expect(asset.previewURL).toBe('https://cdn.example.com/photo.jpg');
    });

    it('should strip the configured prefix from the description', () => {
      const [asset] = parseBlobResults(
        [{ Name: 'uploads/photo.jpg' }],
        { ...config, prefix: 'uploads/' },
        token,
      );

      expect(asset.description).toBe('photo.jpg');
      expect(asset.fileName).toBe('photo.jpg');
      expect(asset.id).toBe('uploads/photo.jpg');
    });

    it('should keep the description as is when it doesn’t start with the prefix', () => {
      const [asset] = parseBlobResults(
        [{ Name: 'other/photo.jpg' }],
        { ...config, prefix: 'uploads/' },
        token,
      );

      expect(asset.description).toBe('other/photo.jpg');
    });

    it('should fall back to the blob name when it has no file name', () => {
      const [asset] = parseBlobResults([{ Name: '/' }], config, token);

      expect(asset.fileName).toBe('/');
    });

    it('should percent-encode the blob name while keeping path separators', () => {
      const [asset] = parseBlobResults([{ Name: 'my photos/a&b.jpg' }], config, token);

      expect(asset.downloadURL).toBe(`${containerURL}/my%20photos/a%26b.jpg`);
      expect(asset.fileName).toBe('a&b.jpg');
    });
  });

  describe('listBlobs', () => {
    it('should list blobs', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(buildListXml([sampleBlob]), { status: 200 }));

      const assets = await listBlobs(config, { apiKey: token });

      expect(assets).toHaveLength(1);
      expect(assets[0].fileName).toBe('photo.jpg');
      expect(assets[0].size).toBe(1024);
      expect(assets[0].kind).toBe('image');

      expect(fetch).toHaveBeenCalledWith(
        `${containerURL}?restype=container&comp=list&maxresults=1000&${token}`,
      );
    });

    it('should handle multiple blobs', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(buildListXml([sampleBlob, { ...sampleBlob, name: 'second.jpg' }]), {
          status: 200,
        }),
      );

      const assets = await listBlobs(config, { apiKey: token });

      expect(assets.map(({ fileName }) => fileName)).toEqual(['photo.jpg', 'second.jpg']);
    });

    it('should handle an empty container', async () => {
      const xml =
        '<?xml version="1.0" encoding="utf-8"?><EnumerationResults><Blobs /></EnumerationResults>';

      vi.mocked(fetch).mockResolvedValue(new Response(xml, { status: 200 }));

      expect(await listBlobs(config, { apiKey: token })).toEqual([]);
    });

    it('should handle a response without a blob list', async () => {
      const xml =
        '<?xml version="1.0" encoding="utf-8"?><EnumerationResults><NextMarker /></EnumerationResults>';

      vi.mocked(fetch).mockResolvedValue(new Response(xml, { status: 200 }));

      expect(await listBlobs(config, { apiKey: token })).toEqual([]);
    });

    it('should filter out directory placeholders', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(buildListXml([{ name: 'folder/' }, sampleBlob]), { status: 200 }),
      );

      const assets = await listBlobs(config, { apiKey: token });

      expect(assets.map(({ id }) => id)).toEqual(['photo.jpg']);
    });

    it('should filter by asset kind', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(buildListXml([sampleBlob, { ...sampleBlob, name: 'doc.pdf' }]), {
          status: 200,
        }),
      );

      const assets = await listBlobs(config, { apiKey: token, kind: 'image' });

      expect(assets.map(({ id }) => id)).toEqual(['photo.jpg']);
    });

    it('should apply the configured prefix', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(buildListXml([]), { status: 200 }));

      await listBlobs({ ...config, prefix: 'uploads/' }, { apiKey: token });

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('prefix=uploads%2F'));
    });

    it('should follow the continuation marker', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(buildListXml([sampleBlob], 'marker-1'), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(buildListXml([{ ...sampleBlob, name: 'second.jpg' }]), { status: 200 }),
        );

      const assets = await listBlobs(config, { apiKey: token });

      expect(assets).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('marker=marker-1'));
    });

    it('should stop after the maximum number of pages', async () => {
      // A `Response` body can only be read once, so a new one is returned for each call
      vi.mocked(fetch).mockImplementation(
        async () => new Response(buildListXml([sampleBlob], 'marker-1'), { status: 200 }),
      );

      const assets = await listBlobs(config, { apiKey: token }, { maxPages: 2 });

      expect(assets).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should reject when the SAS token is missing', async () => {
      await expect(listBlobs(config, { apiKey: '' })).rejects.toThrow(
        'Azure Blob Storage SAS token is required',
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject when the request fails', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('AuthenticationFailed', { status: 403 }));

      await expect(listBlobs(config, { apiKey: token })).rejects.toThrow(
        'Failed to list blobs: AuthenticationFailed',
      );
    });
  });

  describe('searchBlobs', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          buildListXml([
            { ...sampleBlob, name: 'uploads/cat.jpg' },
            { ...sampleBlob, name: 'uploads/dog.jpg' },
          ]),
          { status: 200 },
        ),
      );
    });

    it('should filter blobs by file name', async () => {
      const assets = await searchBlobs('CAT', config, { apiKey: token });

      expect(assets.map(({ id }) => id)).toEqual(['uploads/cat.jpg']);
    });

    it('should filter blobs by description', async () => {
      const assets = await searchBlobs('uploads/dog', config, { apiKey: token });

      expect(assets.map(({ id }) => id)).toEqual(['uploads/dog.jpg']);
    });

    it('should return an empty array when nothing matches', async () => {
      expect(await searchBlobs('bird', config, { apiKey: token })).toEqual([]);
    });
  });

  describe('uploadBlobs', () => {
    it('should upload a file as a block blob', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      const assets = await uploadBlobs([file], config, { apiKey: token });

      expect(assets).toHaveLength(1);
      expect(assets[0].fileName).toBe('test.jpg');
      expect(assets[0].kind).toBe('image');
      expect(assets[0].size).toBe(file.size);
      expect(assets[0].lastModified).toBeInstanceOf(Date);

      expect(fetch).toHaveBeenCalledWith(`${containerURL}/test.jpg?${token}`, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': 'image/jpeg',
        },
        body: expect.any(ArrayBuffer),
      });
    });

    it('should fall back to a generic content type', async () => {
      const file = new File(['content'], 'test.bin');

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      await uploadBlobs([file], config, { apiKey: token });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/octet-stream' }),
        }),
      );
    });

    it('should apply the configured prefix', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      const assets = await uploadBlobs(
        [file],
        { ...config, prefix: 'uploads/' },
        {
          apiKey: token,
        },
      );

      expect(assets[0].id).toBe('uploads/test.jpg');
      expect(fetch).toHaveBeenCalledWith(
        `${containerURL}/uploads/test.jpg?${token}`,
        expect.anything(),
      );
    });

    it('should sanitize path traversal in file names', async () => {
      const file = new File(['content'], '../../secret.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      const assets = await uploadBlobs([file], config, { apiKey: token });

      expect(assets[0].fileName).toBe('secret.jpg');
      expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('..'), expect.anything());
    });

    it('should fall back to the original file name when it has no file name', async () => {
      const file = new File(['content'], '/', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      const assets = await uploadBlobs([file], config, { apiKey: token });

      expect(assets[0].fileName).toBe('/');
    });

    it('should upload multiple files', async () => {
      const files = [
        new File(['1'], 'first.jpg', { type: 'image/jpeg' }),
        new File(['2'], 'second.jpg', { type: 'image/jpeg' }),
      ];

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      const assets = await uploadBlobs(files, config, { apiKey: token });

      expect(assets.map(({ fileName }) => fileName)).toEqual(['first.jpg', 'second.jpg']);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return an empty array when there is no file', async () => {
      expect(await uploadBlobs([], config, { apiKey: token })).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject when the SAS token is missing', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      await expect(uploadBlobs([file], config, { apiKey: '' })).rejects.toThrow(
        'Azure Blob Storage SAS token is required',
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw when the upload fails', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('AuthorizationFailure', { status: 403 }));

      await expect(uploadBlobs([file], config, { apiKey: token })).rejects.toThrow(
        'Failed to upload file test.jpg: AuthorizationFailure',
      );
    });
  });

  describe('list, search and upload', () => {
    it('should use the configured library options', async () => {
      vi.mocked(fetch).mockImplementation(
        async () => new Response(buildListXml([sampleBlob]), { status: 200 }),
      );

      expect(await list({ apiKey: token })).toHaveLength(1);
      expect(await search('photo', { apiKey: token })).toHaveLength(1);
      expect(await search('nothing', { apiKey: token })).toHaveLength(0);
    });

    it('should upload files with the configured library options', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }));

      expect(await upload([file], { apiKey: token })).toHaveLength(1);
    });

    it('should reject when the library is not configured', async () => {
      vi.mocked(get).mockReturnValue({});

      const message = 'Azure Blob Storage configuration is not available';

      await expect(list({ apiKey: token })).rejects.toThrow(message);
      await expect(search('photo', { apiKey: token })).rejects.toThrow(message);
      await expect(upload([], { apiKey: token })).rejects.toThrow(message);
    });
  });
});
