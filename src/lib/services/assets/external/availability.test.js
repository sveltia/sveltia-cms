import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getExternalAssetDetails } from '$lib/services/assets/external/details';

import {
  _resetExternalAssetAvailability,
  checkExternalAssetAvailability,
  checkExternalAssetsAvailability,
  externalAssetAvailability,
  isMixedContent,
  probeURL,
} from './availability';

/**
 * @import { ExternalAsset } from '$lib/types/private';
 */

vi.mock('$lib/services/assets/external/details', () => ({
  getExternalAssetDetails: vi.fn(),
}));

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

/**
 * Create a linked asset.
 * @param {string} url URL.
 * @param {ExternalAsset['kind']} kind Kind.
 * @returns {ExternalAsset} Asset.
 */
const createAsset = (url, kind) => ({
  id: url,
  description: url,
  previewURL: url,
  downloadURL: url,
  fileName: url.split('/').pop() ?? '',
  kind,
});

/**
 * Make `fetch` respond with the given status.
 * @param {number} status HTTP status.
 */
const respondWith = (status) => {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status });
};

describe('assets/external/availability', () => {
  beforeEach(() => {
    _resetExternalAssetAvailability();
    fetchMock.mockReset();
    vi.mocked(getExternalAssetDetails).mockResolvedValue({});
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
  });

  describe('probeURL', () => {
    it('should report an existing file', async () => {
      respondWith(200);

      await expect(probeURL('https://example.com/a.pdf')).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/a.pdf', { method: 'HEAD' });
    });

    it('should report a missing file', async () => {
      respondWith(404);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBe(false);

      respondWith(403);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBe(false);

      respondWith(500);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBe(false);
    });

    it('should not conclude anything from a server that doesn’t answer HEAD requests', async () => {
      respondWith(405);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBeUndefined();

      respondWith(429);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBeUndefined();

      respondWith(501);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBeUndefined();
    });

    it('should not conclude anything from a redirect or an opaque response', async () => {
      respondWith(304);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBeUndefined();

      // An opaque response has status 0
      respondWith(0);
      await expect(probeURL('https://example.com/a.pdf')).resolves.toBeUndefined();
    });

    it('should fall back to an opaque request when the host doesn’t allow CORS', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: false, status: 0 });

      await expect(probeURL('https://example.com/a.pdf')).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/a.pdf', {
        method: 'HEAD',
        mode: 'no-cors',
      });
    });

    it('should report a host that can’t be reached', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(probeURL('https://gone.example.com/a.pdf')).resolves.toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('isMixedContent', () => {
    it('should flag an http: URL on an https: page only', () => {
      vi.stubGlobal('window', { location: { protocol: 'https:' } });
      expect(isMixedContent('http://example.com/a.pdf')).toBe(true);
      expect(isMixedContent('https://example.com/a.pdf')).toBe(false);

      vi.stubGlobal('window', { location: { protocol: 'http:' } });
      expect(isMixedContent('http://example.com/a.pdf')).toBe(false);
    });
  });

  describe('checkExternalAssetAvailability', () => {
    it('should not conclude anything about a file blocked as mixed content', async () => {
      // The browser blocks every request, which would otherwise read as a missing file
      vi.stubGlobal('window', { location: { protocol: 'https:' } });
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        checkExternalAssetAvailability(createAsset('http://example.com/a.png', 'image')),
      ).resolves.toBeUndefined();
      await expect(
        checkExternalAssetAvailability(createAsset('http://example.com/a.pdf', 'document')),
      ).resolves.toBeUndefined();
      expect(getExternalAssetDetails).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should load a media file in a media element', async () => {
      const image = createAsset('https://example.com/a.png', 'image');
      const audio = createAsset('https://example.com/a.mp3', 'audio');

      vi.mocked(getExternalAssetDetails).mockResolvedValueOnce({
        dimensions: { width: 1, height: 1 },
      });
      await expect(checkExternalAssetAvailability(image)).resolves.toBe(true);

      vi.mocked(getExternalAssetDetails).mockResolvedValueOnce({ duration: 3 });
      await expect(checkExternalAssetAvailability(audio)).resolves.toBe(true);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should ask the host about a media file that can’t be decoded', async () => {
      const image = createAsset('https://example.com/a.png', 'image');

      // A file in a format the browser doesn’t support
      respondWith(200);
      await expect(checkExternalAssetAvailability(image)).resolves.toBe(true);

      respondWith(404);
      await expect(checkExternalAssetAvailability(image)).resolves.toBe(false);

      // The file couldn’t be loaded, and the host doesn’t say why
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(checkExternalAssetAvailability(image)).resolves.toBe(false);
    });

    it('should only ask the host about any other file', async () => {
      const doc = createAsset('https://example.com/a.pdf', 'document');

      respondWith(200);
      await expect(checkExternalAssetAvailability(doc)).resolves.toBe(true);

      respondWith(410);
      await expect(checkExternalAssetAvailability(doc)).resolves.toBe(false);

      respondWith(405);
      await expect(checkExternalAssetAvailability(doc)).resolves.toBeUndefined();

      expect(getExternalAssetDetails).not.toHaveBeenCalled();
    });
  });

  describe('checkExternalAssetsAvailability', () => {
    const missing = createAsset('https://example.com/missing.pdf', 'document');
    const existing = createAsset('https://example.com/existing.pdf', 'document');
    const unknown = createAsset('https://example.com/unknown.pdf', 'document');

    beforeEach(() => {
      fetchMock.mockImplementation(async (/** @type {string} */ url) => {
        if (url === missing.id) return { ok: false, status: 404 };
        if (url === existing.id) return { ok: true, status: 200 };

        return { ok: false, status: 405 };
      });
    });

    it('should record the results, leaving out the unknown ones', async () => {
      await checkExternalAssetsAvailability([missing, existing, unknown]);

      expect(externalAssetAvailability.current).toEqual({
        [missing.id]: false,
        [existing.id]: true,
      });
    });

    it('should check each file once', async () => {
      await checkExternalAssetsAvailability([missing, existing]);
      await checkExternalAssetsAvailability([missing, existing, unknown]);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(externalAssetAvailability.current).toEqual({
        [missing.id]: false,
        [existing.id]: true,
      });
    });

    it('should not queue a file twice while its check is in flight', async () => {
      const { promise: response, resolve: respond } = Promise.withResolvers();

      fetchMock.mockImplementation(() => response);

      const first = checkExternalAssetsAvailability([existing]);
      const second = checkExternalAssetsAvailability([existing]);

      await second;
      expect(fetchMock).toHaveBeenCalledTimes(1);

      respond({ ok: true, status: 200 });
      await first;
      expect(externalAssetAvailability.current).toEqual({ [existing.id]: true });
    });
  });
});
