import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { TEST_IMAGE_URL } from '$lib/test/config';

import Image from './image.svelte';

describe('Image', () => {
  test('shows an image from a URL', async () => {
    const { container } = await render(Image, {
      src: TEST_IMAGE_URL,
      alt: 'Photo',
      variant: 'tile',
      cover: true,
    });

    const img = container.querySelector('img');

    expect(img).toHaveAttribute('src', TEST_IMAGE_URL);
    expect(img).toHaveAttribute('alt', 'Photo');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(container.querySelector('.preview')).toHaveClass('tile', 'cover');
  });
});
