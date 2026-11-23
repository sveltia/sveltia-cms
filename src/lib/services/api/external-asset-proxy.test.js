import * as fileUtils from '@sveltia/utils/file';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExternalAssetProxy } from './external-asset-proxy';

vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn((_blob) => Promise.resolve('base64encodedstring')),
}));

describe('ExternalAssetProxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should refer to the file with its URL', () => {
    const proxy = new ExternalAssetProxy('https://example.com/photo.jpg');

    expect(proxy.url).toBe('https://example.com/photo.jpg');
    expect(proxy.path).toBe('https://example.com/photo.jpg');
    expect(proxy.fileObj).toBeUndefined();
    expect(proxy.field).toBeUndefined();
    expect(proxy.toString()).toBe('https://example.com/photo.jpg');
    expect(`${proxy}`).toBe('https://example.com/photo.jpg');
  });

  it('should encode the fetched file as base64', async () => {
    const blob = new Blob(['test']);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: vi.fn(async () => blob) })),
    );

    await expect(new ExternalAssetProxy('https://example.com/a.jpg').toBase64()).resolves.toBe(
      'base64encodedstring',
    );
    expect(fetch).toHaveBeenCalledWith('https://example.com/a.jpg');
    expect(fileUtils.encodeBase64).toHaveBeenCalledWith(blob);
  });

  it('should reject if the file cannot be retrieved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    );

    await expect(new ExternalAssetProxy('https://example.com/a.jpg').toBase64()).rejects.toThrow(
      'Failed to encode asset as base64: HTTP 404',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(new ExternalAssetProxy('https://example.com/a.jpg').toBase64()).rejects.toThrow(
      'Failed to encode asset as base64: Failed to fetch',
    );
  });
});
