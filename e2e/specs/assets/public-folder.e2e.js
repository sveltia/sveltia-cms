import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

/**
 * Blog with an empty site-level `public_folder`, which falls back to the `media_folder` path
 * rather than saving bare file names as Netlify/Decap CMS does.
 */
const CONFIG = {
  ...BASE_CONFIG,
  public_folder: '',
  collections: [
    {
      ...BASE_CONFIG.collections[0],
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('warns about an empty public folder and saves the media folder path', async ({
  cms,
  page,
}) => {
  /** @type {string[]} */
  const warnings = [];

  page.on('console', (message) => {
    if (message.type() === 'warning') {
      warnings.push(message.text());
    }
  });

  await cms.open();
  await cms.signIn();

  // The warning is logged to the console when the config is loaded
  expect(warnings).toContain(
    'The `public_folder` option is an empty string, so the `media_folder` path is used for the ' +
      'asset paths saved in entries instead. Remove the option, or set it to the path you want ' +
      'to use, such as `/images`.',
  );

  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });
  const kite = createPNG({ color: [255, 255, 0] });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Kite');
  await cover
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'kite.png', mimeType: 'image/png', buffer: kite });
  await expect(cover.getByRole('button', { name: 'Replace Image' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  // The entry file is written last, after its assets
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/kite.md'])
    .toBe('---\ntitle: Kite\ncover: /static/images/kite.png\n---\n');
  expect(await cms.readRepoFile('static/images/kite.png')).toEqual(kite);
});
