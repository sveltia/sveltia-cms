import { MULTILINGUAL_CONFIG, MULTILINGUAL_FILES } from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditor, openEntry, showLocale } from './helpers.js';

test.use({ config: MULTILINGUAL_CONFIG });

/**
 * Bodies in the style the rich text editor writes, and in one it reads fine but writes in another
 * style, as `rich-text.e2e.js` of the monolingual site checks.
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

  test(`counts showing the ${localeName} body in another style as a change (known issue)`, async ({
    cms,
    page,
  }) => {
    // Known issue: the editor writes the Markdown back in its own style as soon as it shows it, in
    // any locale, so the entry counts as changed once the locale is shown in a pane. A locale that
    // isn’t shown isn’t converted. Once it’s fixed, the Save button stays disabled after the locale
    // is shown: wait a second, as in the test above, and expect it to be disabled instead
    await seedBody(cms, /** @type {'fr' | 'ar'} */ (locale), BODIES.other[locale]);
    await openEntry(page, 'Articles', /Lyon/);

    const save = getEditor(page).getByRole('button', { name: 'Save' });

    await page.waitForTimeout(1000);
    await expect(save).toBeDisabled();

    const pane = await showLocale(page, 1, localeName);

    await expect(pane.getByRole('textbox', { name: 'Body' }).locator('em')).toBeVisible();
    await expect(save).toBeEnabled();
  });
});
