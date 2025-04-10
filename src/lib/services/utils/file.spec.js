import { describe, expect, test } from 'vitest';
import { encodeFilePath } from '$lib/services/utils/file';

describe('Test encodeFilePath()', () => {
  test('Encode', () => {
    expect(encodeFilePath('/public/uploads/French Hotdog(1).jpg')).toEqual(
      '/public/uploads/French%20Hotdog%281%29.jpg',
    );
    expect(encodeFilePath('@assets/images/私の画像.jpg')).toEqual(
      '@assets/images/%E7%A7%81%E3%81%AE%E7%94%BB%E5%83%8F.jpg',
    );
  });
});
