import * as fileUtils from '@sveltia/utils/file';
import { describe, expect, it, vi } from 'vitest';

import { UnsavedAssetProxy } from './unsaved-asset-proxy';

vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn((_blob) => Promise.resolve('base64encodedstring')),
}));

describe('UnsavedAssetProxy', () => {
  it('should refer to the file with its blob URL', async () => {
    const file = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
    const proxy = new UnsavedAssetProxy('blob:https://example.com/1', file);

    expect(proxy.url).toBe('blob:https://example.com/1');
    expect(proxy.path).toBe('blob:https://example.com/1');
    expect(proxy.fileObj).toBe(file);
    expect(proxy.field).toBeUndefined();
    expect(proxy.toString()).toBe('blob:https://example.com/1');
    await expect(proxy.toBase64()).resolves.toBe('base64encodedstring');
    expect(fileUtils.encodeBase64).toHaveBeenCalledWith(file);
  });
});
