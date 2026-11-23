import { afterEach, describe, expect, test, vi } from 'vitest';

import { readClipboardImage } from '$lib/services/contents/fields/file/clipboard';

/**
 * Stub the clipboard with the given items.
 * @param {{ types: string[], data?: Blob }[]} items Clipboard items.
 */
const stubClipboard = (items) => {
  vi.stubGlobal('navigator', {
    clipboard: {
      read: vi.fn(async () =>
        items.map(({ types, data }) => ({ types, getType: vi.fn(async () => data) })),
      ),
    },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readClipboardImage()', () => {
  test('reads the first image, naming the file after its type', async () => {
    const svg = new Blob(['<svg/>'], { type: 'image/svg+xml' });

    stubClipboard([
      { types: ['text/plain'] },
      { types: ['text/html', 'image/svg+xml'], data: svg },
      { types: ['image/png'], data: new Blob(['x']) },
    ]);

    const file = await readClipboardImage();

    expect(file?.name).toMatch(/^pasted-image-\d+\.svg$/);
    expect(file?.type).toBe('image/svg+xml');
    expect(await file?.text()).toBe('<svg/>');
  });

  test('returns `undefined` for a clipboard without an image', async () => {
    stubClipboard([{ types: ['text/plain'] }]);

    expect(await readClipboardImage()).toBeUndefined();
  });

  test('throws when the clipboard can’t be read', async () => {
    vi.stubGlobal('navigator', { clipboard: { read: vi.fn().mockRejectedValue(new Error('No')) } });

    await expect(readClipboardImage()).rejects.toThrow('No');
  });
});
