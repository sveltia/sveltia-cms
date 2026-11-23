import {
  markdown,
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditPane, openEntry, save, showLocale } from './helpers.js';

/**
 * The About page’s English file has a translation key, as a site generator may add, which the
 * French and Arabic files don’t have.
 */
const ABOUT_EN = markdown({ translationKey: 'about-page', title: 'About Us' }, 'We travel slowly.');

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({ ...MULTILINGUAL_FILES, 'content/pages/about.en.md': ABOUT_EN });
  await cms.signIn();
});

test('links the locales of a page by its name, whatever their translation keys', async ({
  cms,
  page,
}) => {
  await openEntry(page, 'Pages', 'About Page');

  // The files used to be split into two entries by the translation key, and the page opened with
  // its English content missing, as if disabled
  await expect(getEditPane(page, 'English').getByRole('textbox', { name: 'Title' })).toHaveValue(
    'About Us',
  );

  const french = await showLocale(page, 1, 'French');

  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('À propos');
  await expect(french.getByRole('textbox', { name: 'Body' })).toHaveText(
    'Nous voyageons lentement.',
  );
  await french.getByRole('textbox', { name: 'Title' }).fill('Qui sommes-nous');
  await save(page);

  const files = await cms.readRepo();

  expect(files['content/pages/about.fr.md']).toBe(
    markdown({ title: 'Qui sommes-nous' }, 'Nous voyageons lentement.'),
  );
  expect(files['content/pages/about.en.md']).toBe(ABOUT_EN);
  expect(files['content/pages/about.ar.md']).toBe(MULTILINGUAL_FILES['content/pages/about.ar.md']);
});
