import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import RejectedFilesAlertDialog from './rejected-files-alert-dialog.svelte';

describe('RejectedFilesAlertDialog', () => {
  test('lists the files that are too large', async () => {
    const { component } = await render(RejectedFilesAlertDialog, { maxSize: 1024 * 1024 });

    component.report({ oversizedFileNames: ['huge.png'], invalidFileNames: [] });

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
    const { component } = await render(RejectedFilesAlertDialog, { maxSize: Infinity });

    component.report({ oversizedFileNames: [], invalidFileNames: ['a.jpg', 'b.jpg'] });

    const dialog = page.getByRole('alertdialog', { name: 'Invalid File' });

    await expect.element(dialog).toBeVisible();
    expect(dialog.element().querySelectorAll('li')).toHaveLength(2);
  });

  test('names both kinds of rejection', async () => {
    const { component } = await render(RejectedFilesAlertDialog, { maxSize: 1024 });

    component.report({ oversizedFileNames: ['huge.png'], invalidFileNames: ['a.jpg'] });

    await expect
      .element(page.getByRole('alertdialog', { name: 'Files Cannot Be Uploaded' }))
      .toBeVisible();
  });

  test('stays closed without rejected files', async () => {
    const { component } = await render(RejectedFilesAlertDialog, { maxSize: 1024 });

    component.report({ oversizedFileNames: [], invalidFileNames: [] });

    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
  });
});
