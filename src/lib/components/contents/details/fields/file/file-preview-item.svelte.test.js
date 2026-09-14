import { describe, expect, test } from 'vitest';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FilePreviewItem from './file-preview-item.svelte';

/**
 * @import { MediaField } from '$lib/types/public';
 */

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
    expect((await renderItem('  ')).querySelector('p')).toBeNull();
    expect((await renderItem('blob:abc')).querySelector('p')).toBeNull();
  });
});
