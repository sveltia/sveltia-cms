import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import RejectedFilesAlertDialog from './rejected-files-alert-dialog.svelte';

describe('RejectedFilesAlertDialog', () => {
  test('lists the files that are too large', async () => {
    await render(RejectedFilesAlertDialog, {
      open: true,
      oversizedFileNames: ['huge.png'],
      invalidFileNames: [],
      maxSize: 1024 * 1024,
    });

    const dialog = page.getByRole('alertdialog', { name: 'Large File' });

    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByText(/exceeds the maximum size/))
      .toHaveTextContent(
        'This file cannot be uploaded because it exceeds the maximum size of \u2068\u20681\u2069 MB\u2069. Please reduce the size or select a different file.',
      );
    expect([...dialog.element().querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'huge.png',
    ]);
  });

  test('lists the files that are invalid', async () => {
    await render(RejectedFilesAlertDialog, {
      open: true,
      oversizedFileNames: [],
      invalidFileNames: ['a.jpg', 'b.jpg'],
      maxSize: Infinity,
    });

    const dialog = page.getByRole('alertdialog', { name: 'Invalid File' });

    await expect.element(dialog).toBeVisible();
    expect(dialog.element().querySelectorAll('li')).toHaveLength(2);
  });

  test('names both kinds of rejection', async () => {
    await render(RejectedFilesAlertDialog, {
      open: true,
      oversizedFileNames: ['huge.png'],
      invalidFileNames: ['a.jpg'],
      maxSize: 1024,
    });

    await expect
      .element(page.getByRole('alertdialog', { name: 'Files Cannot Be Uploaded' }))
      .toBeVisible();
  });

  test('lists nothing without rejected files', async () => {
    await render(RejectedFilesAlertDialog, /** @type {any} */ ({ open: true, maxSize: 1024 }));

    const dialog = page.getByRole('alertdialog');

    await expect.element(dialog).toBeVisible();
    expect(dialog.element().querySelectorAll('li')).toHaveLength(0);
  });
});
