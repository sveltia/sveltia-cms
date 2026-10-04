import { stringify } from 'yaml';

import { expect, test } from '../../fixtures/test.js';

import { openEntry, save, showLocale } from './helpers.js';

/**
 * A multilingual site whose tours have a List field of stops duplicated to every locale, along with
 * the subfields, which have no `i18n` option of their own.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'tours',
      label: 'Tours',
      label_singular: 'Tour',
      folder: 'content/tours',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'stops',
          label: 'Stops',
          widget: 'list',
          i18n: 'duplicate',
          fields: [
            { name: 'place', label: 'Place' },
            { name: 'minutes', label: 'Minutes', widget: 'number' },
          ],
        },
      ],
    },
  ],
};

/**
 * Get the content of a tour file.
 * @param {string} title Title.
 * @returns {string} File content.
 */
const getTour = (title) =>
  `---\n${stringify({
    title,
    stops: [
      { place: 'Cathedral', minutes: 30 },
      { place: 'Market', minutes: 45 },
    ],
  })}---\n`;

test.use({ config: CONFIG });

test('keeps the duplicated subfields in a locale enabled for an entry', async ({ cms, page }) => {
  await cms.open();
  // The tour has been saved in the default locale only
  await cms.seed({
    'content/tours/old-town.en.md': getTour('Old Town'),
  });
  await cms.signIn();
  await openEntry(page, 'Tours', /Old Town/);

  const french = await showLocale(page, 1, 'French');

  await french.getByRole('button', { name: /Enable.*French/ }).click();
  await french.getByRole('textbox', { name: 'Title' }).fill('Vieille ville');
  // The stops used to be left out of the French content, as their subfields aren’t localized
  await expect(french.getByRole('textbox', { name: 'Place' }).first()).toHaveValue('Cathedral');
  await save(page);

  expect((await cms.readRepo())['content/tours/old-town.fr.md']).toBe(getTour('Vieille ville'));
});
