import { expect, test } from '../../fixtures/test.js';

import { openCollection } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Date-only DateTime field, which has no time zone, so its date tags are the same wherever the
 * editor is.
 * @param {string} name Field name.
 * @param {string} label Field label.
 * @returns {Record<string, any>} Field.
 */
const dateField = (name, label) => ({
  name,
  label,
  widget: 'datetime',
  time_format: false,
  format: 'YYYY-MM-DD',
  required: false,
});

/**
 * Sizes and colours offered by the Select fields of a product.
 */
const SIZES = [
  { label: 'Small', value: 'S' },
  { label: 'Medium', value: 'M' },
  { label: 'Large', value: 'L' },
  { label: 'Extra Large', value: 'XL' },
];

const COLOURS = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
  { label: 'Black', value: 'black' },
];

/**
 * A garden shop with the options that only change how a collection or a field is shown: a blog
 * with an icon, a description and a live site path dated by its second DateTime field, notes dated
 * by their only one, products whose Select fields with the same options are shown as radio buttons
 * or checkboxes under their `dropdown_threshold` and as a dropdown above it, and a file collection
 * with an icon for one of its files.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  site_url: 'https://www.example.com',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      icon: 'edit_note',
      description:
        'Stories from the **garden**, with [an archive](https://www.example.com/archive).' +
        '<img src="https://www.example.com/tracker.png">',
      preview_path: 'blog/{{year}}/{{month}}/{{slug}}',
      preview_path_date_field: 'published',
      fields: [
        { name: 'title', label: 'Title' },
        dateField('updated', 'Updated'),
        dateField('published', 'Published'),
        { name: 'body', label: 'Body', widget: 'text', required: false },
      ],
    },
    {
      name: 'notes',
      label: 'Notes',
      label_singular: 'Note',
      folder: 'content/notes',
      preview_path: 'notes/{{year}}/{{slug}}',
      fields: [{ name: 'title', label: 'Title' }, dateField('date', 'Date')],
    },
    {
      name: 'products',
      label: 'Products',
      label_singular: 'Product',
      folder: 'content/products',
      extension: 'yml',
      fields: [
        { name: 'title', label: 'Title' },
        // As many options as the threshold: radio buttons
        { name: 'size', label: 'Size', widget: 'select', options: SIZES, dropdown_threshold: 4 },
        // More options than the threshold: a dropdown
        { name: 'fit', label: 'Fit', widget: 'select', options: SIZES, dropdown_threshold: 3 },
        // The “(None)” option of an optional field counts towards the threshold
        {
          name: 'finish',
          label: 'Finish',
          widget: 'select',
          options: ['matte', 'gloss', 'satin'],
          dropdown_threshold: 3,
          required: false,
        },
        {
          name: 'colours',
          label: 'Colours',
          widget: 'select',
          multiple: true,
          options: COLOURS,
          dropdown_threshold: 4,
        },
        {
          name: 'trims',
          label: 'Trims',
          widget: 'select',
          multiple: true,
          options: COLOURS,
          dropdown_threshold: 3,
        },
      ],
    },
    {
      name: 'settings',
      label: 'Settings',
      files: [
        {
          name: 'site',
          label: 'Site',
          file: 'content/settings/site.yml',
          icon: 'tune',
          fields: [{ name: 'title', label: 'Title' }],
        },
        {
          name: 'menu',
          label: 'Menu',
          file: 'content/settings/menu.yml',
          fields: [{ name: 'title', label: 'Title' }],
        },
      ],
    },
  ],
};

/**
 * Repository files for {@link CONFIG}: a post updated long after it was published, a note with a
 * date and one without.
 */
const FILES = {
  'content/posts/spring-planting.md':
    '---\ntitle: Spring Planting\nupdated: 2026-09-30\npublished: 2025-03-14\nbody: Sow early.\n---\n',
  'content/notes/frost-warning.md': '---\ntitle: Frost Warning\ndate: 2024-11-20\n---\n',
  'content/notes/undated-idea.md': '---\ntitle: Undated Idea\n---\n',
  'content/settings/site.yml': 'title: Garden Shop\n',
  'content/settings/menu.yml': 'title: Main Menu\n',
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // Never reach the live site
  await page
    .context()
    .route('https://www.example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Live site</title>' }),
    );

  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

/**
 * Get a collection in the sidebar.
 * @param {Page} page Page.
 * @param {string} name Collection label.
 * @returns {Locator} Tree item.
 */
const getTreeItem = (page, name) =>
  page
    .getByRole('tree', { name: 'Collection List' })
    .getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });

/**
 * Click a control and get the URL of the tab it opens.
 * @param {Page} page Page.
 * @param {Locator} button Control.
 * @returns {Promise<string>} URL.
 */
const getOpenedURL = async (page, button) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()]);

  await popup.waitForLoadState();

  const url = popup.url();

  await popup.close();

  return url;
};

test.describe('icon and description', () => {
  test('shows the icon of a collection in the sidebar, or the default one', async ({ page }) => {
    await expect(getTreeItem(page, 'Posts').locator('.icon').first()).toHaveText('edit_note');
    await expect(getTreeItem(page, 'Notes').locator('.icon').first()).toHaveText(
      'bookmark_manager',
    );
  });

  test('shows the icon of a file in a file collection, and none for a file without one', async ({
    page,
  }) => {
    const collection = await openCollection(page, 'Settings');
    const files = collection.getByRole('grid', { name: 'Files' });

    await expect(files.getByRole('row', { name: /Site/ }).locator('.icon')).toHaveText('tune');
    await expect(files.getByRole('row', { name: /Menu/ })).toBeVisible();
    await expect(files.getByRole('row', { name: /Menu/ }).locator('.icon')).toHaveCount(0);
  });

  test('shows the description of a collection with its inline Markdown', async ({ page }) => {
    const collection = await openCollection(page, 'Posts');
    const toolbar = collection.getByRole('toolbar', { name: 'Collection' });

    await expect(toolbar).toContainText('Stories from the garden, with an archive.');
    await expect(toolbar.locator('strong')).toHaveText('garden');
    await expect(toolbar.getByRole('link', { name: 'an archive' })).toHaveAttribute(
      'href',
      'https://www.example.com/archive',
    );
    // HTML other than what inline Markdown makes is removed
    await expect(toolbar.locator('img')).toHaveCount(0);

    // A collection without a description shows none
    const notes = await openCollection(page, 'Notes');

    await expect(notes.getByRole('toolbar', { name: 'Collection' })).not.toContainText('Stories');
  });
});

test.describe('preview path with dates', () => {
  test('takes the date tags from the field named by `preview_path_date_field`', async ({
    cms,
    page,
  }) => {
    await openCollection(page, 'Posts');
    await page.getByRole('row', { name: /Spring Planting/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const button = editor.getByRole('button', { name: 'View on Live Site' });

    // From Published, not Updated, the first DateTime field, nor today
    expect(await getOpenedURL(page, button)).toBe(
      'https://www.example.com/blog/2025/03/spring-planting',
    );

    // The link follows the saved date, once the entry is opened again
    await editor.getByRole('textbox', { name: 'Published' }).fill('2025-11-02');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/spring-planting.md'])
      .toContain('published: 2025-11-02');
    // Saving goes back to the list
    await page.getByRole('row', { name: /Spring Planting/ }).click();
    expect(await getOpenedURL(page, button)).toBe(
      'https://www.example.com/blog/2025/11/spring-planting',
    );
  });

  test('takes the date tags from the first DateTime field by default', async ({ page }) => {
    await openCollection(page, 'Notes');
    await page.getByRole('row', { name: /Frost Warning/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    expect(
      await getOpenedURL(page, editor.getByRole('button', { name: 'View on Live Site' })),
    ).toBe('https://www.example.com/notes/2024/frost-warning');
  });

  test('offers no live page for an entry without a date to fill the tags with', async ({
    page,
  }) => {
    await openCollection(page, 'Notes');
    await page.getByRole('row', { name: /Undated Idea/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Undated Idea');
    await expect(editor.getByRole('button', { name: 'View on Live Site' })).toHaveCount(0);
  });
});

test.describe('dropdown threshold', () => {
  test('shows the options as buttons up to the threshold and as a dropdown above it', async ({
    cms,
    page,
  }) => {
    const collection = await openCollection(page, 'Products');

    await collection.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Title' }).fill('Apron');

    // Single selection: radio buttons, or a dropdown
    await editor
      .getByRole('radiogroup', { name: 'Size' })
      .getByRole('radio', { name: 'Medium' })
      .click();
    await expect(editor.getByRole('combobox', { name: 'Size' })).toHaveCount(0);
    await expect(editor.getByRole('radiogroup', { name: 'Fit' })).toHaveCount(0);
    await cms.chooseMenuItem(
      editor.getByRole('combobox', { name: 'Fit' }),
      page.getByRole('option', { name: 'Medium' }),
    );

    // An optional field with as many options as the threshold has a fourth one to clear it, so
    // it’s a dropdown too
    await expect(editor.getByRole('radiogroup', { name: 'Finish' })).toHaveCount(0);
    await cms.chooseMenuItem(
      editor.getByRole('combobox', { name: 'Finish' }),
      page.getByRole('option', { name: 'gloss' }),
    );

    // Multiple selection: checkboxes, or a dropdown listing the chosen options
    const colours = editor.getByRole('group', { name: 'Colours', exact: true });

    await colours.getByRole('checkbox', { name: 'Red' }).check();
    await colours.getByRole('checkbox', { name: 'Blue' }).check();
    await expect(editor.getByRole('combobox', { name: 'Colours' })).toHaveCount(0);

    const trims = editor.getByRole('combobox', { name: 'Trims' });

    await cms.chooseMenuItem(trims, page.getByRole('option', { name: 'Red' }));
    await cms.chooseMenuItem(trims, page.getByRole('option', { name: 'Blue' }));

    // Either way, the same values are saved
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/products/apron.yml'])
      .toBe(
        [
          'title: Apron',
          'size: M',
          'fit: M',
          'finish: gloss',
          'colours:',
          '  - red',
          '  - blue',
          'trims:',
          '  - red',
          '  - blue',
          '',
        ].join('\n'),
      );
  });
});
