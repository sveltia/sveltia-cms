import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processFile } from './process';

vi.mock('$lib/services/integrations/media-libraries/default');
vi.mock('$lib/services/utils/file');

describe('assets/process', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { formatFileName } = await import('$lib/services/utils/file');

    vi.mocked(formatFileName).mockImplementation((name) => name.toLowerCase().replace(/\s+/g, '-'));

    const { transformFile } = await import('$lib/services/integrations/media-libraries/default');

    // Default: return the original file unchanged
    vi.mocked(transformFile).mockImplementation(async (file) => file);
  });

  describe('processFile', () => {
    it('should return the original file unchanged with no options', async () => {
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await processFile(file);

      expect(result.file).toBe(file);
      expect(result.originalFile).toBeUndefined();
      expect(result.oversized).toBe(false);
    });

    it('should return the original file unchanged with empty options', async () => {
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await processFile(file, {});

      expect(result.file).toBe(file);
      expect(result.originalFile).toBeUndefined();
      expect(result.oversized).toBe(false);
    });

    it('should slugify the filename when slugify_filename is true', async () => {
      const { formatFileName } = await import('$lib/services/utils/file');

      vi.mocked(formatFileName).mockReturnValue('hello-world.jpg');

      const file = new File(['content'], 'Hello World.jpg', { type: 'image/jpeg' });
      const result = await processFile(file, { slugify_filename: true });

      expect(vi.mocked(formatFileName)).toHaveBeenCalledWith('Hello World.jpg', {
        slugificationEnabled: true,
      });
      expect(result.file.name).toBe('hello-world.jpg');
      expect(result.file).not.toBe(file);
      expect(result.originalFile).toBeUndefined();
      expect(result.oversized).toBe(false);
    });

    it('should preserve file type and lastModified when slugifying', async () => {
      const { formatFileName } = await import('$lib/services/utils/file');

      vi.mocked(formatFileName).mockReturnValue('my-file.png');

      const lastModified = 1700000000000;
      const file = new File(['content'], 'My File.png', { type: 'image/png', lastModified });
      const result = await processFile(file, { slugify_filename: true });

      expect(result.file.type).toBe('image/png');
      expect(result.file.lastModified).toBe(lastModified);
      expect(result.file.name).toBe('my-file.png');
    });

    it('should not slugify the filename when slugify_filename is false', async () => {
      const { formatFileName } = await import('$lib/services/utils/file');
      const file = new File(['content'], 'Hello World.jpg', { type: 'image/jpeg' });
      const result = await processFile(file, { slugify_filename: false });

      expect(vi.mocked(formatFileName)).not.toHaveBeenCalled();
      expect(result.file).toBe(file);
    });

    it('should apply transformations when provided', async () => {
      const { transformFile } = await import('$lib/services/integrations/media-libraries/default');
      const originalFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['transformed'], 'photo.webp', { type: 'image/webp' });
      const transformations = /** @type {any} */ ({ webp: { quality: 80 } });

      vi.mocked(transformFile).mockResolvedValue(transformedFile);

      const result = await processFile(originalFile, { transformations });

      expect(vi.mocked(transformFile)).toHaveBeenCalledWith(originalFile, transformations);
      expect(result.file).toBe(transformedFile);
      expect(result.originalFile).toBe(originalFile);
      expect(result.oversized).toBe(false);
    });

    it('should set originalFile to undefined when transformation returns the same file', async () => {
      const { transformFile } = await import('$lib/services/integrations/media-libraries/default');
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const transformations = /** @type {any} */ ({ jpeg: { quality: 90 } });

      // Transform returns same file instance (no actual transformation)
      vi.mocked(transformFile).mockResolvedValue(file);

      const result = await processFile(file, { transformations });

      expect(result.file).toBe(file);
      expect(result.originalFile).toBeUndefined();
    });

    it('should not call transformFile when transformations is undefined', async () => {
      const { transformFile } = await import('$lib/services/integrations/media-libraries/default');
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await processFile(file, { transformations: undefined });

      expect(vi.mocked(transformFile)).not.toHaveBeenCalled();
      expect(result.file).toBe(file);
    });

    it('should mark file as oversized when size exceeds max_file_size', async () => {
      const file = new File(['content'], 'large.jpg', { type: 'image/jpeg' });

      Object.defineProperty(file, 'size', { value: 5000000 });

      const result = await processFile(file, { max_file_size: 1000000 });

      expect(result.oversized).toBe(true);
      expect(result.file).toBe(file);
    });

    it('should not mark file as oversized when size equals max_file_size', async () => {
      const file = new File(['content'], 'exact.jpg', { type: 'image/jpeg' });

      Object.defineProperty(file, 'size', { value: 1000000 });

      const result = await processFile(file, { max_file_size: 1000000 });

      expect(result.oversized).toBe(false);
    });

    it('should not mark file as oversized when size is below max_file_size', async () => {
      const file = new File(['content'], 'small.jpg', { type: 'image/jpeg' });

      Object.defineProperty(file, 'size', { value: 999999 });

      const result = await processFile(file, { max_file_size: 1000000 });

      expect(result.oversized).toBe(false);
    });

    it('should check oversized against transformed file size, not original', async () => {
      const { transformFile } = await import('$lib/services/integrations/media-libraries/default');
      const originalFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['t'], 'photo.webp', { type: 'image/webp' });
      const transformations = /** @type {any} */ ({ jpeg: { format: 'webp' } });

      Object.defineProperty(originalFile, 'size', { value: 2000000 });
      Object.defineProperty(transformedFile, 'size', { value: 500000 });

      vi.mocked(transformFile).mockResolvedValue(transformedFile);

      const result = await processFile(originalFile, { transformations, max_file_size: 1000000 });

      expect(result.file).toBe(transformedFile);
      expect(result.oversized).toBe(false);
    });

    it('should slugify before transforming', async () => {
      const { formatFileName } = await import('$lib/services/utils/file');
      const { transformFile } = await import('$lib/services/integrations/media-libraries/default');

      vi.mocked(formatFileName).mockReturnValue('my-photo.jpg');

      const originalFile = new File(['content'], 'My Photo.jpg', { type: 'image/jpeg' });
      const transformedFile = new File(['transformed'], 'my-photo.webp', { type: 'image/webp' });
      const transformations = /** @type {any} */ ({ jpeg: { format: 'webp' } });

      vi.mocked(transformFile).mockResolvedValue(transformedFile);

      const result = await processFile(originalFile, {
        slugify_filename: true,
        transformations,
      });

      // transformFile should receive the slugified file, not the original
      const slugifiedArg = vi.mocked(transformFile).mock.calls[0][0];

      expect(slugifiedArg.name).toBe('my-photo.jpg');
      expect(result.file).toBe(transformedFile);
      // originalFile is set to the pre-transform file (the slugified one, not the original)
      expect(result.originalFile?.name).toBe('my-photo.jpg');
    });

    it('should handle all options together with oversized transformed file', async () => {
      const { formatFileName } = await import('$lib/services/utils/file');
      const { transformFile } = await import('$lib/services/integrations/media-libraries/default');

      vi.mocked(formatFileName).mockReturnValue('big-file.jpg');

      const original = new File(['x'], 'Big File.jpg', { type: 'image/jpeg' });
      const transformed = new File(['xx'], 'big-file.webp', { type: 'image/webp' });
      const transformations = /** @type {any} */ ({ jpeg: { format: 'webp' } });

      Object.defineProperty(transformed, 'size', { value: 3000000 });

      vi.mocked(transformFile).mockResolvedValue(transformed);

      const result = await processFile(original, {
        slugify_filename: true,
        transformations,
        max_file_size: 1000000,
      });

      expect(result.file).toBe(transformed);
      expect(result.originalFile?.name).toBe('big-file.jpg');
      expect(result.oversized).toBe(true);
    });
  });
});
