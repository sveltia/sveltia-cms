import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

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

  const editor = getEditor(page);
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

test.describe('template tags in an entry-relative public folder', () => {
  // An Astro-like site that keeps each entry’s images in a folder named after its slug, outside
  // the content folder, and refers to them with a path relative to the entry
  // @see https://github.com/sveltia/sveltia-cms/issues/1104
  test.use({
    config: {
      backend: { name: 'test-repo' },
      media_folder: 'public/images',
      public_folder: '/images',
      collections: [
        {
          name: 'realisations',
          label: 'Realisations',
          folder: 'content/realisations',
          media_folder: '/assets/realisations/{{slug}}',
          public_folder: '../../assets/realisations/{{slug}}',
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'cover', label: 'Cover', widget: 'image' },
          ],
        },
      ],
    },
  });

  test('shows an image referred to by a path with the resolved public folder', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.seed({
      'assets/realisations/my-project/photo-1.png': createPNG({ color: [200, 100, 50] }),
      'content/realisations/my-project.md':
        '---\ntitle: My Project\ncover: ../../assets/realisations/my-project/photo-1.png\n---\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: 'My Project' }).click();

    const field = getEditor(page).getByRole('group', { name: '“\u2068Cover\u2069” Field' });
    // The thumbnail is decorative, with an empty `alt`, so it has no role
    const thumbnail = field.locator('img');

    await expect(thumbnail).toBeVisible();
    // The image is found and decoded, not a broken one
    await expect.poll(() => thumbnail.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  });
});
