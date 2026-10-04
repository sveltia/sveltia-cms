import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FilePreviewItem from './file-preview-item.svelte';

/**
 * @import { MediaField } from '$lib/types/public';
 */

/**
 * URLs to resolve given values to, each after a delay in milliseconds, so the lookup for one value
 * can be answered after the one for a later value.
 */
const { mockedURLs } = vi.hoisted(() => ({
  /** @type {Map<string, { url: string, delay: number }>} */
  mockedURLs: new Map(),
}));

/** A transparent 1×1 PNG, which loads without a network request. */
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

vi.mock('$lib/services/assets/media-field', async (importOriginal) => {
  /** @type {any} */
  const original = await importOriginal();

  return {
    ...original,
    /**
     * Resolve the URL, from the mocked ones if given.
     * @param {any} args Arguments.
     * @returns {Promise<string | undefined>} URL.
     */
    getMediaFieldURL: async (args) => {
      const mocked = mockedURLs.get(args.value);

      if (!mocked) {
        return original.getMediaFieldURL(args);
      }

      await new Promise((resolve) => {
        setTimeout(resolve, mocked.delay);
      });

      return mocked.url;
    },
  };
});

/**
 * Render the item.
 * @param {string} value Field value.
 * @param {Partial<MediaField>} [config] Field options.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderItem = async (value, config = {}) => {
  /** @type {MediaField} */
  const fieldConfig = { name: 'doc', widget: 'file', ...config };

  const { container } = await renderWithDraft(FilePreviewItem, {
    draft: createMockDraft({ fields: [fieldConfig] }),
    props: { value, fieldConfig, typedKeyPath: 'doc' },
  });

  // The example URLs can’t be loaded. Keep a failed request, whenever it fails, from replacing the
  // image or player with the fallback icon before it’s checked
  container.addEventListener('error', (event) => event.stopImmediatePropagation(), {
    capture: true,
  });

  return container;
};

describe('FilePreviewItem', () => {
  test('shows an image field value as an image', async () => {
    const url = 'https://example.com/photo.png';
    const container = await renderItem(url, { widget: 'image' });

    await expect.poll(() => container.querySelector('img')?.getAttribute('src')).toBe(url);
  });

  test('detects the kind of a file and shows a player with controls', async () => {
    const url = 'https://example.com/clip.mp4';
    const container = await renderItem(url);

    await expect.poll(() => container.querySelector('video')?.getAttribute('src')).toBe(url);
    expect(container.querySelector('video')).toHaveAttribute('controls');
  });

  test('shows the path of a file that is not media', async () => {
    const container = await renderItem('docs/report.txt');

    await expect.poll(() => container.textContent).toContain('docs/report.txt');
    expect(container.querySelector('img, video, audio')).toBeNull();
  });

  test('shows nothing for a blank value or an unresolved blob', async () => {
    expect((await renderItem('')).querySelector('p')).toBeNull();
    expect((await renderItem('  ')).querySelector('p')).toBeNull();
    expect((await renderItem('blob:abc')).querySelector('p')).toBeNull();
  });

  test('ignores the preview of an earlier value resolved after the current one', async () => {
    const slow = 'https://example.com/slow.png';
    const fast = 'https://example.com/fast.png';
    const fastURL = `${PNG_DATA_URL}#fast`;
    /** @type {MediaField} */
    const fieldConfig = { name: 'doc', widget: 'image' };
    const props = $state({ value: slow, fieldConfig, typedKeyPath: 'doc' });

    mockedURLs.set(slow, { url: `${PNG_DATA_URL}#slow`, delay: 200 });
    mockedURLs.set(fast, { url: fastURL, delay: 0 });
    onTestFinished(() => {
      mockedURLs.clear();
    });

    const { container } = await renderWithDraft(FilePreviewItem, {
      draft: createMockDraft({ fields: [fieldConfig] }),
      props,
    });

    props.value = fast;
    await expect.poll(() => container.querySelector('img')?.getAttribute('src')).toBe(fastURL);
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(fastURL);
  });
});
