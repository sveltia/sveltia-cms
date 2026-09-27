import { MULTILINGUAL_CONFIG, MULTILINGUAL_FILES } from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditor, openEntry, showLocale, watchSaveButton } from './helpers.js';

test.use({ config: MULTILINGUAL_CONFIG });

/**
 * Bodies in the style the rich text editor writes, and in one it reads fine but writes in another
 * style, as `rich-text.e2e.js` of the monolingual site checks in the default locale.
 */
const BODIES = {
  canonical: { fr: '_Commencez_ par les halles.', ar: '_ابدأ_ بالسوق المغطى.' },
  other: { fr: '*Commencez* par les halles.', ar: '*ابدأ* بالسوق المغطى.' },
};

/**
 * Seed the Lyon article with the given body in a locale.
 * @param {any} cms `cms` fixture.
 * @param {'fr' | 'ar'} locale Locale.
 * @param {string} body Body.
 */
const seedBody = async (cms, locale, body) => {
  const path = `content/articles/lyon.${locale}.md`;

  await cms.open();
  await cms.seed({
    ...MULTILINGUAL_FILES,
    [path]: MULTILINGUAL_FILES[path].replace(/\n\n.+\n$/, `\n\n${body}\n`),
  });
  await cms.signIn();
};

['fr', 'ar'].forEach((locale) => {
  const localeName = locale === 'fr' ? 'French' : 'Arabic';

  test(`keeps the ${localeName} body in the editor’s style unchanged`, async ({ cms, page }) => {
    await seedBody(cms, /** @type {'fr' | 'ar'} */ (locale), BODIES.canonical[locale]);
    await openEntry(page, 'Articles', /Lyon/);

    const pane = await showLocale(page, 1, localeName);

    await expect(pane.getByRole('textbox', { name: 'Body' }).locator('em')).toBeVisible();
    // There’s nothing to wait for when the body isn’t converted, so wait longer than that takes
    await page.waitForTimeout(1000);
    await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test(`keeps the ${localeName} body in another style unchanged until it’s edited`, async ({
    cms,
    page,
  }) => {
    const path = `content/articles/lyon.${locale}.md`;

    await seedBody(cms, /** @type {'fr' | 'ar'} */ (locale), BODIES.other[locale]);
    await openEntry(page, 'Articles', /Lyon/);

    const saveButtonEnabled = await watchSaveButton(page);
    const pane = await showLocale(page, 1, localeName);
    const save = getEditor(page).getByRole('button', { name: 'Save' });

    // Showing the body in the editor, which writes it in its own style, doesn’t count as a change,
    // not even for the moment the editor takes to convert it. There’s nothing to wait for when the
    // button stays disabled, so wait longer than the conversion takes
    await expect(pane.getByRole('textbox', { name: 'Body' }).locator('em')).toBeVisible();
    await page.waitForTimeout(1000);
    expect(await saveButtonEnabled()).toBe(false);

    // Saving another field leaves the body as it was
    await pane.getByRole('textbox', { name: 'Summary' }).fill('Résumé');
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
    expect((await cms.readRepo())[path]).toContain(`\n\n${BODIES.other[locale]}\n`);
  });
});
