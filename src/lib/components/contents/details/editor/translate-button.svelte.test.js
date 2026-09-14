import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { copyFromLocale } from '$lib/services/contents/draft/update/copy';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import TranslateButton from './translate-button.svelte';

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
 * Render the button.
 * @param {Record<string, any>} props Props.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<any>} Draft.
 */
const renderButton = async (props, draftProps = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'title', widget: 'string' }],
    i18n,
    values: { en: { title: 'Hello' }, fr: { title: '' }, de: { title: '' } },
    draft: draftProps,
  });

  await renderWithDraft(TranslateButton, { draft, props });

  return draft;
};

describe('TranslateButton', () => {
  beforeEach(() => {
    prefs.defaultTranslationService = 'google';
  });

  test('translates from the only other locale at once', async () => {
    const draft = await renderButton({ locale: 'fr', otherLocales: ['en'], keyPath: 'title' });
    const button = page.getByRole('button', { name: 'Translate from \u2068English\u2069' });

    await expect.element(button).toBeEnabled();
    await button.click();

    expect(copyFromLocale).toHaveBeenCalledWith({
      draft,
      options: { sourceLanguage: 'en', targetLanguage: 'fr', keyPath: 'title', translate: true },
    });
  });

  test('names a locale by its code when it has no label', async () => {
    await renderButton({ locale: 'fr', otherLocales: ['en_US'], keyPath: 'title' });

    await expect
      .element(page.getByRole('button', { name: 'Translate from \u2068en_US\u2069' }))
      .toBeInTheDocument();
  });

  test('offers a menu for multiple source locales', async () => {
    await renderButton({ locale: 'de', otherLocales: ['en', 'fr'] });

    await page.getByRole('button', { name: 'Translate' }).click();
    await sleep(150);

    const menu = page.getByRole('menu', { name: 'Translation Options' });

    await expect.poll(() => menu.getByRole('menuitem').elements().length).toBe(2);
    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Translate from \u2068English\u2069', 'Translate from \u2068French\u2069']);
  });

  test('is disabled when the target locale is disabled or the source is unavailable', async () => {
    await renderButton(
      { locale: 'fr', otherLocales: ['en'] },
      { currentLocales: { en: true, fr: false, de: true } },
    );
    await expect
      .element(page.getByRole('button', { name: 'Translate from \u2068English\u2069' }))
      .toBeDisabled();

    await renderButton(
      { locale: 'de', otherLocales: ['en', 'fr'] },
      { currentLocales: { en: true, fr: true, de: false } },
    );
    await expect.element(page.getByRole('button', { name: 'Translate' })).toBeDisabled();
  });

  test('is disabled for an entry awaiting deletion', async () => {
    await renderButton(
      { locale: 'fr', otherLocales: ['en'] },
      { originalEntry: { workflow: { status: 'pending_deletion' } } },
    );

    await expect
      .element(page.getByRole('button', { name: 'Translate from \u2068English\u2069' }))
      .toBeDisabled();
  });
});
