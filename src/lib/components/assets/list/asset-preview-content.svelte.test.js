import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { TEST_IMAGE_URL } from '$lib/test/config';

import AssetPreviewContent from './asset-preview-content.svelte';

/**
 * Get the content of a text file.
 * @returns {string} Content.
 */
const getText = () => 'Hello, world!';

describe('AssetPreviewContent', () => {
  test('shows an image from its URL', async () => {
    await render(AssetPreviewContent, {
      kind: 'image',
      name: 'a.png',
      type: 'image/png',
      src: TEST_IMAGE_URL,
      getText,
    });

    await expect.element(page.getByRole('img', { name: 'a.png' })).toBeInTheDocument();
  });

  test('shows a media file even while the type is being looked up', async () => {
    const { container } = await render(AssetPreviewContent, {
      kind: 'audio',
      name: 'song.mp3',
      type: undefined,
      src: 'blob:http://localhost/song',
      pending: true,
      getText,
    });

    await expect.poll(() => container.querySelector('audio')).not.toBeNull();
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  test('shows a loading state while the type is being looked up', async () => {
    await render(AssetPreviewContent, {
      kind: 'document',
      name: 'doc.pdf',
      type: undefined,
      src: undefined,
      pending: true,
      getText,
    });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading…');
  });

  test('shows a PDF in a sandboxed frame', async () => {
    const { container } = await render(AssetPreviewContent, {
      kind: 'document',
      name: 'doc.pdf',
      type: 'application/pdf',
      src: 'blob:http://localhost/doc',
      getText,
    });

    await expect.poll(() => container.querySelector('iframe')?.title).toBe('doc.pdf');
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
      'blob:http://localhost/doc',
    );
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts');
  });

  test('shows the content of a text file once it’s been read', async () => {
    const { promise, resolve } = Promise.withResolvers();

    await render(AssetPreviewContent, {
      kind: 'other',
      name: 'notes.txt',
      type: 'text/plain',
      src: undefined,
      /**
       * Read the file, which takes a while.
       * @returns {Promise<string>} Content.
       */
      getText: () => promise,
    });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading…');
    resolve('Hello, world!');
    await expect.element(page.getByRole('figure')).toHaveTextContent('Hello, world!');
  });

  test('reports a text file that can’t be read', async () => {
    await render(AssetPreviewContent, {
      kind: 'other',
      name: 'notes.txt',
      type: 'text/plain',
      src: undefined,
      /**
       * Fail to read the file.
       * @returns {Promise<string>} Content.
       */
      getText: () => Promise.reject(new Error('offline')),
    });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Preview Unavailable.');
  });

  test('has no preview for a binary file, or one whose type is unknown', async () => {
    const { rerender } = await render(AssetPreviewContent, {
      kind: 'other',
      name: 'archive.zip',
      type: 'application/zip',
      src: undefined,
      getText,
    });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Preview Unavailable.');

    await rerender({ kind: undefined, type: null });
    await expect.element(page.getByRole('alert')).toHaveTextContent('Preview Unavailable.');
  });
});
