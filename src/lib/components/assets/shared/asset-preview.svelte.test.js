import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { createMockAsset } from '$lib/test/config';

import AssetPreview from './asset-preview.svelte';

/** A transparent 1×1 PNG. */
const PNG_BYTES = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

describe('AssetPreview', () => {
  test('shows an image from a URL, and marks it loaded', async () => {
    const { container } = await render(AssetPreview, {
      kind: 'image',
      src: `data:image/png;base64,${btoa(String.fromCharCode(...PNG_BYTES))}`,
      loading: 'eager',
      alt: 'Dot',
    });

    const img = container.querySelector('img');

    expect(img).toHaveAttribute('alt', 'Dot');
    await expect
      .poll(() => container.querySelector('.preview')?.classList.contains('loaded'))
      .toBe(true);
  });

  test('shows an unsaved image asset from its file', async () => {
    const file = new File([PNG_BYTES], 'dot.png', { type: 'image/png' });
    const asset = createMockAsset({ name: 'dot.png', file, asset: { unsaved: true } });

    const { container } = await render(AssetPreview, {
      kind: 'image',
      asset,
      loading: 'eager',
      dissolve: false,
    });

    await expect.poll(() => container.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/);
    await expect
      .poll(() => container.querySelector('.preview')?.classList.contains('loaded'))
      .toBe(true);
  });

  test('shows a fallback icon when the image fails to load', async () => {
    const { container } = await render(AssetPreview, {
      kind: 'image',
      src: 'data:image/png;base64,AAAA',
      loading: 'eager',
    });

    await expect.poll(() => container.textContent?.trim()).toBe('draft');
  });

  test('shows an icon for a document or an audio file without controls', async () => {
    const document = (await render(AssetPreview, { kind: 'document' })).container;

    expect(document).toHaveTextContent('draft');

    const audio = (await render(AssetPreview, { kind: 'audio' })).container;

    expect(audio).toHaveTextContent('audio_file');
    expect(audio.querySelector('audio')).toBeNull();
  });

  test('shows a player for a video or an audio file with controls', async () => {
    const video = (
      await render(AssetPreview, {
        kind: 'video',
        src: 'https://example.com/clip.mp4',
        controls: true,
        loading: 'eager',
      })
    ).container;

    expect(video.querySelector('video')).toHaveAttribute('controls');

    const audio = (
      await render(AssetPreview, {
        kind: 'audio',
        src: 'https://example.com/clip.mp3',
        controls: true,
        loading: 'eager',
      })
    ).container;

    expect(audio.querySelector('audio')).toHaveAttribute('src', 'https://example.com/clip.mp3');
  });

  test('blurs the image behind itself when requested', async () => {
    const src = `data:image/png;base64,${btoa(String.fromCharCode(...PNG_BYTES))}`;

    const { container } = await render(AssetPreview, {
      kind: 'image',
      src,
      loading: 'eager',
      blurBackground: true,
    });

    await expect.poll(() => container.querySelector('.blur img')?.getAttribute('src')).toBe(src);
  });
});
