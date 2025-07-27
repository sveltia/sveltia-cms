import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseAssetFiles } from './parser';

// Mock dependencies
vi.mock('./kinds', () => ({
  getAssetKind: vi.fn(),
}));

describe('assets/parser', () => {
  /** @type {import('vitest').MockedFunction<typeof import('./kinds').getAssetKind>} */
  let getAssetKindMock;

  beforeEach(async () => {
    const { getAssetKind } = await import('./kinds');

    getAssetKindMock = vi.mocked(getAssetKind);
  });

  describe('parseAssetFiles', () => {
    it('should parse asset files correctly', () => {
      getAssetKindMock.mockReturnValue('image');

      const assetFiles = [
        {
          type: /** @type {const} */ ('asset'),
          file: new File([''], 'test.jpg'),
          path: 'images/test.jpg',
          name: 'test.jpg',
          sha: 'abc123',
          size: 1024,
          folder: {
            internalPath: 'images',
            publicPath: 'images',
            collectionName: 'test',
            entryRelative: false,
            hasTemplateTags: false,
          },
        },
        {
          type: /** @type {const} */ ('asset'),
          file: new File([''], 'doc.pdf'),
          path: 'docs/doc.pdf',
          name: 'doc.pdf',
          sha: 'def456',
          size: 2048,
          text: 'Sample text content',
          folder: {
            internalPath: 'docs',
            publicPath: 'docs',
            collectionName: 'test',
            entryRelative: false,
            hasTemplateTags: false,
          },
        },
      ];

      const result = parseAssetFiles(assetFiles);

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        file: assetFiles[0].file,
        blobURL: undefined,
        path: 'images/test.jpg',
        name: 'test.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        text: undefined,
        folder: assetFiles[0].folder,
      });

      expect(result[1]).toEqual({
        file: assetFiles[1].file,
        blobURL: undefined,
        path: 'docs/doc.pdf',
        name: 'doc.pdf',
        sha: 'def456',
        size: 2048,
        kind: 'image',
        text: 'Sample text content',
        folder: assetFiles[1].folder,
      });

      expect(getAssetKindMock).toHaveBeenCalledWith('images/test.jpg');
      expect(getAssetKindMock).toHaveBeenCalledWith('docs/doc.pdf');
    });

    it('should handle empty asset files array', () => {
      const result = parseAssetFiles([]);

      expect(result).toEqual([]);
    });

    it('should handle assets without text and meta', () => {
      getAssetKindMock.mockReturnValue('other');

      const assetFiles = [
        {
          type: /** @type {const} */ ('asset'),
          file: new File([''], 'simple.txt'),
          path: 'simple.txt',
          name: 'simple.txt',
          sha: 'xyz789',
          size: 512,
          folder: {
            internalPath: '',
            publicPath: '',
            collectionName: 'test',
            entryRelative: false,
            hasTemplateTags: false,
          },
        },
      ];

      const result = parseAssetFiles(assetFiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        file: assetFiles[0].file,
        blobURL: undefined,
        path: 'simple.txt',
        name: 'simple.txt',
        sha: 'xyz789',
        size: 512,
        kind: 'other',
        text: undefined,
        folder: assetFiles[0].folder,
      });
    });
  });
});
