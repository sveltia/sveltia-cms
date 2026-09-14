import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { env } from '$lib/services/user/env.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import LocaleSwitcher from './locale-switcher.svelte';

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr', 'de'],
  initialLocales: ['en', 'fr', 'de'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the switcher.
 * @param {Record<string, any>} [options] Options.
 * @returns {Promise<{ draft: any, thisPane: any, thatPane: any }>} Draft and panes.
 */
const renderSwitcher = async ({
  i18nConfig = i18n,
  thisPane = createRawState(/** @type {any} */ ({ mode: 'edit', locale: 'en' })),
  thatPane = createRawState(/** @type {any} */ ({ mode: 'preview', locale: 'en' })),
  draftProps = {},
} = {}) => {
  const draft = createMockDraft({
    i18n: i18nConfig,
    values: Object.fromEntries(
      i18nConfig.allLocales.map((/** @type {string} */ locale) => [locale, {}]),
    ),
    draft: draftProps,
  });

  await renderWithDraft(LocaleSwitcher, {
    draft,
    props: { id: 'pane-1-header', thisPane, thatPane },
  });

  return { draft, thisPane, thatPane };
};

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    entryEditorSettings.current = { ...entryEditorSettings.current, showPreview: true };
  });

  test('offers the locales as buttons on a large screen', async () => {
    const { thisPane, thatPane } = await renderSwitcher();
    const group = page.getByRole('radiogroup', { name: 'Switch Locale' });

    await expect.element(group).toHaveAttribute('aria-controls', 'pane-1-body');
    expect(
      group
        .getByRole('radio')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['English', 'French', 'German']);
    await expect.element(group.getByRole('radio', { name: 'English' })).toBeChecked();

    await sleep(150);
    await group.getByRole('radio', { name: 'French' }).click();
    expect(thisPane.current).toEqual({ mode: 'edit', locale: 'fr' });
    // The preview pane follows
    expect(thatPane.current).toEqual({ mode: 'preview', locale: 'fr' });
  });

  test('leaves out the locale edited in the other pane, offering the preview instead', async () => {
    const { thisPane } = await renderSwitcher({
      thisPane: createRawState({ mode: 'edit', locale: 'fr' }),
      thatPane: createRawState({ mode: 'edit', locale: 'en' }),
    });

    const group = page.getByRole('radiogroup');

    expect(
      group
        .getByRole('radio')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['French', 'German', 'Preview']);

    await sleep(150);
    await group.getByRole('radio', { name: 'Preview' }).click();
    expect(thisPane.current).toEqual({ mode: 'preview', locale: 'en' });
  });

  test('marks the disabled and invalid locales', async () => {
    await renderSwitcher({
      draftProps: {
        currentLocales: { en: true, fr: false, de: true },
        validities: { en: {}, fr: {}, de: { title: { valid: false } } },
      },
    });

    const group = page.getByRole('radiogroup');

    await expect
      .element(group.getByRole('radio', { name: 'French (disabled)' }))
      .toBeInTheDocument();
    await expect.element(group.getByRole('radio', { name: 'German (error)' })).toHaveClass('error');
  });

  test('uses a drop-down on a small screen', async () => {
    env.isSmallScreen = true;

    const { thisPane } = await renderSwitcher({
      thatPane: createRawState({ mode: 'edit', locale: 'en' }),
      draftProps: { validities: { en: {}, fr: {}, de: { title: { valid: false } } } },
    });

    const select = page.getByRole('combobox', { name: 'Switch Locale' });

    await expect.element(select).toHaveTextContent('English');
    expect(select.element().closest('.sui.select')).toHaveClass('error');

    await select.click();
    await sleep(150);

    // Every locale is listed, as the other pane is hidden on a small screen
    const options = page.getByRole('option');

    // The selected option has a check icon
    expect(options.elements().map((el) => el.textContent?.trim().replace(/\s*check$/, ''))).toEqual(
      ['English', 'French', 'error German', 'Preview'],
    );

    await page.getByRole('option', { name: 'German (error)' }).click();
    expect(thisPane.current).toEqual({ mode: 'edit', locale: 'de' });
  });

  test('uses a drop-down for many locales', async () => {
    await renderSwitcher({
      i18nConfig: {
        ...i18n,
        allLocales: ['en', 'fr', 'de', 'es', 'it'],
        initialLocales: ['en', 'fr', 'de', 'es', 'it'],
      },
    });

    await expect.element(page.getByRole('combobox', { name: 'Switch Locale' })).toBeInTheDocument();
  });

  test('names a locale by its code when it has no label, and selects nothing without a pane', async () => {
    const i18nConfig = { ...i18n, allLocales: ['en', 'fr_CA'], initialLocales: ['en', 'fr_CA'] };

    await renderSwitcher({ i18nConfig, thisPane: createRawState(null) });

    await expect.element(page.getByRole('radio', { name: 'fr_CA' })).toBeVisible();
    expect(page.getByRole('radio', { checked: true }).elements()).toHaveLength(0);
  });

  test('works without another pane', async () => {
    const { draft } = await renderSwitcher();
    const thisPane = createRawState(/** @type {any} */ ({ mode: 'edit', locale: 'en' }));

    await renderWithDraft(LocaleSwitcher, {
      draft,
      props: { id: 'pane-2-header', thisPane },
    });

    await expect.element(page.getByRole('radio', { name: 'French' }).nth(1)).toBeVisible();
  });
});
