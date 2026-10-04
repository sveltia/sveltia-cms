import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ViewMenuItems from './view-menu-items.svelte';

/**
 * Render the menu items.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<void>} Promise.
 */
const renderItems = async (draftProps = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'title', widget: 'string' }],
    values: { _default: { title: 'Hello' } },
    draft: { canPreview: true, ...draftProps },
  });

  await renderWithDraft(ViewMenuItems, { draft });
};

describe('ViewMenuItems', () => {
  beforeEach(() => {
    entryEditorSettings.current = { showSecondPane: true, showPreview: true, syncScrolling: true };
  });

  test('reflects the view settings', async () => {
    entryEditorSettings.current = { showSecondPane: true, showPreview: false, syncScrolling: true };

    await renderItems();

    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' }))
      .toBeChecked();
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Preview' }))
      .not.toBeChecked();
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeChecked();
  });

  test('disables the preview and the scroll syncing while the second pane is hidden', async () => {
    entryEditorSettings.current = { showSecondPane: false, showPreview: true, syncScrolling: true };

    await renderItems();

    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' }))
      .toBeEnabled();
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Preview' }))
      .toBeDisabled();
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeDisabled();
  });

  test('disables the second pane when there’s nothing to show in it', async () => {
    await renderItems({ canPreview: false });

    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' }))
      .toBeDisabled();
    // The preview isn’t shown, and there’s no other locale to sync the scrolling with
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeDisabled();
  });
});
