import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMediaKind } from '$lib/services/assets/kinds';
import { getMediaFieldURL } from '$lib/services/assets/media-field';

import { getMediaFieldPreview } from './preview';

vi.mock('$lib/services/assets/kinds', () => ({
  getMediaKind: vi.fn(),
}));
vi.mock('$lib/services/assets/media-field', () => ({
  getMediaFieldURL: vi.fn(),
}));

describe('contents/fields/file/preview', () => {
  describe('getMediaFieldPreview()', () => {
    beforeEach(() => {
      vi.mocked(getMediaFieldURL).mockResolvedValue('blob:http://localhost/1');
    });

    it('should determine the kind from the value and get the URL', async () => {
      vi.mocked(getMediaKind).mockResolvedValue('video');

      const result = await getMediaFieldPreview({
        value: '/uploads/movie.mp4',
        collectionName: 'posts',
        thumbnail: true,
      });

      expect(result).toEqual({ kind: 'video', src: 'blob:http://localhost/1' });
      expect(getMediaKind).toHaveBeenCalledWith('/uploads/movie.mp4');
      // The known kind is not passed on, and the other arguments are
      expect(getMediaFieldURL).toHaveBeenCalledWith({
        value: '/uploads/movie.mp4',
        collectionName: 'posts',
        thumbnail: true,
      });
    });

    it('should use the given kind without determining it', async () => {
      const result = await getMediaFieldPreview({
        value: '/uploads/photo',
        kind: 'image',
        collectionName: 'posts',
      });

      expect(result).toEqual({ kind: 'image', src: 'blob:http://localhost/1' });
      expect(getMediaKind).not.toHaveBeenCalled();
      expect(getMediaFieldURL).toHaveBeenCalledWith({
        value: '/uploads/photo',
        collectionName: 'posts',
      });
    });

    it('should not get the URL of a value that is not a media file', async () => {
      vi.mocked(getMediaKind).mockResolvedValue(undefined);

      const result = await getMediaFieldPreview({
        value: '/uploads/document.pdf',
        collectionName: 'posts',
      });

      expect(result).toEqual({ kind: undefined, src: undefined });
      expect(getMediaFieldURL).not.toHaveBeenCalled();
    });
  });
});
