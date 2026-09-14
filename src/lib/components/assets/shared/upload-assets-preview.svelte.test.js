import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import UploadAssetsPreview from './upload-assets-preview.svelte';

/** A transparent 1×1 PNG. */
const PNG_BYTES = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

const image = new File([PNG_BYTES], 'photo.png', { type: 'image/png' });
const doc = new File(['hello'], 'notes.txt', { type: 'text/plain' });

describe('UploadAssetsPreview', () => {
  test('lists the files with a thumbnail, type and size', async () => {
    const { container } = await render(UploadAssetsPreview, { files: [image, doc] });
    const items = page.getByRole('listitem');

    await expect.poll(() => items.elements().length).toBe(2);
    expect(items.elements()[0].querySelector('img')?.getAttribute('src')).toMatch(/^blob:/);
    expect(items.elements()[0].querySelector('.name')).toHaveTextContent('photo.png');
    expect(items.elements()[0].querySelector('.meta')).toHaveTextContent(
      'PNG image · \u206870\u2069 bytes',
    );
    // A document gets a generic icon
    expect(items.elements()[1].querySelector('img')).toBeNull();
    expect(items.elements()[1].querySelector('.meta')).toHaveTextContent(
      'TXT · \u20685\u2069 bytes',
    );
    expect(container.querySelectorAll('button[hidden]')).toHaveLength(0);
  });

  test('removes a file from the list', async () => {
    const props = $state({ files: [image, doc] });

    await render(UploadAssetsPreview, props);
    await page.getByRole('button', { name: 'Remove' }).nth(0).click();

    await expect.poll(() => props.files).toEqual([doc]);
    // The last file can’t be removed, so its button is hidden
    await expect.poll(() => document.querySelectorAll('.file button[hidden]').length).toBe(1);
  });

  test('keeps the thumbnail of a file that is reordered', async () => {
    const props = $state({ files: [image, doc] });
    const { container } = await render(UploadAssetsPreview, props);

    await expect.poll(() => container.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/);

    const src = container.querySelector('img')?.getAttribute('src');

    props.files = [doc, image];
    await expect
      .poll(() => container.querySelectorAll('.file')[1]?.querySelector('img')?.getAttribute('src'))
      .toBe(src);
  });

  test('notes the original format of a converted file', async () => {
    const original = new File([''], 'photo.jpg', { type: 'image/jpeg' });

    const { container } = await render(UploadAssetsPreview, {
      files: [image],
      transformedFileMap: new Map([[image, original]]),
      removable: false,
    });

    await expect
      .poll(() => container.querySelector('.meta')?.textContent)
      .toContain('(converted from \u2068JPEG image\u2069)');
  });

  test('lists nothing without files', async () => {
    const { container } = await render(UploadAssetsPreview, {});

    expect(container.querySelectorAll('.file')).toHaveLength(0);
  });
});
