import { sleep } from '@sveltia/utils/misc';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
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
    const onError = vi.fn();

    const { container } = await render(AssetPreview, {
      kind: 'image',
      src: `data:image/png;base64,${btoa(String.fromCharCode(...PNG_BYTES))}`,
      loading: 'eager',
      alt: 'Dot',
      onError,
    });

    const img = container.querySelector('img');

    expect(img).toHaveAttribute('alt', 'Dot');
    await expect
      .poll(() => container.querySelector('.preview')?.classList.contains('loaded'))
      .toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  test('doesn’t show a lazy image once its URL has been cleared', async () => {
    // Render the preview below the fold, so the image waits until it’s scrolled into view
    const spacer = document.body.appendChild(document.createElement('div'));

    spacer.style.height = '200vh';
    onTestFinished(() => spacer.remove());

    const props = $state({
      kind: /** @type {const} */ ('image'),
      src: 'https://example.com/a.png',
    });

    const { container } = await render(AssetPreview, props);
    const img = /** @type {HTMLImageElement} */ (container.querySelector('img'));

    await sleep(50);
    expect(img.getAttribute('src')).toBeNull();
    props.src = /** @type {any} */ (undefined);
    // Bring the preview into view
    spacer.remove();
    await sleep(100);

    expect(img.getAttribute('src')).toBeNull();
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
    const onError = vi.fn();

    const { container } = await render(AssetPreview, {
      kind: 'image',
      src: 'data:image/png;base64,AAAA',
      loading: 'eager',
      onError,
    });

    await expect.poll(() => container.textContent?.trim()).toBe('draft');
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
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

  test('releases a thumbnail made after the preview has been removed', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const file = new File([PNG_BYTES], 'late.png', { type: 'image/png' });
    const asset = createMockAsset({ name: 'late.png', file, asset: { unsaved: true } });

    const { unmount } = await render(AssetPreview, {
      kind: 'image',
      asset,
      variant: 'tile',
      loading: 'eager',
    });

    // Removed while the thumbnail is still being made
    unmount();

    await vi.waitFor(() => {
      const urls = createObjectURL.mock.results.map(({ value }) => value);

      expect(urls).not.toHaveLength(0);
      expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(urls));
    });

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  test('blurs an asset behind itself, unless it’s removed before the lookup ends', async () => {
    const file = new File([PNG_BYTES], 'blur.png', { type: 'image/png' });
    const asset = createMockAsset({ name: 'blur.png', file, asset: { unsaved: true } });

    const props = {
      kind: /** @type {'image'} */ ('image'),
      asset,
      loading: /** @type {'eager'} */ ('eager'),
      blurBackground: true,
    };

    const { container } = await render(AssetPreview, props);

    await expect
      .poll(() => container.querySelector('.blur img')?.getAttribute('src'))
      .toMatch(/^blob:/);

    const removed = await render(AssetPreview, props);

    removed.unmount();
    // Nothing is left to show the backdrop in
    expect(removed.container.querySelector('.blur')).toBeNull();
  });
});
