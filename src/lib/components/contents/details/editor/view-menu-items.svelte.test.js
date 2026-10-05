import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ViewMenuItems from './view-menu-items.svelte';

/**
 * Render the menu items.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @param {object} [options] Options.
 * @param {string[]} [options.locales] Locales of a localized collection. The collection isn’t
 * localized when omitted.
 * @returns {Promise<void>} Promise.
 */
const renderItems = async (draftProps = {}, { locales } = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'title', widget: 'string' }],
    ...(locales
      ? {
          i18n: { i18nEnabled: true, allLocales: locales, defaultLocale: locales[0] },
          values: Object.fromEntries(locales.map((locale) => [locale, { title: 'Hello' }])),
        }
      : { values: { _default: { title: 'Hello' } } }),
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

  test('enables the second pane for another locale when there’s no preview', async () => {
    await renderItems({ canPreview: false }, { locales: ['en', 'fr'] });

    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' }))
      .toBeEnabled();
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Preview' }))
      .toBeDisabled();
    // The scrolling can be synced with the other locale
    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeEnabled();
  });

  test('disables the second pane for a single locale when there’s no preview', async () => {
    await renderItems({ canPreview: false }, { locales: ['en'] });

    await expect
      .element(page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' }))
      .toBeDisabled();
  });
});
