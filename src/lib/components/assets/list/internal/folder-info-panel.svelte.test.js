import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  allAssetFolders,
  globalAssetFolder,
  selectedAssetFolder,
} from '$lib/services/assets/folders';
import { focusedSubfolder, selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { createMockAsset, initTestConfig, setAssets } from '$lib/test/config';

import FolderInfoPanel from './folder-info-panel.svelte';

describe('FolderInfoPanel', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'docs',
          label: 'Docs',
          folder: 'content/docs',
          // Entry-relative, so the folder isn’t browsed by subfolder
          media_folder: '',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });

    const folder = globalAssetFolder.current;

    setAssets([
      createMockAsset({ name: 'a.png', asset: { folder } }),
      createMockAsset({ name: 'b.png', folderPath: 'static/uploads/2024', asset: { folder } }),
      createMockAsset({
        name: 'c.png',
        folderPath: 'static/uploads/2024/summer',
        asset: { folder },
      }),
    ]);
  });

  beforeEach(() => {
    selectedAssetFolder.current = globalAssetFolder.current;
    selectedSubfolderPath.current = '';
    focusedSubfolder.current = undefined;
  });

  test('describes the focused subfolder over the folder being browsed', async () => {
    focusedSubfolder.current = { name: '2024', path: 'static/uploads/2024' };

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder 2024 Folder Path /static/uploads/2024 Contents 1 folder 1 asset');

    focusedSubfolder.current = { name: 'summer', path: 'static/uploads/2024/summer' };
    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent(
        'Folder summer Folder Path /static/uploads/2024/summer Contents No folders 1 asset',
      );
  });

  test('describes the folder root', async () => {
    const { container } = await render(FolderInfoPanel);

    expect(container.querySelector('.folder-preview .icon')).toHaveTextContent('folder');
    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent(
        'Folder Global Assets Folder Path /static/uploads Contents 1 folder 1 asset',
      );
  });

  test('describes the subfolder being browsed', async () => {
    selectedSubfolderPath.current = '2024/summer';

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent(
        'Folder summer Folder Path /static/uploads/2024/summer Contents No folders 1 asset',
      );
  });

  test('describes the All Assets folder, which has no path', async () => {
    selectedAssetFolder.current = allAssetFolders.current.find(
      ({ internalPath }) => internalPath === undefined,
    );

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder All Assets Contents 3 assets');
    expect(container.textContent).not.toContain('Folder Path');
  });

  test('counts no subfolders for a folder that isn’t browsed by subfolder', async () => {
    selectedAssetFolder.current = allAssetFolders.current.find(
      ({ collectionName }) => collectionName === 'docs',
    );

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder Docs Folder Path /content/docs Contents No assets');
    expect(container.textContent).not.toContain('folders');
  });
});
