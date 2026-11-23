import { stringify } from 'yaml';

import { expect, test } from '../../fixtures/test.js';

import { getEditPane, openEntry, save, showLocale } from './helpers.js';

/**
 * A multilingual blog whose posts have a translatable List field of images, with a subfield using
 * the `duplicate_if_empty` i18n strategy. The items are paired across the locales, so the value is
 * copied to the item at the same position.
 * @see https://github.com/sveltia/sveltia-cms/issues/120
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'images',
          label: 'Images',
          widget: 'list',
          i18n: true,
          fields: [
            { name: 'src', label: 'Source', i18n: 'duplicate_if_empty' },
            { name: 'alt', label: 'Alt Text', i18n: true, required: false },
          ],
        },
      ],
    },
  ],
};

/**
 * Get the content of a post file.
 * @param {Record<string, any>} values Front matter values.
 * @returns {string} File content.
 */
const getPost = (values) => `---\n${stringify(values)}---\n`;

test.use({ config: CONFIG });

test('adds an item to every locale and fills in its empty values', async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    'content/posts/hello.en.md': getPost({
      title: 'Hello',
      images: [{ src: 'a.png', alt: 'A' }],
    }),
    'content/posts/hello.fr.md': getPost({
      title: 'Bonjour',
      images: [{ src: '', alt: 'Ah' }],
    }),
  });
  await cms.signIn();
  await openEntry(page, 'Posts', /Hello/);

  const english = getEditPane(page, 'English');
  const french = await showLocale(page, 1, 'French');
  const englishImages = english.getByRole('group', { name: /Images.*Field/ });
  const frenchImages = french.getByRole('group', { name: /Images.*Field/ });

  await expect(frenchImages.getByRole('textbox', { name: 'Source' })).toHaveValue('a.png');
  // The items are added in the default locale only
  await expect(frenchImages.getByRole('button', { name: /Add.*Images/ })).toBeDisabled();

  await englishImages.getByRole('button', { name: /Add.*Images/ }).click();
  await expect(frenchImages.getByRole('textbox', { name: 'Source' })).toHaveCount(2);
  await englishImages.getByRole('textbox', { name: 'Source' }).nth(1).fill('b.png');
  await englishImages.getByRole('textbox', { name: 'Alt Text' }).nth(1).fill('B');
  await expect(frenchImages.getByRole('textbox', { name: 'Source' }).nth(1)).toHaveValue('b.png');
  await expect(frenchImages.getByRole('textbox', { name: 'Alt Text' }).nth(1)).toHaveValue('');
  await save(page);

  const files = await cms.readRepo();

  expect(files['content/posts/hello.en.md']).toBe(
    getPost({
      title: 'Hello',
      images: [
        { src: 'a.png', alt: 'A' },
        { src: 'b.png', alt: 'B' },
      ],
    }),
  );
  // The empty string is written the way the CMS writes it, with single quotes
  expect(files['content/posts/hello.fr.md']).toBe(
    [
      '---',
      'title: Bonjour',
      'images:',
      '  - src: a.png',
      '    alt: Ah',
      '  - src: b.png',
      "    alt: ''",
      '---',
      '',
    ].join('\n'),
  );
});
