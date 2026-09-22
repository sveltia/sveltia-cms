import { afterEach, describe, expect, test, vi } from 'vitest';

import { canCopyFileData, copyFileData } from '$lib/services/utils/clipboard';
import { transformImage } from '$lib/services/utils/media/image/transform';

vi.mock('$lib/services/utils/media/image/transform', () => ({
  transformImage: vi.fn(),
}));

const writeText = vi.fn();
const write = vi.fn();

/**
 * Item holding the data to be written, which is exposed to be checked.
 */
class MockClipboardItem {
  /**
   * Create an item.
   * @param {Record<string, Blob>} data Data by type.
   */
  constructor(data) {
    this.data = data;
  }
}

/**
 * Stub the clipboard API, which Node doesn’t have.
 * @param {object} [methods] Methods to expose. Defaults to both.
 */
const stubClipboard = (methods = { writeText, write }) => {
  vi.stubGlobal('navigator', { clipboard: methods });
  vi.stubGlobal('ClipboardItem', MockClipboardItem);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canCopyFileData()', () => {
  test('allows plaintext whatever the clipboard supports', () => {
    stubClipboard({ writeText });

    expect(canCopyFileData('text/plain')).toBe(true);
    expect(canCopyFileData('image/svg+xml')).toBe(true);
  });

  test('allows an image only when the clipboard can take one', () => {
    stubClipboard({ writeText });
    expect(canCopyFileData('image/jpeg')).toBe(false);

    stubClipboard();
    expect(canCopyFileData('image/jpeg')).toBe(true);
    expect(canCopyFileData('image/png')).toBe(true);
  });

  test('refuses any other file', () => {
    stubClipboard();

    expect(canCopyFileData('application/zip')).toBe(false);
    expect(canCopyFileData('application/pdf')).toBe(false);
  });
});

describe('copyFileData()', () => {
  test('copies plaintext as text', async () => {
    stubClipboard();

    await copyFileData(new Blob(['hello'], { type: 'text/plain' }));

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(write).not.toHaveBeenCalled();
  });

  test('copies a PNG as is', async () => {
    stubClipboard();

    const blob = new Blob([], { type: 'image/png' });

    await copyFileData(blob);

    expect(transformImage).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0][0].data).toEqual({ 'image/png': blob });
  });

  test('converts another image to PNG', async () => {
    stubClipboard();

    const blob = new Blob([], { type: 'image/jpeg' });
    const png = new Blob([], { type: 'image/png' });

    vi.mocked(transformImage).mockResolvedValue(png);

    await copyFileData(blob);

    expect(transformImage).toHaveBeenCalledWith(blob);
    expect(write.mock.calls[0][0][0].data).toEqual({ 'image/png': png });
  });

  test('throws for any other file', async () => {
    stubClipboard();

    await expect(copyFileData(new Blob([], { type: 'application/zip' }))).rejects.toThrow(
      'Unsupported type',
    );
    expect(writeText).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
