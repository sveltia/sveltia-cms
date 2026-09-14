import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getAssetDetails } from '$lib/services/assets/details';
import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { createMockAsset, createMockImageFile, initTestConfig, setEntries } from '$lib/test/config';

import InfoPanel from './info-panel.svelte';

vi.mock('$lib/services/assets/details', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, getAssetDetails: vi.fn(actual.getAssetDetails) };
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
    await initTestConfig({ site_url: 'https://example.com' });
    setEntries([]);
  });

  afterEach(() => {
    backendName.current = undefined;
  });

  test('shows the details of a document', async () => {
    const asset = createMockAsset({
      name: 'notes.txt',
      file: new File(['Hello, world!'], 'notes.txt', { type: 'text/plain' }),
      asset: {
        commitAuthor: { name: 'Melvin', login: 'melvin', email: 'melvin@example.com' },
        commitDate: new Date('2024-01-15T10:00:00Z'),
      },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.element(page.getByRole('heading', { name: 'Used in' })).toBeInTheDocument();
    await expect.poll(() => getSections(container)['Used in']).toBe('None');

    expect(getSections(container)).toEqual({
      // No label is defined for the extension, so the MIME type is shown
      Kind: 'text/plain',
      Size: '\u206813\u2069 bytes',
      'Public URL': 'https://example.com/uploads/notes.txt',
      'File Path': '/static/uploads/notes.txt',
      'Used in': 'None',
      'Updated by': 'Melvin',
      'Updated on': 'Jan 15, 2024, 10:00 AM',
    });

    const link = page.getByRole('link', { name: 'https://example.com/uploads/notes.txt' });

    await expect.element(link).toHaveAttribute('target', '_blank');
    expect(container.querySelector('img')).toBeNull();
  });

  test('shows the dimensions and a preview of an image', async () => {
    const file = await createMockImageFile();
    const asset = createMockAsset({ name: 'photo.png', file });
    const { container } = await render(InfoPanel, { asset, showPreview: true });

    await expect.poll(() => getSections(container).Dimensions).toBe('4×3');
    expect(getSections(container).Kind).toBe('PNG image');
    await expect.poll(() => container.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/);
  });

  test('shows the duration, creation date and location of a video', async () => {
    backendName.current = 'github';
    Object.assign(repository, { blobBaseURL: 'https://github.com/owner/repo/blob/main' });

    // Reading the metadata requires a real video file, so it’s served ready-made
    vi.mocked(getAssetDetails).mockResolvedValueOnce({
      publicURL: 'https://example.com/uploads/clip.mp4',
      repoBlobURL: 'https://github.com/owner/repo/blob/main/static/uploads/clip.mp4',
      dimensions: { width: 1280, height: 720 },
      duration: 754,
      createdDate: new Date('2024-06-01T12:00:00Z'),
      coordinates: { latitude: 45.5, longitude: -73.6 },
    });

    const asset = createMockAsset({ name: 'clip.mp4' });
    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container).Duration).toBe('00:12:34');
    expect(getSections(container)).toEqual(
      expect.objectContaining({
        Kind: 'MP4 video',
        Dimensions: '1280×720',
        'File Path': '/static/uploads/clip.mp4',
        'Created Date': 'Jun 1, 2024, 12:00 PM',
      }),
    );
    // The file size is unknown, so it’s left out
    expect(getSections(container).Size).toBeUndefined();
    await expect
      .element(page.getByRole('link', { name: '/static/uploads/clip.mp4' }))
      .toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/static/uploads/clip.mp4');
    // The map library is loaded on demand
    await expect.poll(() => container.querySelector('.leaflet-container')).not.toBeNull();

    Object.assign(repository, { blobBaseURL: '' });
  });

  test('shows a placeholder for the unknown duration of an audio file', async () => {
    // The file can’t be downloaded from the test backend, and the failure is logged
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const asset = createMockAsset({
      name: 'song.mp3',
      asset: { commitAuthor: { name: '', login: 'melvin', email: 'melvin@example.com' } },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container)['Used in']).toBe('None');
    expect(getSections(container)).toEqual(
      expect.objectContaining({ Duration: '–', Dimensions: '–', 'Updated by': 'melvin' }),
    );
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to retrieve blob' }),
    );
  });

  test('falls back to the extension and the author’s email', async () => {
    const asset = createMockAsset({
      name: 'data.qqq',
      asset: { commitAuthor: { name: '', login: '', email: 'melvin@example.com' } },
    });

    const { container } = await render(InfoPanel, { asset });

    await expect.poll(() => getSections(container)['Used in']).toBe('None');
    expect(getSections(container)).toEqual(
      expect.objectContaining({ Kind: 'QQQ', 'Updated by': 'melvin@example.com' }),
    );
  });
});
