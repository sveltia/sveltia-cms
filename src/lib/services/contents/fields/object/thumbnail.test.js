import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getObjectThumbnail } from './thumbnail';

/**
 * @import { Asset } from '$lib/types/private';
 */

const { mockGetMediaFieldSource } = vi.hoisted(() => ({ mockGetMediaFieldSource: vi.fn() }));

vi.mock('$lib/services/assets/info', () => ({ getMediaFieldSource: mockGetMediaFieldSource }));

vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    current: {
      backend: { name: 'github' },
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          fields: [
            {
              name: 'hero',
              widget: 'object',
              fields: [
                { name: 'image', widget: 'image' },
                { name: 'file', widget: 'file' },
                { name: 'files', widget: 'file', multiple: true },
                { name: 'caption', widget: 'string' },
                {
                  name: 'mobile',
                  widget: 'object',
                  fields: [{ name: 'src', widget: 'file' }],
                },
              ],
            },
            {
              name: 'gallery',
              widget: 'list',
              fields: [{ name: 'image', widget: 'image' }],
            },
            {
              name: 'images',
              widget: 'list',
              field: { name: 'image', widget: 'image' },
            },
            {
              name: 'photos',
              widget: 'list',
              field: {
                name: 'photo',
                widget: 'object',
                fields: [
                  { name: 'src', widget: 'image' },
                  { name: 'alt', widget: 'string' },
                ],
              },
            },
            {
              name: 'sections',
              widget: 'list',
              types: [
                { name: 'banner', fields: [{ name: 'background', widget: 'image' }] },
                { name: 'text', fields: [{ name: 'body', widget: 'text' }] },
              ],
            },
          ],
        },
      ],
    },
  },
}));

/** @type {Asset} */
const imageAsset = /** @type {any} */ ({ name: 'photo.png', kind: 'image' });
/** @type {Asset} */
const videoAsset = /** @type {any} */ ({ name: 'clip.mp4', kind: 'video' });
/** @type {Asset} */
const pdfAsset = /** @type {any} */ ({ name: 'brochure.pdf', kind: 'document' });
/** @type {Asset} */
const docAsset = /** @type {any} */ ({ name: 'notes.docx', kind: 'document' });
const baseArgs = { collectionName: 'posts', keyPath: 'hero', typedKeyPath: 'hero' };

describe('getObjectThumbnail()', () => {
  beforeEach(() => {
    mockGetMediaFieldSource.mockImplementation(({ value }) => {
      if (/^(?:https?|data|blob):/.test(value)) {
        return { url: value };
      }

      const asset = [imageAsset, videoAsset, pdfAsset, docAsset].find(
        ({ name }) => value === `/uploads/${name}`,
      );

      return asset ? { asset } : undefined;
    });
  });

  test('returns nothing without the option', () => {
    expect(
      getObjectThumbnail({ ...baseArgs, valueMap: { 'hero.image': '/uploads/photo.png' } }),
    ).toBeUndefined();
    expect(mockGetMediaFieldSource).not.toHaveBeenCalled();
  });

  test('resolves the named Image subfield', () => {
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'image',
        valueMap: { 'hero.image': '/uploads/photo.png' },
      }),
    ).toEqual({ asset: imageAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith({
      value: '/uploads/photo.png',
      entry: undefined,
      collectionName: 'posts',
      fileName: undefined,
      componentName: undefined,
      fieldConfig: { name: 'image', widget: 'image' },
      typedKeyPath: 'hero.image',
    });
  });

  test('accepts the `fields.` prefix used in summary templates', () => {
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'fields.image',
        valueMap: { 'hero.image': '/uploads/photo.png' },
      }),
    ).toEqual({ asset: imageAsset });
  });

  test('passes the entry, file and component along for the asset lookup', () => {
    const entry = /** @type {any} */ ({ id: 'post' });

    getObjectThumbnail({
      ...baseArgs,
      thumbnailFieldName: 'image',
      valueMap: { 'hero.image': '/uploads/photo.png' },
      entry,
      fileName: undefined,
      componentName: undefined,
      isIndexFile: false,
    });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ entry }),
    );
  });

  test('accepts a File subfield holding an image, a video or a PDF', () => {
    /**
     * Resolve the thumbnail of the `file` subfield with the given value.
     * @param {string} value Value.
     * @returns {any} Thumbnail.
     */
    const resolve = (value) =>
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'file',
        valueMap: { 'hero.file': value },
      });

    expect(resolve('/uploads/photo.png')).toEqual({ asset: imageAsset });
    expect(resolve('/uploads/clip.mp4')).toEqual({ asset: videoAsset });
    expect(resolve('/uploads/brochure.pdf')).toEqual({ asset: pdfAsset });
    // A file of any other kind has no thumbnail
    expect(resolve('/uploads/notes.docx')).toBeUndefined();
    // An asset that isn’t found
    expect(resolve('/uploads/missing.png')).toBeUndefined();
  });

  test('accepts a file elsewhere only if it’s an image', () => {
    /**
     * Resolve the thumbnail of the `file` subfield with the given value.
     * @param {string} value Value.
     * @param {any} [files] Unsaved files.
     * @returns {any} Thumbnail.
     */
    const resolve = (value, files) =>
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'file',
        valueMap: { 'hero.file': value },
        files,
      });

    // An external file is shown as it is, so its extension has to be an image’s
    expect(resolve('https://example.com/photo.png?w=800')).toEqual({
      url: 'https://example.com/photo.png?w=800',
    });
    expect(resolve('https://images.unsplash.com/photo-123')).toEqual({
      url: 'https://images.unsplash.com/photo-123',
    });
    expect(resolve('https://example.com/clip.mp4')).toBeUndefined();
    expect(resolve('https://example.com/brochure.pdf')).toBeUndefined();
    expect(resolve('https://example.com/download')).toBeUndefined();
    expect(resolve('data:image/png;base64,iVBORw0KGgo=')).toEqual({
      url: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(resolve('data:application/pdf;base64,JVBERi0=')).toBeUndefined();

    // A file uploaded in the draft is held as a blob URL, and its type is known
    const files = {
      'blob:http://localhost/1': { file: new File([''], 'photo.png', { type: 'image/png' }) },
      'blob:http://localhost/2': { file: new File([''], 'clip.mp4', { type: 'video/mp4' }) },
    };

    expect(resolve('blob:http://localhost/1', files)).toEqual({ url: 'blob:http://localhost/1' });
    expect(resolve('blob:http://localhost/2', files)).toBeUndefined();
    expect(resolve('blob:http://localhost/3', files)).toBeUndefined();
    expect(resolve('blob:http://localhost/1')).toBeUndefined();
  });

  test('resolves a nested subfield', () => {
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'mobile.src',
        valueMap: { 'hero.mobile.src': '/uploads/photo.png' },
      }),
    ).toEqual({ asset: imageAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        value: '/uploads/photo.png',
        fieldConfig: { name: 'src', widget: 'file' },
        typedKeyPath: 'hero.mobile.src',
      }),
    );

    // The object itself isn’t a media field
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'mobile',
        valueMap: { 'hero.mobile.src': '/uploads/photo.png' },
      }),
    ).toBeUndefined();
  });

  test('previews a multiple File subfield with its first file', () => {
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'files',
        valueMap: { 'hero.files.0': '/uploads/clip.mp4', 'hero.files.1': '/uploads/photo.png' },
      }),
    ).toEqual({ asset: videoAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ value: '/uploads/clip.mp4', typedKeyPath: 'hero.files' }),
    );
  });

  test('returns nothing for an empty or missing value', () => {
    expect(
      getObjectThumbnail({ ...baseArgs, thumbnailFieldName: 'image', valueMap: {} }),
    ).toBeUndefined();
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'image',
        valueMap: { 'hero.image': '' },
      }),
    ).toBeUndefined();
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'files',
        valueMap: { 'hero.files': [] },
      }),
    ).toBeUndefined();
    expect(mockGetMediaFieldSource).not.toHaveBeenCalled();
  });

  test('returns nothing for a subfield that isn’t a media field or doesn’t exist', () => {
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'caption',
        valueMap: { 'hero.caption': '/uploads/photo.png' },
      }),
    ).toBeUndefined();
    expect(
      getObjectThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'photo',
        valueMap: { 'hero.photo': '/uploads/photo.png' },
      }),
    ).toBeUndefined();
    expect(mockGetMediaFieldSource).not.toHaveBeenCalled();
  });

  test('resolves the subfield of a list item', () => {
    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'image',
        keyPath: 'gallery.1',
        typedKeyPath: 'gallery.*',
        valueMap: { 'gallery.0.image': '', 'gallery.1.image': '/uploads/photo.png' },
      }),
    ).toEqual({ asset: imageAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ value: '/uploads/photo.png', typedKeyPath: 'gallery.*.image' }),
    );
  });

  test('resolves the subfield of a variable type list item', () => {
    const valueMap = {
      'sections.0.type': 'banner',
      'sections.0.background': '/uploads/photo.png',
      'sections.1.type': 'text',
      'sections.1.body': 'Hello',
    };

    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'background',
        keyPath: 'sections.0',
        typedKeyPath: 'sections.*<banner>',
        valueMap,
      }),
    ).toEqual({ asset: imageAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ typedKeyPath: 'sections.*<banner>.background' }),
    );

    // The option names a field of another type
    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'background',
        keyPath: 'sections.1',
        typedKeyPath: 'sections.*<text>',
        valueMap,
      }),
    ).toBeUndefined();
  });

  test('resolves the single subfield of a list item, stored at the item key path', () => {
    const valueMap = { 'images.0': '/uploads/photo.png' };

    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'image',
        keyPath: 'images.0',
        typedKeyPath: 'images.*',
        hasSingleSubField: true,
        valueMap,
      }),
    ).toEqual({ asset: imageAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ value: '/uploads/photo.png', typedKeyPath: 'images.*' }),
    );

    // The option has to name that subfield
    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'photo',
        keyPath: 'images.0',
        typedKeyPath: 'images.*',
        hasSingleSubField: true,
        valueMap,
      }),
    ).toBeUndefined();
  });

  test('resolves a field within the single object subfield of a list item', () => {
    const valueMap = { 'photos.0.src': '/uploads/photo.png', 'photos.0.alt': 'A photo' };

    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'photo.src',
        keyPath: 'photos.0',
        typedKeyPath: 'photos.*',
        hasSingleSubField: true,
        valueMap,
      }),
    ).toEqual({ asset: imageAsset });

    expect(mockGetMediaFieldSource).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ value: '/uploads/photo.png', typedKeyPath: 'photos.*.src' }),
    );

    // The object itself isn’t a media field
    expect(
      getObjectThumbnail({
        collectionName: 'posts',
        thumbnailFieldName: 'photo',
        keyPath: 'photos.0',
        typedKeyPath: 'photos.*',
        hasSingleSubField: true,
        valueMap,
      }),
    ).toBeUndefined();
  });
});
