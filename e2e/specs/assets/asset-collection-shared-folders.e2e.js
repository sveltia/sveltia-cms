import { expect, test } from '../../fixtures/test.js';
import { listedAssets, openCollection, openFolder } from '../../fixtures/ui.js';

/**
 * A site where an asset collection shares its folder with a field-level folder, another with a
 * collection-level folder, and a read-only one with another field-level folder.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  asset_collections: [
    {
      name: 'downloads',
      label: 'Downloads',
      icon: 'download',
      media_folder: 'static/files',
      public_folder: '/files',
    },
    { name: 'manuals', label: 'Manuals', media_folder: 'static/manuals' },
    {
      name: 'archive',
      label: 'Archive',
      media_folder: 'static/archive',
      public_folder: '/archive',
      readonly: true,
    },
  ],
  collections: [
    {
      name: 'examples',
      label: 'Examples',
      folder: 'content/examples',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'file',
          label: 'File',
          widget: 'file',
          media_folder: '/static/files',
          public_folder: '/files',
          required: false,
        },
        {
          name: 'attachment',
          label: 'Attachment',
          widget: 'file',
          media_folder: '/static/archive',
          public_folder: '/archive',
          required: false,
        },
      ],
    },
    {
      name: 'guides',
      label: 'Guides',
      folder: 'content/guides',
      media_folder: '/static/manuals',
      public_folder: '/static/manuals',
      fields: [{ name: 'title', label: 'Title' }],
    },
  ],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'static/files/report.pdf': 'report',
    'static/files/slides.pdf': 'slides',
    'static/manuals/setup.pdf': 'setup',
    'static/archive/old.pdf': 'old',
    'content/guides/setup.md': '---\ntitle: Setup\n---\n',
  });
  await cms.signIn();
});

test('lists the files in every folder sharing their path', async ({ page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();

  // The asset collections list the files of the field-level folder, which isn’t listed itself, and
  // share theirs with the Guides collection’s folder
  await expect(page.getByRole('listbox', { name: 'Asset Folder List' })).toMatchAriaSnapshot(`
    - option "All Assets (4 assets)"
    - option "Global Assets (No assets)"
    - separator
    - option "Guides (1 asset)"
    - separator
    - option "Downloads (2 assets)"
    - option "Manuals (1 asset)"
    - option "Archive (1 asset)"
  `);

  await openFolder(page, /Downloads/);
  await expect.poll(() => listedAssets(page)).toEqual(['report.pdf', 'slides.pdf']);
  await openFolder(page, /Manuals/);
  await expect.poll(() => listedAssets(page)).toEqual(['setup.pdf']);
  await openFolder(page, /Guides/);
  await expect.poll(() => listedAssets(page)).toEqual(['setup.pdf']);
});

test('lists a file uploaded to a shared folder in every folder', async ({ cms, page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await openFolder(page, /Guides/);
  await page.getByRole('button', { name: 'Upload New Assets' }).click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles([
    { name: 'install.pdf', mimeType: 'application/pdf', buffer: Buffer.from('install') },
  ]);
  await page
    .getByRole('alertdialog', { name: 'Upload New Assets' })
    .getByRole('button', { name: 'Upload' })
    .click();

  // The file stays in the folder it was uploaded to, and the asset collection lists it as well
  await expect.poll(() => listedAssets(page)).toEqual(['install.pdf', 'setup.pdf']);
  await expect(page.getByRole('option', { name: 'Guides (2 assets)' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Manuals (2 assets)' })).toBeVisible();
  await expect
    .poll(() => cms.readRepoFile('static/manuals/install.pdf'))
    .toEqual(Buffer.from('install'));
});

test('lists the files of a collection sharing its folder in the Contents view', async ({
  page,
}) => {
  await openCollection(page, 'Guides');
  await page.getByRole('button', { name: 'Show Assets' }).click();

  await expect(
    page.getByRole('group', { name: 'Collection Assets' }).getByRole('option'),
  ).toHaveText(['setup.pdf']);
});

test('keeps a file in a read-only asset collection sharing its folder unchanged', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await openFolder(page, /Archive/);
  await page.getByRole('row', { name: 'old.pdf' }).click();

  // The file is assigned to the field-level folder, which isn’t read-only, but the asset collection
  // listing it is
  await expect(page.getByRole('button', { name: 'Delete Selected Asset' })).toBeDisabled();
});
