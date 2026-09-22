import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import FileInfoSections from './file-info-sections.svelte';

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

describe('FileInfoSections', () => {
  test('describes a document by its type and size', async () => {
    const { container } = await render(FileInfoSections, {
      fileName: 'docs/notes.txt',
      kind: 'document',
      size: 13,
    });

    expect(getSections(container)).toEqual({ Kind: 'text/plain', Size: '⁨13⁩ bytes' });
  });

  test('shows the dimensions of an image once read', async () => {
    const { container } = await render(FileInfoSections, {
      fileName: 'photo.png',
      kind: 'image',
      hasDimensions: true,
    });

    // No size section without a known size
    expect(getSections(container)).toEqual({ Kind: 'PNG image', Dimensions: '–' });

    await render(FileInfoSections, {
      fileName: 'photo.png',
      kind: 'image',
      hasDimensions: true,
      dimensions: { width: 4, height: 3 },
    });

    expect(getSections(document.body).Dimensions).toBe('4×3');
  });

  test('shows the duration of a video once read', async () => {
    const { container } = await render(FileInfoSections, {
      fileName: 'clip.mp4',
      kind: 'video',
      hasDimensions: true,
      dimensions: { width: 1280, height: 720 },
      duration: 754,
    });

    expect(getSections(container)).toEqual({
      Kind: 'MP4 video',
      Dimensions: '1280×720',
      Duration: '00:12:34',
    });

    const { container: other } = await render(FileInfoSections, {
      fileName: 'song.mp3',
      kind: 'audio',
    });

    expect(getSections(other)).toEqual({ Kind: 'MP3 audio', Duration: '–' });
  });

  test('falls back to the extension, or to the kind without one', async () => {
    const { container } = await render(FileInfoSections, { fileName: 'data.qqq', kind: 'other' });

    expect(getSections(container).Kind).toBe('QQQ');

    // A linked file may have no extension, e.g. an avatar URL
    const { container: other } = await render(FileInfoSections, {
      fileName: 'avatar',
      kind: 'image',
    });

    expect(getSections(other).Kind).toBe('Image');
  });
});
