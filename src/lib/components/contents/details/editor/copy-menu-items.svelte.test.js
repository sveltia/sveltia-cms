import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { copyFromLocale } from '$lib/services/contents/draft/update/copy';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import CopyMenuItems from './copy-menu-items.svelte';

vi.mock('$lib/services/contents/draft/update/copy', () => ({
  getTurndownService: vi.fn(),
  getCopyingFieldMap: vi.fn(),
  updateToast: vi.fn(),
  translateFields: vi.fn(),
  copyFields: vi.fn(),
  copyFromLocale: vi.fn(),
}));

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr', 'de'],
  initialLocales: ['en', 'fr', 'de'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the items within a menu.
 * @param {Record<string, any>} props Props.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<any>} Draft.
 */
const renderItems = async (props, draftProps = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'title', widget: 'string' }],
    i18n,
    values: {
      en: { title: 'Hello' },
      fr: { title: 'Bonjour' },
      de: { title: '' },
    },
    draft: draftProps,
  });

  await renderWithDraft(CopyMenuItems, { draft, props });

  return draft;
};

describe('CopyMenuItems', () => {
  beforeEach(() => {
    prefs.defaultTranslationService = 'google';
  });

  test('offers to copy a field from the other locales', async () => {
    const draft = await renderItems({ locale: 'de', otherLocales: ['en', 'fr'], keyPath: 'title' });
    const items = page.getByRole('menuitem');

    await expect.poll(() => items.elements().length).toBe(2);
    expect(items.elements().map((el) => el.textContent?.trim())).toEqual([
      'Copy from \u2068English\u2069',
      'Copy from \u2068French\u2069',
    ]);

    await items.nth(1).click();
    expect(copyFromLocale).toHaveBeenCalledWith({
      draft,
      options: { sourceLanguage: 'fr', targetLanguage: 'de', keyPath: 'title', translate: false },
    });
  });

  test('disables copying from a locale with the same or no value', async () => {
    await renderItems(
      { locale: 'fr', otherLocales: ['en', 'de'], keyPath: 'title' },
      { currentValues: { en: { title: 'Bonjour' }, fr: { title: 'Bonjour' }, de: { title: '' } } },
    );

    await expect.poll(() => page.getByRole('menuitem').elements().length).toBe(2);
    await expect
      .element(page.getByRole('menuitem', { name: 'Copy from \u2068English\u2069' }))
      .toBeDisabled();
    await expect
      .element(page.getByRole('menuitem', { name: 'Copy from \u2068German\u2069' }))
      .toBeDisabled();
  });

  test('disables copying from or to a disabled locale', async () => {
    await renderItems(
      { locale: 'de', otherLocales: ['en', 'fr'] },
      { currentLocales: { en: true, fr: false, de: true } },
    );

    await expect.poll(() => page.getByRole('menuitem').elements().length).toBe(2);
    await expect
      .element(page.getByRole('menuitem', { name: 'Copy from \u2068English\u2069' }))
      .toBeEnabled();
    await expect
      .element(page.getByRole('menuitem', { name: 'Copy from \u2068French\u2069' }))
      .toBeDisabled();
  });

  test('offers to translate when the service supports the language pair', async () => {
    const draft = await renderItems({ locale: 'de', otherLocales: ['en', 'fr'], translate: true });
    const items = page.getByRole('menuitem');

    await expect.poll(() => items.elements().length).toBe(2);
    expect(items.elements().map((el) => el.textContent?.trim())).toEqual([
      'Translate from \u2068English\u2069',
      'Translate from \u2068French\u2069',
    ]);

    await items.nth(0).click();
    expect(copyFromLocale).toHaveBeenCalledWith({
      draft,
      options: { sourceLanguage: 'en', targetLanguage: 'de', keyPath: '', translate: true },
    });
  });

  test('groups the locales in a submenu', async () => {
    await renderItems({ locale: 'de', otherLocales: ['en', 'fr'], submenu: true });

    const parent = page.getByRole('menuitem', { name: 'Copy from…' });

    await expect.element(parent).toBeInTheDocument();
    expect(page.getByRole('menuitem').elements()).toHaveLength(1);

    await renderItems({ locale: 'de', otherLocales: ['en', 'fr'], submenu: true, translate: true });
    await expect
      .element(page.getByRole('menuitem', { name: 'Translate from…' }))
      .toBeInTheDocument();
  });

  test('lists a single locale directly', async () => {
    await renderItems({ locale: 'de', otherLocales: ['en'], submenu: true, translate: true });

    await expect
      .element(page.getByRole('menuitem', { name: 'Translate from \u2068English\u2069' }))
      .toBeInTheDocument();
  });
});
