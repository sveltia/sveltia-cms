import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Locator } from '@playwright/test';
 */

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

test.describe('absolute public folder of an entry-relative media folder', () => {
  // A site that keeps each entry’s images beside it, in a folder of its own, but serves them from a
  // path of its own, which is referred to with an absolute path rather than a relative one
  test.use({
    config: {
      backend: { name: 'test-repo' },
      media_folder: 'static/images',
      public_folder: '/images',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          path: '{{slug}}/index',
          create: true,
          media_folder: 'images',
          public_folder: '/blog/{{slug}}/images',
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'cover', label: 'Cover', widget: 'image', required: false },
          ],
        },
      ],
    },
  });

  /**
   * Wait for the image of a field thumbnail or the preview to be decoded, not a broken one.
   * @param {Locator} container Element holding the image.
   */
  const expectImageShown = async (container) => {
    // The image is decorative, with an empty `alt`, so it has no role
    const image = container.locator('img');

    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  };

  test('saves an uploaded image beside the entry and refers to it with an absolute path', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    let editor = getEditor(page);
    let cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });
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
      .poll(async () => (await cms.readRepo())['content/posts/kite/index.md'])
      .toBe('---\ntitle: Kite\ncover: /blog/kite/images/kite.png\n---\n');
    expect(await cms.readRepoFile('content/posts/kite/images/kite.png')).toEqual(kite);

    // The saved entry still shows the image it refers to
    await expect(editor).toBeHidden();
    await page.getByRole('row', { name: 'Kite' }).click();
    editor = getEditor(page);
    cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      '/blog/kite/images/kite.png',
    );
    await expectImageShown(cover);
    await expectImageShown(editor.getByRole('document', { name: 'Content Preview' }));
  });

  test('refers to an image picked from the entry’s folder with an absolute path', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.seed({
      'content/posts/hello/index.md': '---\ntitle: Hello\n---\n',
      'content/posts/hello/images/photo.png': createPNG({ color: [200, 100, 50] }),
    });
    await cms.signIn();
    await page.getByRole('row', { name: 'Hello' }).click();

    const editor = getEditor(page);
    const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

    await cover.getByRole('button', { name: 'Browse' }).click();

    const dialog = page.getByRole('dialog', { name: 'Select Image' });
    const option = dialog.getByRole('option', { name: 'photo.png' });

    await option.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog).toBeHidden();

    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      '/blog/hello/images/photo.png',
    );
    await expectImageShown(cover);
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/hello/index.md'])
      .toBe('---\ntitle: Hello\ncover: /blog/hello/images/photo.png\n---\n');
  });

  test('follows a renamed slug in an absolute path to an image beside the entry', async ({
    cms,
    page,
  }) => {
    const photo = createPNG({ color: [100, 200, 50] });

    await cms.open();
    await cms.seed({
      'content/posts/hello/index.md':
        '---\ntitle: Hello\ncover: /blog/hello/images/photo.png\n---\n',
      'content/posts/hello/images/photo.png': photo,
    });
    await cms.signIn();
    await page.getByRole('row', { name: 'Hello' }).click();

    let editor = getEditor(page);

    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitem', { name: 'Edit Slug' }),
    );

    const panel = page.getByRole('group', { name: 'Slug', exact: true });

    await panel.getByRole('button', { name: 'Edit Slug' }).click();
    await panel.getByRole('textbox', { name: 'Slug' }).fill('bye');
    await panel.getByRole('textbox', { name: 'Slug' }).press('Enter');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The value follows the slug, which the template in the public folder now gives
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/bye/index.md'])
      .toBe('---\ntitle: Hello\ncover: /blog/bye/images/photo.png\n---\n');
    // The image follows the entry to its new folder
    expect(await cms.readRepoFile('content/posts/bye/images/photo.png')).toEqual(photo);
    expect(Object.keys(await cms.readRepo())).not.toContain('content/posts/hello/index.md');

    // The renamed entry still shows the image it refers to
    await expect(editor).toBeHidden();
    await page.getByRole('row', { name: 'Hello' }).click();
    editor = getEditor(page);

    const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      '/blog/bye/images/photo.png',
    );
    await expectImageShown(cover);
    await expectImageShown(editor.getByRole('document', { name: 'Content Preview' }));
  });
});
