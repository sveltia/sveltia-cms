import { sleep } from '@sveltia/utils/misc';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { externalAssetAvailability } from '$lib/services/assets/external/availability';
import {
  getExternalAssetDetails,
  getExternalAssetUsedEntries,
} from '$lib/services/assets/external/details';
import {
  createMockEntry,
  createMockExternalAsset,
  createMockImageFile,
  initTestConfig,
  setEntries,
} from '$lib/test/config';

import InfoPanel from './info-panel.svelte';

vi.mock('$lib/services/assets/external/details', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return {
    ...actual,
    getExternalAssetDetails: vi.fn(actual.getExternalAssetDetails),
    getExternalAssetUsedEntries: vi.fn(actual.getExternalAssetUsedEntries),
  };
});

/**
 * Get the info sections as a heading-to-text map.
 * @param {HTMLElement} container Container.
 * @returns {Record<string, string>} Map.
 */
const getSections = (container) =>
  Object.fromEntries(
    [...container.querySelectorAll('section')].map((section) => [
      section.querySelector('h4')?.textContent?.trim(),
      section.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim(),
    ]),
  );

describe('InfoPanel', () => {
  beforeAll(async () => {
    await initTestConfig();
    setEntries([]);
  });

  test('shows the details of a document', async () => {
    const asset = createMockExternalAsset({
      fileName: 'notes.txt',
      asset: { size: 13, lastModified: new Date('2024-01-15T10:00:00Z') },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container)['Used in']).toBe('None');
    expect(getSections(container)).toEqual({
      Kind: 'text/plain',
      Size: '\u206813\u2069 bytes',
      'Public URL': 'https://cdn.example.com/images/notes.txt',
      'File Path': 'images/notes.txt',
      'Used in': 'None',
      'Modified on': 'Jan 15, 2024, 10:00 AM',
    });
    expect(container.querySelector('img')).toBeNull();
  });

  test('shows the dimensions and a preview of an image', async () => {
    const url = URL.createObjectURL(await createMockImageFile());

    const asset = createMockExternalAsset({
      fileName: 'photo.png',
      asset: { previewURL: url, downloadURL: url },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container).Dimensions).toBe('4×3');
    expect(getSections(container).Kind).toBe('PNG image');
    expect(container.querySelector('img')).toHaveAttribute('src', url);
  });

  test('falls back to the kind for a linked file without an extension', async () => {
    const asset = createMockExternalAsset({
      fileName: 'avatar',
      asset: {
        id: 'https://example.com/avatar',
        description: 'https://example.com/avatar',
        downloadURL: 'https://example.com/avatar',
        kind: 'image',
      },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container)['Used in']).toBe('None');
    expect(getSections(container).Kind).toBe('Image');
    expect(getSections(container)['File Path']).toBeUndefined();

    // An extension without a known type is shown as is
    const { container: another } = await render(InfoPanel, {
      asset: createMockExternalAsset({ fileName: 'data.qqq' }),
    });

    await expect.poll(() => getSections(another).Kind).toBe('QQQ');
  });

  test('shows the duration of a video, or a placeholder while it’s unknown', async () => {
    // Reading the metadata requires a real video file, so it’s served ready-made
    vi.mocked(getExternalAssetDetails).mockResolvedValueOnce({
      dimensions: { width: 1280, height: 720 },
      duration: 754,
    });

    const asset = createMockExternalAsset({
      fileName: 'clip.mp4',
      asset: { downloadURL: 'blob:http://localhost/clip', kind: 'video' },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container).Duration).toBe('00:12:34');
    expect(getSections(container).Dimensions).toBe('1280×720');

    // The file can’t be loaded, so the media info is left out
    const { container: other } = await render(InfoPanel, {
      asset: createMockExternalAsset({
        fileName: 'lost.mp4',
        asset: { downloadURL: 'blob:http://localhost/lost', kind: 'video' },
      }),
    });

    await expect.poll(() => getSections(other)['Used in']).toBe('None');
    expect(getSections(other).Duration).toBe('–');
    expect(getSections(other).Dimensions).toBe('–');
  });

  test('ignores the details of an asset focused earlier that arrive late', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getExternalAssetDetails)
      .mockReturnValueOnce(/** @type {any} */ (promise))
      .mockResolvedValueOnce({ dimensions: { width: 4, height: 3 } });

    const first = createMockExternalAsset({ fileName: 'first.png' });
    const second = createMockExternalAsset({ fileName: 'second.png' });
    const { container, rerender } = await render(InfoPanel, { asset: first });

    await rerender({ asset: second });
    await expect.poll(() => getSections(container).Dimensions).toBe('4×3');

    resolve({ dimensions: { width: 1280, height: 720 } });
    await sleep(50);

    expect(getSections(container).Dimensions).toBe('4×3');
  });

  test('ignores the used entries of an asset focused earlier that arrive late', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(getExternalAssetUsedEntries).mockReturnValueOnce(/** @type {any} */ (promise));

    const first = createMockExternalAsset({ fileName: 'first.pdf' });
    const second = createMockExternalAsset({ fileName: 'second.pdf' });
    const { container, rerender } = await render(InfoPanel, { asset: first });

    await expect.poll(() => vi.mocked(getExternalAssetUsedEntries).mock.calls.length).toBe(1);
    await rerender({ asset: second });
    await expect.poll(() => getSections(container)['Used in']).toBe('None');

    resolve([createMockEntry({ slug: 'stale', content: { _default: { title: 'Stale' } } })]);
    await sleep(50);

    expect(getSections(container)['Used in']).toBe('None');
  });

  test('tells that a linked file couldn’t be loaded', async () => {
    const asset = createMockExternalAsset({
      fileName: 'gone.pdf',
      asset: {
        id: 'https://example.com/gone.pdf',
        description: 'https://example.com/gone.pdf',
        downloadURL: 'https://example.com/gone.pdf',
      },
    });

    externalAssetAvailability.current = { [asset.id]: false };

    const { container } = await render(InfoPanel, { asset });

    // The alert starts with its icon’s ligature text
    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent('This file couldn’t be loaded. It may have been moved or deleted.');

    // A file that has been checked, or not checked yet, has no such notice
    externalAssetAvailability.current = { [asset.id]: true };
    await expect.poll(() => container.querySelector('[role="alert"]')).toBeNull();

    externalAssetAvailability.current = {};
    await expect.poll(() => getSections(container)['Used in']).toBe('None');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
