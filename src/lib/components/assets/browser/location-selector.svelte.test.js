import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  activated as cloudinaryActivated,
  dialogOpen as cloudinaryDialogOpen,
} from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { env } from '$lib/services/user/env.svelte';

import LocationSelector from './location-selector.svelte';

/**
 * @import {
 * AssetFolderInfo,
 * AssetLibraryFolderMap,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

const folder = /** @type {AssetFolderInfo} */ ({
  collectionName: undefined,
  internalPath: 'static/images',
  publicPath: '/images',
  label: 'Images',
});

/** @type {AssetLibraryFolderMap} */
const assetLibraryFolderMap = {
  field: { folder: undefined, enabled: false },
  entry: { folder: undefined, enabled: false },
  global: { folder, enabled: true },
};

/**
 * Create a service entry.
 * @param {string} serviceId Service ID.
 * @param {string} serviceLabel Service label.
 * @returns {[string, MediaLibraryService]} Entry.
 */
const service = (serviceId, serviceLabel) => [
  serviceId,
  /** @type {MediaLibraryService} */ (/** @type {unknown} */ ({ serviceId, serviceLabel })),
];

/**
 * Render the selector.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<{ onChange: import('vitest').Mock }>} Change handler.
 */
const renderSelector = async (props = {}) => {
  const onChange = vi.fn();

  await render(LocationSelector, {
    libraryName: 'default-global',
    assetLibraryFolderMap,
    showRepository: true,
    selectFolder: false,
    cloudServiceEntries: [service('cloudinary', 'Cloudinary')],
    showURLInput: true,
    stockAssetProviderEntries: [service('pexels', 'Pexels')],
    controlsId: 'content-pane',
    onChange,
    ...props,
  });

  return { onChange };
};

afterEach(() => {
  env.isSmallScreen = false;
  cloudinaryActivated.current = false;
  cloudinaryDialogOpen.current = false;
});

describe('LocationSelector', () => {
  test('lists the locations in groups, with the selected one marked', async () => {
    await renderSelector();

    const listbox = page.getByRole('listbox', { name: 'Locations' });

    await expect.element(listbox).toHaveAttribute('aria-controls', 'content-pane');
    await expect.element(page.getByRole('group', { name: 'Your Site' })).toBeInTheDocument();
    await expect
      .element(page.getByRole('option', { name: 'Images' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect
      .element(page.getByRole('group', { name: 'External Locations' }))
      .toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Cloudinary' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Enter URL' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Pexels' })).toBeInTheDocument();
  });

  test('reports the location selected by the user', async () => {
    const { onChange } = await renderSelector();

    await page.getByRole('option', { name: 'Pexels' }).click();

    expect(onChange).toHaveBeenCalledWith('pexels');
  });

  test('opens the Cloudinary widget once activated', async () => {
    cloudinaryActivated.current = true;
    await renderSelector({ libraryName: 'cloudinary' });

    await page.getByRole('option', { name: 'Cloudinary' }).click();

    expect(cloudinaryDialogOpen.current).toBe(true);
  });

  test('leaves out the empty groups', async () => {
    await renderSelector({
      showRepository: false,
      cloudServiceEntries: [],
      showURLInput: false,
      stockAssetProviderEntries: [],
    });

    await expect.element(page.getByRole('listbox')).toBeInTheDocument();
    expect(page.getByRole('group').elements()).toHaveLength(0);
  });

  test('shows a drop-down list on a small screen', async () => {
    env.isSmallScreen = true;
    await renderSelector();

    await expect.element(page.getByRole('combobox', { name: 'Locations' })).toBeInTheDocument();
  });
});
