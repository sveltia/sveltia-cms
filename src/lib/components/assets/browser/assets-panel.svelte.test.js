import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';
import { createMockAsset } from '$lib/test/config';

import AssetsPanel from './assets-panel.svelte';

const assets = [
  createMockAsset({ name: 'photo.png' }),
  createMockAsset({ name: 'logo.png', folderPath: 'static/uploads/brand' }),
  createMockAsset({
    name: 'new.png',
    asset: { unsaved: true, blobURL: 'blob:http://localhost/new' },
  }),
];

/**
 * Get the option holding the given asset.
 * @param {string} value Option value: the asset path or blob URL.
 * @returns {import('vitest/browser').Locator} Locator.
 */
const getOption = (value) =>
  page.elementLocator(
    /** @type {HTMLElement} */ (document.querySelector(`[role="option"][data-value="${value}"]`)),
  );

/**
 * Get the labels of the listed items.
 * @param {HTMLElement} container Container.
 * @returns {(string | undefined)[]} Labels.
 */
const getLabels = (container) =>
  [...container.querySelectorAll('[role="option"]')].map((el) =>
    el.querySelector('.name')?.textContent?.replace(/\s+/g, ' ').trim(),
  );

describe('AssetsPanel', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
  });

  test('lists the assets with their paths relative to the base folder', async () => {
    const { container } = await render(AssetsPanel, {
      assets,
      basePath: 'static/uploads',
      gridId: 'grid',
    });

    await expect
      .poll(() => getLabels(container))
      .toEqual(['photo.png', 'brand/logo.png', 'new.png']);
    await expect.element(page.getByRole('listbox')).toHaveAttribute('id', 'grid');
    // An unsaved asset is identified by its blob URL, and marked as such
    expect(
      container.querySelector('[data-value="blob:http://localhost/new"] .unsaved'),
    ).toHaveTextContent('Unsaved');
  });

  test('filters the assets by search terms', async () => {
    // The terms are normalized by the dialog
    const props = $state({ assets, basePath: 'static/uploads', searchTerms: 'logo' });
    const { container } = await render(AssetsPanel, props);

    await expect.poll(() => getLabels(container)).toEqual(['brand/logo.png']);

    props.searchTerms = 'brand png';
    await expect.poll(() => getLabels(container)).toEqual(['brand/logo.png']);

    props.searchTerms = 'missing';
    await expect.element(page.getByText('No files found.')).toBeInTheDocument();
  });

  test('selects a single asset', async () => {
    const onSelect = vi.fn();
    const props = $state({ assets, selectedResources: [], onSelect });

    await render(AssetsPanel, props);
    await expect.poll(() => page.getByRole('option').elements().length).toBe(3);
    await sleep(150);

    // The listed asset carries its relative path and key
    /**
     * Match the listed asset at the given index.
     * @param {number} index Index.
     * @returns {any} Matcher.
     */
    const listedAsset = (index) =>
      expect.objectContaining({ path: assets[index].path, relPath: assets[index].name });

    await getOption(assets[1].path).click();
    await expect.poll(() => props.selectedResources).toEqual([{ asset: listedAsset(1) }]);
    expect(onSelect).toHaveBeenCalledWith({ asset: listedAsset(1) });

    // Another selection replaces the previous one
    await getOption(assets[0].path).click();
    await expect.poll(() => props.selectedResources).toEqual([{ asset: listedAsset(0) }]);
  });

  test('selects multiple assets, keeping the other resources', async () => {
    const props = $state({
      assets,
      multiple: true,
      selectedResources: [{ url: 'https://example.com/x.png' }],
    });

    await render(AssetsPanel, props);
    await expect.poll(() => page.getByRole('option').elements().length).toBe(3);
    await sleep(150);

    /**
     * Get the URLs or paths of the selected resources.
     * @returns {string[]} URLs or paths.
     */
    const getSelection = () =>
      props.selectedResources.map((/** @type {any} */ r) => r.url ?? r.asset.path);

    await getOption(assets[1].path).click();
    await getOption(assets[0].path).click();
    await expect
      .poll(getSelection)
      .toEqual(['https://example.com/x.png', assets[1].path, assets[0].path]);

    await getOption(assets[1].path).click();
    await expect.poll(getSelection).toEqual(['https://example.com/x.png', assets[0].path]);
  });

  test('marks the preselected assets', async () => {
    const { container } = await render(AssetsPanel, {
      assets,
      selectedResources: [{ asset: assets[0] }],
    });

    await expect.poll(() => page.getByRole('option').elements().length).toBe(3);
    await expect.element(getOption(assets[0].path)).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
  });

  test('hides the paths on a small screen in the grid view', async () => {
    env.isSmallScreen = true;

    const { container } = await render(AssetsPanel, { assets: [assets[0]] });

    await expect.element(page.getByRole('option')).toBeInTheDocument();
    expect(container.querySelector('.name')).toBeNull();

    const listView = await render(AssetsPanel, { assets: [assets[0]], viewType: 'list' });

    await expect.poll(() => getLabels(listView.container)).toEqual(['photo.png']);
  });

  test('marks an unsaved asset next to its path in the list view', async () => {
    const { container } = await render(AssetsPanel, { assets, viewType: 'list' });

    await expect
      .poll(() =>
        container.querySelector('[data-value="blob:http://localhost/new"] .name .unsaved'),
      )
      .not.toBeNull();
  });

  test('lists nothing without assets', async () => {
    const { container } = await render(AssetsPanel, {});

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });
});
