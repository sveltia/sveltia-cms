import { sleep } from '@sveltia/utils/misc';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { holdViewTransition } from '$lib/services/app/navigation';
import { createMockAsset } from '$lib/test/config';

import AssetPreview from './asset-preview.svelte';

vi.mock('$lib/services/app/navigation', async (importOriginal) => ({
  ...(await importOriginal()),
  holdViewTransition: vi.fn(),
}));

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

  test('shows the next asset after one whose image has failed to load', async () => {
    const broken = createMockAsset({
      name: 'broken.png',
      file: new File([new Uint8Array([1, 2, 3])], 'broken.png', { type: 'image/png' }),
      asset: { unsaved: true },
    });

    const valid = createMockAsset({
      name: 'dot.png',
      file: new File([PNG_BYTES], 'dot.png', { type: 'image/png' }),
      asset: { unsaved: true },
    });

    const { container, rerender } = await render(AssetPreview, {
      kind: 'image',
      asset: broken,
      loading: 'eager',
      dissolve: false,
    });

    await expect.poll(() => container.textContent?.trim()).toBe('draft');

    // The info panel keeps the same preview while the focus moves to another asset
    await rerender({ asset: valid });

    await expect
      .poll(() => {
        const src = container.querySelector('img')?.getAttribute('src');

        return !!src && src === valid.blobURL;
      })
      .toBe(true);
    await expect
      .poll(() => container.querySelector('.preview')?.classList.contains('loaded'))
      .toBe(true);
    expect(container.textContent?.trim()).toBe('');
  });

  test.each([
    ['an image', undefined],
    ['a thumbnail', /** @type {const} */ ('tile')],
  ])('shows the latest asset after a quick move from one to another, as %s', async (_, variant) => {
    const { promise: firstFile, resolve: resolveFirst } = Promise.withResolvers();

    // The first asset is read from a file handle, which takes a while
    const first = createMockAsset({
      name: 'first.png',
      asset: { handle: /** @type {any} */ ({ getFile: vi.fn(() => firstFile) }) },
    });

    const second = createMockAsset({
      name: 'second.png',
      file: new File([PNG_BYTES], 'second.png', { type: 'image/png' }),
      asset: { unsaved: true },
    });

    const { container, rerender } = await render(AssetPreview, {
      kind: 'image',
      asset: first,
      variant,
      loading: 'eager',
      dissolve: false,
    });

    // Move on while the first asset is still being read
    await sleep(50);
    await rerender({ asset: second });

    /**
     * Get the source of the image shown.
     * @returns {string | null | undefined} URL.
     */
    const getSrc = () => container.querySelector('img')?.getAttribute('src');

    // The second asset shows up while the first one is still being read
    await expect.poll(getSrc).toMatch(/^blob:/);

    const src = getSrc();

    // The first lookup ends, too late to replace the second asset
    resolveFirst(new File([PNG_BYTES], 'first.png', { type: 'image/png' }));
    await sleep(200);
    expect(getSrc()).toBe(src);
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

  test('blurs the thumbnail being made for an asset behind itself', async () => {
    const file = new File([PNG_BYTES], 'thumb.png', { type: 'image/png' });
    const asset = createMockAsset({ name: 'thumb.png', file, asset: { unsaved: true } });

    // A tile starts making the thumbnail, which the backdrop lookup then joins
    await render(AssetPreview, { kind: 'image', asset, variant: 'tile', loading: 'eager' });

    const { container } = await render(AssetPreview, {
      kind: 'image',
      asset,
      loading: 'eager',
      blurBackground: true,
    });

    const media = /** @type {HTMLImageElement} */ (container.querySelector('img:not([role])'));

    // The backdrop ends up with the thumbnail’s own URL rather than the media’s
    await expect
      .poll(() => {
        const src = container.querySelector('.blur img')?.getAttribute('src');

        return !!src && src.startsWith('blob:') && src !== media.getAttribute('src');
      })
      .toBe(true);
  });

  test('releases the thumbnail found for the backdrop of a removed preview', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const file = new File([PNG_BYTES], 'gone.png', { type: 'image/png' });
    const asset = createMockAsset({ name: 'gone.png', file, asset: { unsaved: true } });

    onTestFinished(() => revokeObjectURL.mockRestore());

    const tile = await render(AssetPreview, {
      kind: 'image',
      asset,
      variant: 'tile',
      loading: 'eager',
    });

    const { unmount } = await render(AssetPreview, {
      kind: 'image',
      asset,
      loading: 'eager',
      blurBackground: true,
    });

    // Removed while the backdrop lookup waits for the thumbnail being made
    unmount();

    /**
     * Get the URL the tile displays its thumbnail with.
     * @returns {string | null | undefined} URL.
     */
    const tileSrc = () => tile.container.querySelector('img')?.getAttribute('src');

    await expect.poll(tileSrc).toMatch(/^blob:/);
    // Each lookup gets a URL of its own, and the removed preview’s one is released
    await vi.waitFor(() =>
      expect(revokeObjectURL.mock.calls.some(([url]) => url !== tileSrc())).toBe(true),
    );
  });

  test('keeps the media as the backdrop when no thumbnail is cached for it', async () => {
    // The asset has been preloaded, so its URL is looked up before the cached thumbnail
    const blobURL = URL.createObjectURL(new Blob([PNG_BYTES], { type: 'image/png' }));
    const asset = createMockAsset({ name: 'preloaded.png', asset: { blobURL } });

    onTestFinished(() => URL.revokeObjectURL(blobURL));

    const { container } = await render(AssetPreview, {
      kind: 'image',
      asset,
      loading: 'eager',
      blurBackground: true,
    });

    await expect
      .poll(() => container.querySelector('.blur img')?.getAttribute('src'))
      .toBe(blobURL);
    // The thumbnail lookup that finds nothing doesn’t clear it
    await sleep(100);
    expect(container.querySelector('.blur img')?.getAttribute('src')).toBe(blobURL);
  });

  describe('holdTransition', () => {
    const src = `data:image/png;base64,${btoa(String.fromCharCode(...PNG_BYTES))}`;

    /**
     * Get the hold the preview has added, and whether it has been released.
     * @returns {Promise<{ hold: Promise<any>, isReleased: () => boolean }>} Hold.
     */
    const getHold = async () => {
      await vi.waitFor(() => expect(holdViewTransition).toHaveBeenCalledOnce());

      const [hold] = vi.mocked(holdViewTransition).mock.calls[0];
      let released = false;

      hold.then(() => {
        released = true;
      });

      /**
       * Check whether the hold has been released.
       * @returns {boolean} Result.
       */
      const isReleased = () => released;

      return { hold, isReleased };
    };

    test('holds the running view transition until the media is loaded', async () => {
      const { container } = await render(AssetPreview, {
        kind: 'image',
        src,
        loading: 'eager',
        holdTransition: true,
      });

      const { hold } = await getHold();

      await hold;
      expect(container.querySelector('img')?.complete).toBe(true);
    });

    test('releases the view transition once the media fails to load', async () => {
      const { container } = await render(AssetPreview, {
        kind: 'image',
        src: 'data:image/png;base64,AAAA',
        loading: 'eager',
        holdTransition: true,
      });

      const { hold } = await getHold();

      await hold;
      await expect.poll(() => container.textContent?.trim()).toBe('draft');
    });

    test('releases the view transition once the preview is removed', async () => {
      const { unmount } = await render(AssetPreview, {
        kind: 'image',
        src: 'https://example.com/never.png',
        loading: 'eager',
        holdTransition: true,
      });

      const { hold, isReleased } = await getHold();

      expect(isReleased()).toBe(false);
      unmount();
      await hold;
    });

    test('doesn’t hold the view transition by default', async () => {
      const { container } = await render(AssetPreview, { kind: 'image', src, loading: 'eager' });

      await expect.poll(() => container.querySelector('img')?.complete).toBe(true);
      expect(holdViewTransition).not.toHaveBeenCalled();
    });
  });
});
