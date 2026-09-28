import { expect, test } from '../../fixtures/test.js';

import { getEditor, getEditPane, showLocale } from './helpers.js';

/**
 * A multilingual blog whose posts have fields duplicated from English to French, on their own or
 * along with their Object field, next to translatable ones.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      extension: 'yml',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true, required: false },
        { name: 'tags', label: 'Tags', widget: 'list', i18n: 'duplicate', required: false },
        {
          name: 'links',
          label: 'Links',
          label_singular: 'Link',
          widget: 'list',
          i18n: 'duplicate',
          required: false,
          fields: [{ name: 'url', label: 'URL' }],
        },
        {
          name: 'venue',
          label: 'Venue',
          widget: 'object',
          i18n: 'duplicate',
          fields: [
            { name: 'name', label: 'Name', required: false },
            { name: 'rooms', label: 'Rooms', widget: 'list', required: false },
          ],
        },
      ],
    },
  ],
};

/**
 * Get the content of a post file.
 * @param {string} title Title.
 * @param {string} rest The rest of the file.
 * @returns {string} File content.
 */
const getPost = (title, rest) => `title: ${title}\n${rest}`;

const VALUES =
  'tags:\n  - a\n  - b\nlinks:\n  - url: https://example.com\n' +
  'venue:\n  name: Hall\n  rooms:\n    - r1\n';

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    'content/posts/hello.en.yml': getPost('Hello', VALUES),
    'content/posts/hello.fr.yml': getPost('Bonjour', VALUES),
  });
  await cms.signIn();
  await page.getByRole('row', { name: /Hello/ }).click();
  await expect(getEditPane(page, 'English').getByRole('group', { name: /Venue/ })).toBeVisible();
});

test('shows the duplicated values read-only in another locale', async ({ page }) => {
  const french = await showLocale(page, 1, 'French');
  const links = french.getByRole('group', { name: /Links.*Field/ });
  const venue = french.getByRole('group', { name: /Venue.*Field/ });

  // The subfields duplicated along with their Object or List field are shown, not left out
  await expect(links.getByRole('textbox', { name: 'URL' })).toHaveValue('https://example.com');
  await expect(venue.getByRole('textbox', { name: 'Name' })).toHaveValue('Hall');
  await expect(venue.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
    'aria-readonly',
    'true',
  );
  // Removing a duplicated item there would remove it from English as well
  await expect(links.getByRole('button', { name: 'Remove' })).toBeDisabled();
});

test('clears the duplicated values in every locale', async ({ cms, page }) => {
  const english = getEditPane(page, 'English');

  /**
   * Clear a field from its options menu.
   * @param {RegExp} name Name of the field group.
   */
  const clear = async (name) => {
    await cms.chooseMenuItem(
      english
        .getByRole('group', { name })
        .getByRole('button', { name: 'Show Field Options' })
        .first(),
      page.getByRole('menuitem', { name: 'Clear' }),
    );
  };

  await clear(/Tags.*Field/);
  await clear(/Links.*Field/);
  await clear(/Venue.*Field/);

  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  const cleared = "tags: []\nlinks: []\nvenue:\n  name: ''\n  rooms: []\n";

  await expect
    .poll(async () => {
      const files = await cms.readRepo();

      return [files['content/posts/hello.en.yml'], files['content/posts/hello.fr.yml']];
    })
    .toEqual([getPost('Hello', cleared), getPost('Bonjour', cleared)]);
});

test('clears the fields in a locale after confirmation', async ({ cms, page }) => {
  const french = await showLocale(page, 1, 'French');

  await cms.chooseMenuItem(
    page.getByRole('button', { name: /Show.*French.*Content Options/ }),
    page.getByRole('menuitem', { name: 'Clear All' }),
  );

  const dialog = page.getByRole('alertdialog');

  await expect(dialog).toContainText('clear all the fields in the \u2068French\u2069 content');
  await dialog.getByRole('button', { name: 'Clear All' }).click();
  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // Only the translatable field changes: the duplicated ones follow English
  await expect
    .poll(async () => {
      const files = await cms.readRepo();

      return [files['content/posts/hello.en.yml'], files['content/posts/hello.fr.yml']];
    })
    .toEqual([getPost('Hello', VALUES), getPost("''", VALUES)]);
});
