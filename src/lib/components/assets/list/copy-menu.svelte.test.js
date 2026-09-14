import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { waitForToastsToHide } from '$lib/test/toast';

import CopyMenu from './copy-menu.svelte';

const items = [
  { label: 'Public URL', copy: vi.fn(), toastKey: 'asset_urls_copied' },
  { label: 'File Path', copy: vi.fn(), toastKey: 'asset_paths_copied' },
  { label: 'File Data', copy: vi.fn(), toastKey: 'asset_data_copied', disabled: true },
];

describe('CopyMenu', () => {
  test('runs the copy action and confirms it', async () => {
    await render(CopyMenu, { items, count: 2 });
    await page.getByRole('button', { name: 'Copy' }).click();
    await sleep(150);

    await expect.element(page.getByRole('menuitem', { name: 'File Data' })).toBeDisabled();
    await page.getByRole('menuitem', { name: 'Public URL' }).click();

    expect(items[0].copy).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('check_circle 2 URLs copied to clipboard.');
    await waitForToastsToHide();
  });

  test('reports a clipboard failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(CopyMenu, {
      items: [
        {
          label: 'Public URL',
          copy: vi.fn().mockRejectedValue(new Error('Boom')),
          toastKey: 'asset_urls_copied',
        },
      ],
      count: 1,
    });
    await page.getByRole('button', { name: 'Copy' }).click();
    await sleep(150);
    await page.getByRole('menuitem', { name: 'Public URL' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Couldn’t copy to clipboard.');
  });

  test('is disabled without any selected assets', async () => {
    await render(CopyMenu, { items, count: 0 });
    await expect.element(page.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  test('can be a submenu instead of a button', async () => {
    await render(CopyMenu, { items, count: 1, useButton: false });

    expect(page.getByRole('button').elements()).toHaveLength(0);
    await expect.element(page.getByRole('menuitem', { name: 'Copy' })).toBeEnabled();
  });
});
