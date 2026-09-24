import mime from 'mime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ASSET_KINDS,
  canCreateThumbnail,
  canEditAsset,
  canPreviewAsset,
  DOC_EXTENSION_REGEX,
  getAssetKind,
  getMediaKind,
  getMediaKindFromPath,
  getMediaKindFromType,
  hasPDFThumbnail,
  isMediaKind,
  MEDIA_KINDS,
} from './kinds';

// Mock dependencies
vi.mock('mime', () => ({
  default: {
    getType: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@sveltia/utils/file', () => ({
  isTextFileType: vi.fn(),
}));

describe('assets/kinds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mime.getType to default null return
    vi.mocked(mime.getType).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constants', () => {
    it('should define MEDIA_KINDS correctly', () => {
      expect(MEDIA_KINDS).toEqual(['image', 'video', 'audio']);
    });

    it('should define ASSET_KINDS correctly', () => {
      expect(ASSET_KINDS).toEqual(['image', 'video', 'audio', 'document', 'other']);
    });

    it('should define DOC_EXTENSION_REGEX correctly', () => {
      expect(DOC_EXTENSION_REGEX.test('.pdf')).toBe(true);
      expect(DOC_EXTENSION_REGEX.test('.docx')).toBe(true);
      expect(DOC_EXTENSION_REGEX.test('.csv')).toBe(true);
      expect(DOC_EXTENSION_REGEX.test('.xlsx')).toBe(true);
      expect(DOC_EXTENSION_REGEX.test('.txt')).toBe(false);
      expect(DOC_EXTENSION_REGEX.test('.jpg')).toBe(false);
    });
  });

  describe('canCreateThumbnail', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should create a thumbnail for an image, a video or a PDF document', () => {
      expect(canCreateThumbnail(/** @type {any} */ ({ name: 'a.jpg', kind: 'image' }))).toBe(true);
      expect(canCreateThumbnail(/** @type {any} */ ({ name: 'a.mp4', kind: 'video' }))).toBe(true);
      expect(canCreateThumbnail(/** @type {any} */ ({ name: 'a.pdf', kind: 'document' }))).toBe(
        true,
      );
    });

    it('should not for any other file, or a PDF document in the npm build', () => {
      expect(canCreateThumbnail(/** @type {any} */ ({ name: 'a.mp3', kind: 'audio' }))).toBe(false);
      expect(canCreateThumbnail(/** @type {any} */ ({ name: 'a.docx', kind: 'document' }))).toBe(
        false,
      );

      vi.stubEnv('NPM_BUILD', 'true');

      expect(canCreateThumbnail(/** @type {any} */ ({ name: 'a.pdf', kind: 'document' }))).toBe(
        false,
      );
    });
  });

  describe('hasPDFThumbnail', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should generate a thumbnail for a PDF document', () => {
      expect(hasPDFThumbnail('files/brochure.pdf')).toBe(true);
      expect(hasPDFThumbnail('files/brochure.docx')).toBe(false);
    });

    it('should not in the npm build, which doesn’t include PDF.js', () => {
      vi.stubEnv('NPM_BUILD', 'true');

      expect(hasPDFThumbnail('files/brochure.pdf')).toBe(false);
    });
  });

  describe('isMediaKind', () => {
    it('should return true for media kinds', () => {
      expect(isMediaKind('image')).toBe(true);
      expect(isMediaKind('video')).toBe(true);
      expect(isMediaKind('audio')).toBe(true);
    });

    it('should return false for non-media kinds', () => {
      expect(isMediaKind('document')).toBe(false);
      expect(isMediaKind('other')).toBe(false);
      expect(isMediaKind('unknown')).toBe(false);
    });
  });

  describe('canPreviewAsset', () => {
    let isTextFileTypeMock;

    beforeEach(async () => {
      const { isTextFileType } = await import('@sveltia/utils/file');

      isTextFileTypeMock = vi.mocked(isTextFileType);
      isTextFileTypeMock.mockImplementation(
        (type) => type?.startsWith('text/') || type === 'application/json',
      );
    });

    /**
     * Create a mock asset for testing.
     * @param {string} path Asset path.
     * @param {string} kind Asset kind.
     * @returns {import('$lib/types/private').Asset} Mock asset.
     */
    const createMockAsset = (path, kind) => ({
      path,
      kind: /** @type {import('$lib/types/private').AssetKind} */ (kind),
      name: path.split('/').pop() || '',
      sha: 'abc123',
      size: 1024,
      folder: {
        internalPath: 'test',
        publicPath: 'test',
        collectionName: 'test',
        entryRelative: false,
        hasTemplateTags: false,
      },
    });

    it('should return true for media assets', () => {
      const asset = createMockAsset('image.jpg', 'image');

      vi.mocked(mime.getType).mockReturnValue('image/jpeg');

      expect(canPreviewAsset(asset)).toBe(true);
    });

    it('should return true for PDF files', () => {
      const asset = createMockAsset('document.pdf', 'document');

      vi.mocked(mime.getType).mockReturnValue('application/pdf');

      expect(canPreviewAsset(asset)).toBe(true);
    });

    it('should return true for text files', () => {
      const asset = createMockAsset('file.txt', 'other');

      vi.mocked(mime.getType).mockReturnValue('text/plain');

      expect(canPreviewAsset(asset)).toBe(true);
    });

    it('should return false for non-previewable files', () => {
      const asset = createMockAsset('file.exe', 'other');

      vi.mocked(mime.getType).mockReturnValue('application/octet-stream');

      expect(canPreviewAsset(asset)).toBe(false);
    });

    it('should return false when mime type is null', () => {
      const asset = createMockAsset('unknown', 'other');

      vi.mocked(mime.getType).mockReturnValue(null);

      expect(canPreviewAsset(asset)).toBe(false);
    });
  });

  describe('getMediaKind', () => {
    it('should return "image" for image files', async () => {
      const mockBlob = new Blob([''], { type: 'image/jpeg' });
      const result = await getMediaKind(mockBlob);

      expect(result).toBe('image');
    });

    it('should return "video" for video files', async () => {
      const mockBlob = new Blob([''], { type: 'video/mp4' });
      const result = await getMediaKind(mockBlob);

      expect(result).toBe('video');
    });

    it('should return "audio" for audio files', async () => {
      const mockBlob = new Blob([''], { type: 'audio/mp3' });
      const result = await getMediaKind(mockBlob);

      expect(result).toBe('audio');
    });

    it('should return undefined for non-media files', async () => {
      const mockBlob = new Blob([''], { type: 'text/plain' });
      const result = await getMediaKind(mockBlob);

      expect(result).toBe(undefined);
    });

    it('should handle file paths', async () => {
      vi.mocked(mime.getType).mockReturnValue('image/png');

      const result = await getMediaKind('path/to/image.png');

      expect(result).toBe('image');
    });

    it('should handle blob URLs successfully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(
          /** @type {Response} */ (
            /** @type {unknown} */ ({
              /**
               * Mock blob method.
               * @returns {Promise<Blob>} Blob.
               */
              blob: () => Promise.resolve(new Blob([''], { type: 'image/jpeg' })),
            })
          ),
        ),
      );

      const result = await getMediaKind('blob:http://example.com/blob-id');

      expect(result).toBe('image');
    });

    it('should handle blob URL fetch errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Fetch failed')));

      const result = await getMediaKind('blob:http://example.com/blob-id');

      expect(result).toBe(undefined);
    });

    it('should handle URLs with image CDN hostname', async () => {
      const result = await getMediaKind('https://images.unsplash.com/photo-123?w=800');

      expect(result).toBe('image');
    });

    it('should handle URLs and extract pathname', async () => {
      vi.mocked(mime.getType).mockReturnValue('video/mp4');

      const result = await getMediaKind('https://example.com/videos/movie.mp4?token=abc');

      expect(result).toBe('video');
      expect(mime.getType).toHaveBeenCalledWith('/videos/movie.mp4');
    });

    it('should return undefined for x- subtypes', async () => {
      const mockBlob = new Blob([''], { type: 'image/x-custom' });
      const result = await getMediaKind(mockBlob);

      expect(result).toBe(undefined);
    });

    it('should handle video with x- subtype', async () => {
      const mockBlob = new Blob([''], { type: 'video/x-msvideo' });
      const result = await getMediaKind(mockBlob);

      expect(result).toBe(undefined);
    });

    it('should return undefined when mimeType is empty', async () => {
      vi.mocked(mime.getType).mockReturnValue(null);

      const result = await getMediaKind('unknown.file');

      expect(result).toBe(undefined);
    });

    it('should handle local file paths with mime type', async () => {
      vi.mocked(mime.getType).mockReturnValue('audio/wav');

      const result = await getMediaKind('sound.wav');

      expect(result).toBe('audio');
      expect(mime.getType).toHaveBeenCalledWith('sound.wav');
    });

    it('should return undefined for local file path with null mime type', async () => {
      vi.mocked(mime.getType).mockReturnValue(null);

      const result = await getMediaKind('local-file.unknown');

      expect(result).toBe(undefined);
      expect(mime.getType).toHaveBeenCalledWith('local-file.unknown');
    });

    it('should return undefined when source is neither string nor Blob', async () => {
      // @ts-ignore
      const result = await getMediaKind({} /* invalid source type */);

      expect(result).toBe(undefined);
    });
  });

  describe('getMediaKindFromType', () => {
    it('should map a MIME type to a media kind', () => {
      expect(getMediaKindFromType('image/png')).toBe('image');
      expect(getMediaKindFromType('video/mp4')).toBe('video');
      expect(getMediaKindFromType('audio/mpeg')).toBe('audio');
      expect(getMediaKindFromType('application/pdf')).toBe(undefined);
      expect(getMediaKindFromType('image/x-custom')).toBe(undefined);
      expect(getMediaKindFromType('')).toBe(undefined);
    });
  });

  describe('getMediaKindFromPath', () => {
    it('should read the MIME type of a data URL', () => {
      expect(getMediaKindFromPath('data:image/png;base64,iVBORw0KGgo=')).toBe('image');
      expect(getMediaKindFromPath('data:application/pdf;base64,JVBERi0=')).toBe(undefined);
      expect(mime.getType).not.toHaveBeenCalled();
    });

    it('should use the extension of a path or URL', () => {
      vi.mocked(mime.getType).mockReturnValue('image/jpeg');

      expect(getMediaKindFromPath('https://example.com/photos/a.jpg?w=1')).toBe('image');
      expect(mime.getType).toHaveBeenCalledWith('/photos/a.jpg');
      expect(getMediaKindFromPath('a.jpg')).toBe('image');
      expect(mime.getType).toHaveBeenCalledWith('a.jpg');
      expect(getMediaKindFromPath('https://images.example.com/a')).toBe('image');
    });
  });

  describe('getAssetKind', () => {
    it('should return "image" for image files', () => {
      vi.mocked(mime.getType).mockReturnValue('image/jpeg');
      expect(getAssetKind('photo.jpg')).toBe('image');
    });

    it('should return "video" for video files', () => {
      vi.mocked(mime.getType).mockReturnValue('video/mp4');
      expect(getAssetKind('movie.mp4')).toBe('video');
    });

    it('should return "audio" for audio files', () => {
      vi.mocked(mime.getType).mockReturnValue('audio/mp3');
      expect(getAssetKind('song.mp3')).toBe('audio');
    });

    it('should return "document" for document files', () => {
      expect(getAssetKind('document.pdf')).toBe('document');
      expect(getAssetKind('spreadsheet.xlsx')).toBe('document');
      expect(getAssetKind('presentation.pptx')).toBe('document');
    });

    it('should return "other" for unknown files', () => {
      vi.mocked(mime.getType).mockReturnValue('application/octet-stream');
      expect(getAssetKind('unknown.bin')).toBe('other');
    });

    it('should return "other" when mime type is null', () => {
      vi.mocked(mime.getType).mockReturnValue(null);
      expect(getAssetKind('unknown')).toBe('other');
    });
  });

  describe('canEditAsset', () => {
    let isTextFileTypeMock;

    beforeEach(async () => {
      const { isTextFileType } = await import('@sveltia/utils/file');

      isTextFileTypeMock = vi.mocked(isTextFileType);
      isTextFileTypeMock.mockImplementation(
        (type) => type?.startsWith('text/') || type === 'application/json',
      );
    });

    /**
     * Create a mock asset for testing.
     * @param {string} path Asset path.
     * @param {string} kind Asset kind.
     * @returns {import('$lib/types/private').Asset} Mock asset.
     */
    const createMockAsset = (path, kind) => ({
      path,
      kind: /** @type {import('$lib/types/private').AssetKind} */ (kind),
      name: path.split('/').pop() || '',
      sha: 'abc123',
      size: 1024,
      folder: {
        internalPath: 'test',
        publicPath: 'test',
        collectionName: 'test',
        entryRelative: false,
        hasTemplateTags: false,
      },
    });

    it('should return true for text files', () => {
      const asset = createMockAsset('file.txt', 'other');

      vi.mocked(mime.getType).mockReturnValue('text/plain');

      expect(canEditAsset(asset)).toBe(true);
    });

    it('should return true for JSON files', () => {
      const asset = createMockAsset('config.json', 'other');

      vi.mocked(mime.getType).mockReturnValue('application/json');

      expect(canEditAsset(asset)).toBe(true);
    });

    it('should return false for image files', () => {
      const asset = createMockAsset('image.jpg', 'image');

      vi.mocked(mime.getType).mockReturnValue('image/jpeg');

      expect(canEditAsset(asset)).toBe(false);
    });

    it('should return false for binary files', () => {
      const asset = createMockAsset('file.exe', 'other');

      vi.mocked(mime.getType).mockReturnValue('application/octet-stream');

      expect(canEditAsset(asset)).toBe(false);
    });

    it('should return false when mime type is null', () => {
      const asset = createMockAsset('unknown', 'other');

      vi.mocked(mime.getType).mockReturnValue(null);

      expect(canEditAsset(asset)).toBe(false);
    });
  });
});
