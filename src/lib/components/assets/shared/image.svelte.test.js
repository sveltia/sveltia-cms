import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import Image from './image.svelte';

describe('Image', () => {
  test('shows an image from a URL', async () => {
    const { container } = await render(Image, {
      src: 'https://example.com/photo.png',
      alt: 'Photo',
      variant: 'tile',
      cover: true,
    });

    const img = container.querySelector('img');

    expect(img).toHaveAttribute('src', 'https://example.com/photo.png');
    expect(img).toHaveAttribute('alt', 'Photo');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(container.querySelector('.preview')).toHaveClass('tile', 'cover');
  });
});
