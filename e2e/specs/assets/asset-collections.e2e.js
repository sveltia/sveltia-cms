import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, listedAssets, openFolder } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * A site with asset collections next to the global media folder and a collection’s own: icons with
 * a label, an icon and a public folder; logos with neither, so their name and media folder are
 * used; an archive that is read-only; and one pointing at the global folder, which adds nothing.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  asset_collections: [
    {
      name: 'icons',
      label: 'Icons',
      icon: 'star',
      media_folder: 'static/icons',
      public_folder: '/icons',
    },
    { name: 'logos', media_folder: '/static/logos/' },
    {
      name: 'archive',
      label: 'Archive',
      media_folder: 'static/archive',
      public_folder: '/archive',
      readonly: true,
    },
    {
      name: 'uploads',
      label: 'Uploads',
      media_folder: 'static/uploads',
      public_folder: '/uploads',
    },
  ],
  collections: [
    {
      name: 'notes',
      label: 'Notes',
      label_singular: 'Note',
      folder: 'content/notes',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
      ],
    },
    {
      name: 'projects',
      label: 'Projects',
      folder: 'content/projects',
      media_folder: '/static/projects',
      public_folder: '/projects',
      fields: [{ name: 'title', label: 'Title' }],
    },
  ],
};

/**
 * Images in {@link FILES}, each with its own color so the CMS doesn’t merge them.
 */
const IMAGES = {
  sunset: createPNG({ color: [255, 128, 0] }),
  star: createPNG({ color: [255, 255, 0] }),
  heart: createPNG({ color: [255, 0, 64] }),
  acme: createPNG({ color: [0, 0, 128] }),
  old: createPNG({ color: [96, 96, 96] }),
  bridge: createPNG({ color: [128, 128, 128] }),
};

const FILES = {
  'static/uploads/sunset.png': IMAGES.sunset,
  'static/icons/star.png': IMAGES.star,
  'static/icons/heart.png': IMAGES.heart,
  'static/logos/acme.png': IMAGES.acme,
  'static/archive/old.png': IMAGES.old,
  'static/projects/bridge.png': IMAGES.bridge,
  'content/projects/bridge.md': '---\ntitle: Bridge\n---\n',
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

/**
 * Start a new note, fill in its title and open the Select Image dialog of its Cover field.
 * @param {Page} page Page.
 * @param {string} title Title.
 * @returns {Promise<{ editor: Locator, cover: Locator, dialog: Locator }>} Content editor, Cover
 * field group and Select Image dialog.
 */
const browseCover = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);
  await cover.getByRole('button', { name: 'Browse' }).click();

  return { editor, cover, dialog: page.getByRole('dialog', { name: 'Select Image' }) };
};

/**
 * Select an option in a list box of the Select Image dialog.
 * @param {Locator} option Option.
 */
const selectOption = async (option) => {
  await option.click();
  await expect(option).toHaveAttribute('aria-selected', 'true');
};

test('lists the asset collections after the other folders', async ({ page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();

  const folderList = page.getByRole('listbox', { name: 'Asset Folder List' });

  // The asset collections come last, in the order of the config, after a separator. The one
  // pointing at the global media folder isn’t listed, as the Global Assets folder covers it
  await expect(folderList).toMatchAriaSnapshot(`
    - option "All Assets (6 assets)"
    - option "Global Assets (1 asset)"
    - separator
    - option "Projects (1 asset)"
    - separator
    - option "Icons (2 assets)"
    - option "logos (1 asset)"
    - option "Archive (1 asset)"
  `);
  // An icon is a Material Symbols ligature hidden from assistive technology. A folder without an
  // icon of its own gets the default one
  await expect(folderList.getByRole('option', { name: /Icons/ }).locator('.icon')).toHaveText(
    'star',
  );
  await expect(folderList.getByRole('option', { name: /logos/ }).locator('.icon')).toHaveText(
    'folder',
  );

  await openFolder(page, /Icons/);
  await expect.poll(() => listedAssets(page)).toEqual(['heart.png', 'star.png']);
  await expect(page.getByRole('group', { name: 'Asset Info' })).toContainText('/static/icons');

  // Without a `public_folder`, the public path is the media folder, with a leading slash
  await openFolder(page, /logos/);
  await expect.poll(() => listedAssets(page)).toEqual(['acme.png']);
  await page.getByRole('row', { name: 'acme.png' }).click();
  await expect(page.getByRole('group', { name: 'Asset Info' })).toContainText(
    '/static/logos/acme.png',
  );
});

test('uploads files into an asset collection', async ({ cms, page }) => {
  const bell = createPNG({ color: [0, 200, 200] });

  await page.getByRole('radio', { name: 'Assets' }).click();
  await openFolder(page, /Icons/);
  await cms.dropFiles(page.getByRole('grid', { name: 'Assets' }), [
    { name: 'bell.png', buffer: bell },
  ]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await expect(dialog).toContainText('/static/icons');
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['bell.png', 'heart.png', 'star.png']);
  expect(await cms.readRepoFile('static/icons/bell.png')).toEqual(bell);
  await expect(page.getByRole('option', { name: 'Icons (3 assets)' })).toBeVisible();
});

test('keeps assets out of a read-only asset collection', async ({ page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await openFolder(page, /Archive/);

  await expect(page.getByRole('status').filter({ hasText: 'This folder' })).toHaveText(
    /This folder is read-only\. You can view its assets but cannot make any changes\./,
  );
  await expect(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();

  // The other asset collections are unaffected
  await openFolder(page, /Icons/);
  await expect(page.getByRole('button', { name: 'Upload New Assets' })).toBeEnabled();
});

test('picks an image from an asset collection in an Image field', async ({ cms, page }) => {
  const { editor, cover, dialog } = await browseCover(page, 'Badge');
  const locations = dialog.getByRole('listbox', { name: 'Locations' });

  // The asset collections are offered to every field, after its own folders, with their labels
  await expect(locations.getByRole('group', { name: 'Your Site' })).toMatchAriaSnapshot(`
    - text: Your Site
    - option "Global Assets" [selected]
    - option "Icons"
    - option "logos"
    - option "Archive"
  `);
  await selectOption(locations.getByRole('option', { name: 'Icons' }));

  const list = dialog.getByRole('listbox', { name: 'Available Images' });

  await expect(list.getByRole('option')).toHaveText(['heart.png', 'star.png']);
  await selectOption(list.getByRole('option', { name: 'star.png' }));
  await dialog.getByRole('button', { name: 'Insert' }).click();

  // The value is the asset collection’s public path
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/icons/star.png');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/badge.md'])
    .toBe('---\ntitle: Badge\ncover: /icons/star.png\n---\n');
});

test('picks an image from an asset collection without a public folder', async ({ cms, page }) => {
  const { editor, cover, dialog } = await browseCover(page, 'Brand');

  await selectOption(
    dialog.getByRole('listbox', { name: 'Locations' }).getByRole('option', { name: 'logos' }),
  );
  await selectOption(
    dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option', {
      name: 'acme.png',
    }),
  );
  await dialog.getByRole('button', { name: 'Insert' }).click();

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/static/logos/acme.png');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/brand.md'])
    .toBe('---\ntitle: Brand\ncover: /static/logos/acme.png\n---\n');
});

test('uploads an image into an asset collection from an Image field', async ({ cms, page }) => {
  const bell = createPNG({ color: [0, 200, 200] });
  const { editor, cover, dialog } = await browseCover(page, 'Bell');

  await selectOption(
    dialog.getByRole('listbox', { name: 'Locations' }).getByRole('option', { name: 'Icons' }),
  );

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    dialog.getByRole('button', { name: 'Upload' }).click(),
  ]);

  await chooser.setFiles([{ name: 'bell.png', mimeType: 'image/png', buffer: bell }]);
  await expect(
    dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option', {
      name: 'bell.png',
    }),
  ).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('button', { name: 'Insert' }).click();

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/icons/bell.png');
  // The file is only written when the entry is saved
  expect(await cms.readRepoFile('static/icons/bell.png')).toBeUndefined();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/bell.md'])
    .toBe('---\ntitle: Bell\ncover: /icons/bell.png\n---\n');
  expect(await cms.readRepoFile('static/icons/bell.png')).toEqual(bell);
  expect(await cms.readRepoFile('static/uploads/bell.png')).toBeUndefined();
});

test('keeps uploads out of a read-only asset collection in an Image field', async ({
  cms,
  page,
}) => {
  const { dialog } = await browseCover(page, 'Old');

  await selectOption(
    dialog.getByRole('listbox', { name: 'Locations' }).getByRole('option', { name: 'Archive' }),
  );
  // An existing image can still be picked
  await expect(
    dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option'),
  ).toHaveText(['old.png']);
  await expect(dialog.getByRole('button', { name: 'Upload' })).toBeDisabled();

  // Files can’t be dropped into the folder either
  const list = dialog.getByRole('listbox', { name: 'Available Images' });

  await cms.expectNoDrop(list, [{ name: 'bell.png', buffer: createPNG({ color: [0, 200, 200] }) }]);
  await expect(list.getByRole('option')).toHaveText(['old.png']);
  await expect(dialog.getByRole('button', { name: 'Insert' })).toBeDisabled();
});
