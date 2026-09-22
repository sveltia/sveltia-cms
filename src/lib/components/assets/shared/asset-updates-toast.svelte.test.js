import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { assetUpdatesToast } from '$lib/services/assets/data';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { waitForToastsToHide } from '$lib/test/toast';

import AssetUpdatesToast from './asset-updates-toast.svelte';

describe('AssetUpdatesToast', () => {
  test('reports saved assets', async () => {
    await render(AssetUpdatesToast, {});

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, saved: true, count: 2 };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success 2 assets saved.');

    // The toast goes away on its own, resetting the state
    await waitForToastsToHide();
    expect(assetUpdatesToast.current.saved).toBe(false);

    // Saving with Editorial Workflow publishes the assets right away
    assetUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      saved: true,
      published: true,
      count: 1,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Asset saved and published.');
  }, 20000);

  test('reports a created folder', async () => {
    await render(AssetUpdatesToast, {});

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, folderCreated: true };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Folder created.');
    await waitForToastsToHide();
    expect(assetUpdatesToast.current.folderCreated).toBe(false);
  }, 15000);

  test('reports a renamed or deleted folder', async () => {
    await render(AssetUpdatesToast, {});

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, folderRenamed: true };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Folder renamed.');
    await waitForToastsToHide();

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, folderDeleted: true };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Folder deleted.');
    await waitForToastsToHide();
    expect(assetUpdatesToast.current.folderDeleted).toBe(false);
  }, 20000);

  test('reports a moved, renamed or deleted asset', async () => {
    await render(AssetUpdatesToast, {});

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, moved: true, count: 1 };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Asset moved.');
    await waitForToastsToHide();

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, renamed: true, count: 1 };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Asset renamed.');
    await waitForToastsToHide();

    assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, deleted: true, count: 3 };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success 3 assets deleted.');
    await waitForToastsToHide();
    expect(assetUpdatesToast.current.deleted).toBe(false);
  }, 30000);
});
