import mime from 'mime';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MEDIA_KINDS,
  ASSET_KINDS,
  DOC_EXTENSION_REGEX,
  isMediaKind,
  canPreviewAsset,
  getMediaKind,
  getAssetKind,
} from './kinds';

// Mock dependencies
vi.mock('mime');
vi.mock('@sveltia/utils/file', () => ({
  isTextFileType: vi.fn(),
}));

describe('assets/kinds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      // eslint-disable-next-line object-shorthand
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
  });

  describe('getAssetKind', () => {
    beforeEach(() => {
      vi.mocked(mime.getType).mockClear();
    });

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
});
