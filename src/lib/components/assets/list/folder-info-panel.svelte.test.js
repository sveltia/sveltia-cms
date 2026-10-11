import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import FolderInfoPanel from './folder-info-panel.svelte';

describe('FolderInfoPanel', () => {
  test('describes a folder with its name, path and contents', async () => {
    const { container } = await render(FolderInfoPanel, {
      name: '2024',
      path: 'static/uploads/2024',
      folderCount: 2,
      assetCount: 1,
    });

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent(
        'Folder 2024 Folder Path /static/uploads/2024 Contents 2 folders 1 asset',
      );
    await expect.element(page.getByRole('heading', { name: 'Folder Path' })).toBeVisible();
    // A path reads left to right whatever the UI direction
    expect(page.getByText('/static/uploads/2024').element()).toHaveAttribute('dir', 'ltr');
    // The folder icon stands in for an asset preview
    expect(container.querySelector('.folder-preview .icon')).not.toBeNull();
  });

  test('leaves out the path and the folder count when they are not given', async () => {
    const { container } = await render(FolderInfoPanel, { name: 'All Assets', assetCount: 0 });

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder All Assets Contents No assets');
    expect(page.getByRole('heading', { name: 'Folder Path' }).elements()).toHaveLength(0);
    // Only the asset count is given for a location that isn’t browsed by subfolder
    expect(container.querySelectorAll('section:last-child p')).toHaveLength(1);
  });

  test('shows an empty root folder', async () => {
    const { container } = await render(FolderInfoPanel, {
      name: 'uploads',
      path: '',
      folderCount: 0,
      assetCount: 3,
    });

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder uploads Folder Path / Contents No folders 3 assets');
  });
});
