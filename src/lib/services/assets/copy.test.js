// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createPendingFileAdder,
  getAssetFile,
  getFieldMediaSources,
  rewriteAssetReferences,
} from '$lib/services/assets/copy';

const { mockGetAssetBlob, mockGetRichTextMediaSources, mockReplaceRichTextMediaSources } =
  vi.hoisted(() => ({
    mockGetAssetBlob: vi.fn(),
    mockGetRichTextMediaSources: vi.fn(),
    mockReplaceRichTextMediaSources: vi.fn(),
  }));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: mockGetAssetBlob,
  createDisplayBlobURL: vi.fn(async (file) => `blob:${file.name}`),
}));

vi.mock('$lib/services/contents/fields/rich-text/previews/media-sources', () => ({
  getRichTextMediaSources: mockGetRichTextMediaSources,
  replaceRichTextMediaSources: mockReplaceRichTextMediaSources,
}));

const folder = { internalPath: 'static/uploads' };

describe('getAssetFile', () => {
  test('wraps the blob of the asset in a file with its name and type', async () => {
    mockGetAssetBlob.mockResolvedValue(new Blob(['abc'], { type: 'image/png' }));

    const file = await getAssetFile({ name: 'a.png' });

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('a.png');
    expect(file.type).toBe('image/png');
  });

  test('throws if the blob cannot be retrieved', async () => {
    mockGetAssetBlob.mockRejectedValue(new Error('failed'));

    await expect(getAssetFile({ name: 'a.png' })).rejects.toThrow('failed');
  });
});

describe('createPendingFileAdder', () => {
  test('adds a file once per key', async () => {
    const files = {};
    const add = createPendingFileAdder({ files });
    const getFile = vi.fn(async () => new File(['a'], 'a.png'));
    const [url1, url2] = await Promise.all([add('a', getFile, folder), add('a', getFile, folder)]);

    expect(url1).toBe('blob:a.png');
    expect(url2).toBe('blob:a.png');
    expect(getFile).toHaveBeenCalledTimes(1);
    expect(files['blob:a.png']).toMatchObject({ folder, replace: false });
  });

  test('returns nothing if there is no file', async () => {
    const files = {};
    const add = createPendingFileAdder({ files });

    expect(await add('a', async () => undefined, folder)).toBeUndefined();
    expect(files).toEqual({});
  });

  test('returns the existing blob URL if the file is already pending', async () => {
    const files = {};
    const findExisting = vi.fn(async () => 'blob:existing');
    const add = createPendingFileAdder({ files, findExisting });
    const file = new File(['a'], 'a.png');

    expect(await add('a', async () => file, folder)).toBe('blob:existing');
    expect(findExisting).toHaveBeenCalledWith(file, folder);
    expect(files).toEqual({});
  });

  test('adds the file if it is not pending yet', async () => {
    const files = {};
    const findExisting = vi.fn(async () => undefined);
    const add = createPendingFileAdder({ files, findExisting });

    expect(await add('a', async () => new File(['a'], 'a.png'), folder)).toBe('blob:a.png');
    expect(Object.keys(files)).toEqual(['blob:a.png']);
  });

  test('does not handle an error thrown while getting the file', async () => {
    const add = createPendingFileAdder({ files: {} });

    await expect(
      add(
        'a',
        async () => {
          throw new Error('failed');
        },
        folder,
      ),
    ).rejects.toThrow('failed');
  });
});

describe('getFieldMediaSources', () => {
  beforeEach(() => {
    mockGetRichTextMediaSources.mockReturnValue(['/a.png']);
  });

  test('returns the value itself for a File or Image field', () => {
    expect(getFieldMediaSources('a.png')).toEqual(['a.png']);
    expect(mockGetRichTextMediaSources).not.toHaveBeenCalled();
  });

  test('returns the media URLs in a Markdown or HTML body', () => {
    expect(getFieldMediaSources('![](/a.png)', 'markdown')).toEqual(['/a.png']);
    expect(mockGetRichTextMediaSources).toHaveBeenCalledWith('![](/a.png)', 'markdown');
  });
});

describe('rewriteAssetReferences', () => {
  beforeEach(() => {
    mockGetRichTextMediaSources.mockReturnValue(['/a.png', '/b.png']);
    mockReplaceRichTextMediaSources.mockReturnValue('replaced');
  });

  test('returns the new reference of a File or Image field value', async () => {
    expect(
      await rewriteAssetReferences({
        value: 'a.png',
        rewrite: vi.fn(async () => 'b.png'),
      }),
    ).toBe('b.png');
  });

  test('returns nothing for a File or Image field value that is not rewritten', async () => {
    expect(
      await rewriteAssetReferences({
        value: 'a.png',
        rewrite: vi.fn(async () => undefined),
      }),
    ).toBeUndefined();
  });

  test('replaces the media URLs in a Markdown or HTML body', async () => {
    const rewrite = vi.fn(async (src) => (src === '/a.png' ? 'blob:a' : undefined));

    expect(await rewriteAssetReferences({ value: 'body', format: 'html', rewrite })).toBe(
      'replaced',
    );
    expect(mockReplaceRichTextMediaSources).toHaveBeenCalledWith(
      'body',
      new Map([
        ['/a.png', 'blob:a'],
        ['/b.png', undefined],
      ]),
      'html',
    );
  });
});
