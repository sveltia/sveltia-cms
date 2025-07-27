import { describe, expect, test, vi } from 'vitest';

import { getYouTubeEmbedURL, isYouTubeVideoURL } from './youtube';

// Mock the isURL utility
vi.mock('@sveltia/utils/string', () => ({
  isURL: vi.fn(),
}));

describe('isYouTubeVideoURL', () => {
  test('should return false for non-URL strings', async () => {
    const { isURL } = await import('@sveltia/utils/string');

    vi.mocked(isURL).mockReturnValue(false);

    expect(isYouTubeVideoURL('not-a-url')).toBe(false);
    expect(isURL).toHaveBeenCalledWith('not-a-url');
  });

  test('should return true for YouTube watch URLs', async () => {
    const { isURL } = await import('@sveltia/utils/string');

    vi.mocked(isURL).mockReturnValue(true);

    expect(isYouTubeVideoURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoURL('https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  test('should return true for YouTube playlist URLs', async () => {
    const { isURL } = await import('@sveltia/utils/string');

    vi.mocked(isURL).mockReturnValue(true);

    expect(
      isYouTubeVideoURL('https://www.youtube.com/playlist?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH'),
    ).toBe(true);
    expect(
      isYouTubeVideoURL(
        'https://www.youtube-nocookie.com/playlist?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH',
      ),
    ).toBe(true);
  });

  test('should return true for YouTube embed URLs', async () => {
    const { isURL } = await import('@sveltia/utils/string');

    vi.mocked(isURL).mockReturnValue(true);

    expect(isYouTubeVideoURL('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoURL('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true);
  });

  test('should return true for youtu.be URLs', async () => {
    const { isURL } = await import('@sveltia/utils/string');

    vi.mocked(isURL).mockReturnValue(true);

    expect(isYouTubeVideoURL('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoURL('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe(true);
  });

  test('should return false for invalid YouTube URLs', async () => {
    const { isURL } = await import('@sveltia/utils/string');

    vi.mocked(isURL).mockReturnValue(true);

    // Wrong domain
    expect(isYouTubeVideoURL('https://www.example.com/watch?v=dQw4w9WgXcQ')).toBe(false);

    // Missing video ID (but valid watch path)
    expect(isYouTubeVideoURL('https://www.youtube.com/watch')).toBe(false);

    // Wrong path
    expect(isYouTubeVideoURL('https://www.youtube.com/video?v=dQw4w9WgXcQ')).toBe(false);

    // Note: Empty youtu.be path will still return true due to the pathname check
    // The function checks `!!pathname` which is truthy for '/'
  });
});

describe('getYouTubeEmbedURL', () => {
  test('should convert watch URL to embed URL', () => {
    const result = getYouTubeEmbedURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    expect(result).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  test('should convert watch URL with playlist to embed URL', () => {
    const result = getYouTubeEmbedURL(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH',
    );

    expect(result).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH&listType=playlist',
    );
  });

  test('should convert watch URL with additional parameters', () => {
    const result = getYouTubeEmbedURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s');

    expect(result).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  test('should handle playlist URLs', () => {
    const result = getYouTubeEmbedURL(
      'https://www.youtube.com/playlist?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH',
    );

    expect(result).toBe(
      'https://www.youtube-nocookie.com/embed/videoseries?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH',
    );
  });

  test('should handle youtu.be URLs', () => {
    const result = getYouTubeEmbedURL('https://youtu.be/dQw4w9WgXcQ');

    expect(result).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  test('should handle embed URLs', () => {
    const result = getYouTubeEmbedURL('https://www.youtube.com/embed/dQw4w9WgXcQ');

    expect(result).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});
