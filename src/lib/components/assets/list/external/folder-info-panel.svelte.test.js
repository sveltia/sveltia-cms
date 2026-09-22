import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  externalAssets,
  externalAssetSearchTerms,
  externalFolders,
  focusedExternalSubfolder,
  selectedCloudService,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { createMockCloudService, createMockExternalAsset } from '$lib/test/config';

import FolderInfoPanel from './folder-info-panel.svelte';

const assets = [
  createMockExternalAsset({ fileName: 'a.png', folder: '' }),
  createMockExternalAsset({ fileName: 'b.png', folder: '2024' }),
  createMockExternalAsset({ fileName: 'c.png', folder: '2024/summer' }),
].map((asset) => ({
  ...asset,
  id: asset.id.replace(/^\//, ''),
  description: asset.id.replace(/^\//, ''),
}));

describe('FolderInfoPanel', () => {
  beforeEach(() => {
    selectedCloudService.current = createMockCloudService({ browse: vi.fn() });
    externalAssets.current = assets;
    externalFolders.current = ['2024/empty'];
    selectedExternalDirPath.current = '';
    externalAssetSearchTerms.current = '';
    focusedExternalSubfolder.current = undefined;
  });

  test('describes the focused subfolder over the folder being browsed', async () => {
    focusedExternalSubfolder.current = { name: '2024', path: '2024' };

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder 2024 Folder Path /2024 Contents 2 folders 1 asset');

    focusedExternalSubfolder.current = { name: 'summer', path: '2024/summer' };
    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder summer Folder Path /2024/summer Contents No folders 1 asset');
  });

  test('describes the service root, which has no path', async () => {
    const { container } = await render(FolderInfoPanel);

    expect(container.querySelector('.folder-preview .icon')).toHaveTextContent('folder');
    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder Test Cloud Contents 1 folder 1 asset');
    expect(container.textContent).not.toContain('Folder Path');
  });

  test('describes the folder being browsed', async () => {
    selectedExternalDirPath.current = '2024';

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder 2024 Folder Path /2024 Contents 2 folders 1 asset');
  });

  test('describes the whole service while it’s searched', async () => {
    selectedExternalDirPath.current = '2024';
    externalAssetSearchTerms.current = 'c';

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder Test Cloud Contents 1 asset');
    expect(container.textContent).not.toContain('folders');
  });

  test('counts nothing before the assets are loaded', async () => {
    externalAssets.current = undefined;
    focusedExternalSubfolder.current = { name: '2024', path: '2024' };

    const { container } = await render(FolderInfoPanel);

    await expect
      .element(page.elementLocator(container))
      .toMatchTextContent('Folder 2024 Folder Path /2024 Contents 1 folder No assets');
  });
});
