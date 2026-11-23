import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import Video from './video.svelte';

describe('Video', () => {
  test('shows a video player from a URL', async () => {
    const { container } = await render(Video, {
      src: 'https://example.com/clip.mp4',
      controls: true,
    });

    const video = container.querySelector('video');

    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
  });

  test('shows a still without controls', async () => {
    const { container } = await render(Video, { src: 'https://example.com/clip.mp4' });

    expect(container.querySelector('video')).not.toHaveAttribute('controls');
  });
});
