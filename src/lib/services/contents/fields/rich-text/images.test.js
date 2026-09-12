// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getDroppedImages,
  getPastedImages,
  getTimestampFileName,
} from '$lib/services/contents/fields/rich-text/images';

vi.mock('@sveltia/utils/datetime', () => ({
  getDateTimeParts: vi.fn(() => ({
    year: '2026',
    month: '09',
    day: '12',
    hour: '10',
    minute: '30',
    second: '00',
  })),
}));

/**
 * Build a fake `DataTransferItem`.
 * @param {object} args Arguments.
 * @param {'file' | 'string'} args.kind Item kind.
 * @param {string} args.type MIME type.
 * @param {File | null} [args.file] File returned by `getAsFile()`.
 * @param {string} [args.string] String passed to the `getAsString()` callback.
 * @returns {DataTransferItem} Item.
 */
const createItem = ({ kind, type, file = null, string = '' }) =>
  /** @type {any} */ ({
    kind,
    type,
    /**
     * Get the file.
     * @returns {File | null} File.
     */
    getAsFile: () => file,
    /**
     * Pass the string to the callback.
     * @param {(str: string) => void} callback Callback.
     */
    getAsString: (callback) => {
      callback(string);
    },
  });

/**
 * Build a fake `paste` event.
 * @param {object} args Arguments.
 * @param {DataTransferItem[]} [args.items] Clipboard items.
 * @param {File[]} [args.files] Clipboard files.
 * @param {boolean} [args.withClipboardData] Whether to attach `clipboardData` at all.
 * @returns {ClipboardEvent & { clipboardData: any }} Event.
 */
const createPasteEvent = ({ items = [], files = [], withClipboardData = true } = {}) => {
  const itemList = /** @type {any} */ ([...items]);

  itemList.clear = vi.fn();

  return /** @type {any} */ ({
    clipboardData: withClipboardData ? { items: itemList, files } : null,
    stopPropagation: vi.fn(),
  });
};

/**
 * Build a fake `drop` event.
 * @param {object} args Arguments.
 * @param {File[]} [args.files] Dropped files.
 * @param {string} [args.html] HTML data.
 * @param {boolean} [args.withDataTransfer] Whether to attach `dataTransfer` at all.
 * @returns {DragEvent} Event.
 */
const createDropEvent = ({ files = [], html = '', withDataTransfer = true } = {}) =>
  /** @type {any} */ ({
    dataTransfer: withDataTransfer
      ? {
          files,
          /**
           * Get the data of the given type.
           * @param {string} type MIME type.
           * @returns {string} Data.
           */
          getData: (type) => (type === 'text/html' ? html : ''),
        }
      : null,
  });

const png = new File(['png'], 'photo.png', { type: 'image/png' });
const jpeg = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
const text = new File(['text'], 'notes.txt', { type: 'text/plain' });

describe('getTimestampFileName()', () => {
  test('formats the current date and time', () => {
    expect(getTimestampFileName('png')).toBe('20260912-103000.png');
    expect(getTimestampFileName('webp', '-2')).toBe('20260912-103000-2.webp');
  });
});

describe('getPastedImages()', () => {
  test('returns nothing without clipboard data', async () => {
    expect(await getPastedImages(createPasteEvent({ withClipboardData: false }))).toEqual([]);
  });

  test('returns nothing when no image is pasted', async () => {
    const event = createPasteEvent({
      items: [createItem({ kind: 'string', type: 'text/plain', string: 'hello' })],
      files: [text],
    });

    expect(await getPastedImages(event)).toEqual([]);
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  test('returns local image files as they are', async () => {
    const event = createPasteEvent({
      items: [
        createItem({ kind: 'file', type: 'image/png', file: png }),
        createItem({ kind: 'file', type: 'image/jpeg', file: jpeg }),
        createItem({ kind: 'file', type: 'text/plain', file: text }),
      ],
      files: [png, jpeg, text],
    });

    const images = await getPastedImages(event);

    expect(images).toEqual([
      { file: png, alt: undefined },
      { file: jpeg, alt: undefined },
    ]);
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  test('renames generically named local files after the date, numbering multiple ones', async () => {
    const generic1 = new File(['1'], 'image.png', { type: 'image/png' });
    const generic2 = new File(['2'], 'image.png', { type: 'image/png' });
    const single = await getPastedImages(createPasteEvent({ files: [generic1] }));

    expect(single.map(({ file }) => file?.name)).toEqual(['20260912-103000.png']);

    const multiple = await getPastedImages(createPasteEvent({ files: [generic1, png, generic2] }));

    expect(multiple.map(({ file }) => file?.name)).toEqual([
      '20260912-103000-1.png',
      'photo.png',
      '20260912-103000-3.png',
    ]);
  });

  test('scrapes the name and alt text of a remote image from the HTML and stops the event', async () => {
    const file = new File(['png'], 'image.png', { type: 'image/png' });

    const event = createPasteEvent({
      items: [
        createItem({ kind: 'file', type: 'image/png', file }),
        createItem({
          kind: 'string',
          type: 'text/html',
          string: '<img src="https://example.com/images/cat.jpg?size=large" alt="A cat">',
        }),
      ],
    });

    const images = await getPastedImages(event);

    expect(images).toHaveLength(1);
    expect(images[0].file?.name).toBe('cat.jpg');
    expect(images[0].file?.type).toBe('image/png');
    expect(images[0].alt).toBe('A cat');
    expect(event.clipboardData.items.clear).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  test('keeps the original name when the remote image has no recognizable extension', async () => {
    const event = createPasteEvent({
      items: [
        createItem({ kind: 'file', type: 'image/png', file: png }),
        createItem({
          kind: 'string',
          type: 'text/html',
          string: '<img src="https://example.com/images/12345" alt="">',
        }),
      ],
    });

    const images = await getPastedImages(event);

    expect(images[0].file?.name).toBe('photo.png');
    expect(images[0].alt).toBe('');
  });

  test('renames a generically named remote image after the date', async () => {
    const file = new File(['png'], 'image.png', { type: 'image/png' });

    const event = createPasteEvent({
      items: [
        createItem({ kind: 'file', type: 'image/png', file }),
        createItem({
          kind: 'string',
          type: 'text/html',
          string: '<img src="blob:https://example.com/abc" alt="Blob">',
        }),
      ],
    });

    const images = await getPastedImages(event);

    expect(images[0].file?.name).toBe('20260912-103000.png');
    expect(images[0].alt).toBe('Blob');
  });

  test('uses the file alone when the HTML holds no image', async () => {
    const event = createPasteEvent({
      items: [
        createItem({ kind: 'file', type: 'image/png', file: png }),
        createItem({ kind: 'string', type: 'text/html', string: '<p>No image here</p>' }),
      ],
    });

    const images = await getPastedImages(event);

    expect(images).toHaveLength(1);
    expect(images[0].file?.name).toBe('photo.png');
    expect(images[0].alt).toBe('');
  });

  test('returns nothing when the file item can’t be read', async () => {
    const event = createPasteEvent({
      items: [
        createItem({ kind: 'file', type: 'image/png', file: null }),
        createItem({ kind: 'string', type: 'text/html', string: '<img src="x.png">' }),
      ],
    });

    expect(await getPastedImages(event)).toEqual([]);
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});

describe('getDroppedImages()', () => {
  /** @type {import('vitest').Mock} */
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('returns nothing without a data transfer', async () => {
    expect(await getDroppedImages(createDropEvent({ withDataTransfer: false }))).toEqual([]);
  });

  test('returns local image files as they are', async () => {
    const images = await getDroppedImages(createDropEvent({ files: [png, text, jpeg] }));

    expect(images).toEqual([{ file: png }, { file: jpeg }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns nothing when neither files nor HTML is dropped', async () => {
    expect(await getDroppedImages(createDropEvent())).toEqual([]);
  });

  test('returns nothing when the dropped HTML holds no image', async () => {
    expect(await getDroppedImages(createDropEvent({ html: '<p>Text</p>' }))).toEqual([]);
  });

  test('links a remote image by its URL without downloading it', async () => {
    const images = await getDroppedImages(
      createDropEvent({ html: '<img src="https://example.com/cat.jpg" alt="A cat">' }),
    );

    expect(images).toEqual([{ file: undefined, src: 'https://example.com/cat.jpg', alt: 'A cat' }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('downloads a data URL image as a file named after the date', async () => {
    const src = 'data:image/webp;base64,AAAA';
    const blob = new Blob(['webp'], { type: 'image/webp' });

    fetchMock.mockResolvedValue({
      /**
       * Get the body as a blob.
       * @returns {Promise<Blob>} Blob.
       */
      blob: () => Promise.resolve(blob),
    });

    const images = await getDroppedImages(createDropEvent({ html: `<img src="${src}" alt="">` }));

    expect(fetchMock).toHaveBeenCalledWith(src);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(src);
    expect(images[0].alt).toBe('');
    expect(images[0].file?.name).toBe('20260912-103000.webp');
    expect(images[0].file?.type).toBe('image/webp');
  });

  test('links a data URL of an unsupported type without downloading it', async () => {
    const src = 'data:image/x-icon;base64,AAAA';
    const images = await getDroppedImages(createDropEvent({ html: `<img src="${src}">` }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(images).toEqual([{ file: undefined, src, alt: '' }]);
  });

  test('returns nothing when the data URL can’t be read', async () => {
    fetchMock.mockRejectedValue(new Error('Failed'));

    const images = await getDroppedImages(
      createDropEvent({ html: '<img src="data:image/png;base64,AAAA">' }),
    );

    expect(images).toEqual([]);
  });
});
