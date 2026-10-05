import { MockAzureBlobStorage } from '../../fixtures/cloud/azure.js';
import { MockCloudinary } from '../../fixtures/cloud/cloudinary.js';
import { MockS3 } from '../../fixtures/cloud/s3.js';
import { MockUploadcare } from '../../fixtures/cloud/uploadcare.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const SUNSET = createPNG({ color: [255, 128, 0] });
const KITE = createPNG({ color: [255, 255, 0] });

/**
 * A blog with an image field, and the given cloud storage service as a media library.
 * @param {Record<string, any>} mediaLibraries The `media_libraries` option.
 * @param {Record<string, any>[]} [extraFields] Fields to add to the posts.
 * @returns {Record<string, any>} Config.
 */
const createConfig = (mediaLibraries, extraFields = []) => ({
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  media_libraries: mediaLibraries,
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
        ...extraFields,
      ],
    },
  ],
});

/**
 * Start a new post and open the Select Image dialog of its cover, showing a service.
 * @param {Page} page Page.
 * @param {string} service Service name.
 * @returns {Promise<{ editor: Locator, cover: Locator, dialog: Locator }>} Editor, cover field
 * and dialog.
 */
const openSelectImageDialog = async (page, service) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });
  const dialog = page.getByRole('dialog', { name: 'Select Image' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Lake');
  await cover.getByRole('button', { name: 'Browse' }).click();
  await dialog.getByRole('option', { name: service }).click();

  return { editor, cover, dialog };
};

/**
 * Enter the credential a service asks for, e.g. a secret key, in a dialog or a pane.
 * @param {Locator} container Dialog or pane.
 * @param {string} service Service name.
 * @param {string} credential Credential.
 */
const enterCredential = async (container, service, credential) => {
  await container
    .getByRole('textbox', { name: new RegExp(`${service}.* API Key`) })
    .fill(credential);
};

/**
 * Select an option in a list box.
 * @param {Locator} option Option.
 */
const selectOption = async (option) => {
  await option.click();
  await expect(option).toHaveAttribute('aria-selected', 'true');
};

test.describe('Amazon S3', () => {
  test.use({
    config: createConfig({
      aws_s3: {
        access_key_id: 'AKIAE2ETESTKEY000000',
        bucket: 'e2e-bucket',
        region: 'eu-west-3',
        prefix: 'uploads/',
      },
    }),
  });

  /** @type {MockS3} */
  let s3;

  test.beforeEach(async ({ cms, page }) => {
    s3 = new MockS3({
      bucket: 'e2e-bucket',
      region: 'eu-west-3',
      baseURL: 'https://e2e-bucket.s3.eu-west-3.amazonaws.com',
    });
    s3.put({ 'uploads/sunset.png': SUNSET, 'uploads/trips/': '', 'uploads/trips/map.png': KITE });
    await s3.install(page);
    await cms.open();
    await cms.signIn();
  });

  test.afterEach(() => {
    // Every request is signed with the secret access key
    expect(s3.refused).toEqual([]);
  });

  test('picks an image from the bucket, which the entry links to', async ({ cms, page }) => {
    const { editor, cover, dialog } = await openSelectImageDialog(page, 'Amazon S3');

    await enterCredential(dialog, 'Amazon S3', s3.secretAccessKey);

    const images = dialog.getByRole('listbox', { name: 'Available Images' });

    // The files under the prefix are listed, and the folders separately
    await expect(images.getByRole('option')).toHaveCount(1);
    await expect(dialog.getByRole('listbox', { name: 'Folders' }).getByRole('option')).toHaveText([
      /trips/,
    ]);
    await selectOption(images.getByRole('option', { name: 'sunset.png' }));
    await dialog.getByRole('button', { name: 'Insert' }).click();

    const url = 'https://e2e-bucket.s3.eu-west-3.amazonaws.com/uploads/sunset.png';

    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(url);
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/lake.md'])
      .toBe(`---\ntitle: Lake\ncover: ${url}\n---\n`);
  });

  test('uploads an image to a folder of the bucket, and picks it', async ({ page }) => {
    const { cover, dialog } = await openSelectImageDialog(page, 'Amazon S3');
    const balloon = createPNG({ color: [0, 128, 255] });

    await enterCredential(dialog, 'Amazon S3', s3.secretAccessKey);
    await dialog
      .getByRole('listbox', { name: 'Folders' })
      .getByRole('option', { name: 'trips' })
      .dblclick();
    await expect(
      dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option'),
    ).toHaveText(['map.png']);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      dialog.getByRole('button', { name: 'Upload' }).click(),
    ]);

    await chooser.setFiles({ name: 'balloon.png', mimeType: 'image/png', buffer: balloon });

    // The upload goes to the folder being browsed, and is selected
    await expect.poll(() => s3.objects.get('uploads/trips/balloon.png')?.body).toEqual(balloon);
    await expect(
      dialog
        .getByRole('listbox', { name: 'Available Images' })
        .getByRole('option', { name: 'balloon.png' }),
    ).toHaveAttribute('aria-selected', 'true');
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      'https://e2e-bucket.s3.eu-west-3.amazonaws.com/uploads/trips/balloon.png',
    );
  });

  test('says the secret access key is wrong when the bucket refuses it', async ({ page }) => {
    const { dialog } = await openSelectImageDialog(page, 'Amazon S3');

    await enterCredential(dialog, 'Amazon S3', 'w'.repeat(40));

    await expect(dialog.getByRole('alert')).toHaveText(/error/);
    // The bucket refused the signature
    expect(s3.refused).toEqual(['GET : invalid signature']);
    s3.refused = [];
  });

  test.describe('in the asset library', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('radio', { name: 'Assets' }).click();
      await page.getByRole('option', { name: /^Amazon S3/ }).click();
      await enterCredential(page.getByRole('main'), 'Amazon S3', s3.secretAccessKey);
      await expect(page.getByRole('option', { name: 'Amazon S3 (2 assets)' })).toBeVisible();
    });

    test('lists the files and folders of the bucket, and shows an image', async ({ page }) => {
      const grid = page.getByRole('grid', { name: 'Assets' });

      await expect(grid.getByRole('row')).toHaveText([/trips/, /sunset\.png/]);
      await expect
        .poll(() =>
          grid.getByRole('img', { name: 'sunset.png' }).evaluate((img) => img.naturalWidth),
        )
        .toBe(32);
    });

    test('deletes a file', async ({ page }) => {
      await page.getByRole('row', { name: 'sunset.png' }).click();
      await page.getByRole('button', { name: 'Delete Selected Asset' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

      await expect.poll(() => s3.objects.has('uploads/sunset.png')).toBe(false);
      await expect(page.getByRole('row', { name: 'sunset.png' })).toHaveCount(0);
    });

    test('renames a file, copying it to the new key', async ({ page }) => {
      await page.getByRole('row', { name: 'sunset.png' }).click();
      await page.getByRole('button', { name: 'Show Edit Options' }).click();
      await page.getByRole('menuitem', { name: /^Rename/ }).click();

      const dialog = page.getByRole('dialog', { name: /Rename/ });

      await dialog.getByRole('textbox').fill('dusk.png');
      await dialog.getByRole('button', { name: 'Rename' }).click();

      await expect.poll(() => s3.objects.get('uploads/dusk.png')?.body).toEqual(SUNSET);
      expect(s3.objects.has('uploads/sunset.png')).toBe(false);
      await expect(page.getByRole('row', { name: 'dusk.png' })).toBeVisible();
    });

    test('creates a folder', async ({ page }) => {
      await page.getByRole('button', { name: 'New Folder' }).click();

      const dialog = page.getByRole('dialog', { name: 'New Folder' });

      await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('beach');
      await dialog.getByRole('button', { name: 'Create' }).click();

      // An empty folder is kept with a placeholder object
      await expect
        .poll(() => s3.objects.get('uploads/beach/')?.contentType)
        .toBe('application/x-directory');
      await expect(page.getByRole('row', { name: 'beach' })).toBeVisible();
    });
  });
});

test.describe('Cloudflare R2', () => {
  test.use({
    config: createConfig({
      cloudflare_r2: {
        access_key_id: 'AKIAE2ETESTKEY000000',
        account_id: 'e2e-account',
        bucket: 'e2e-bucket',
        public_url: 'https://cdn.example.com',
      },
    }),
  });

  test('picks an image, which the entry links to at its public URL', async ({ cms, page }) => {
    // R2 is addressed with the bucket in the path, and signed for the `auto` region
    const r2 = new MockS3({
      bucket: 'e2e-bucket',
      region: 'auto',
      baseURL: 'https://e2e-account.r2.cloudflarestorage.com/e2e-bucket',
      publicURL: 'https://cdn.example.com',
    });

    r2.put({ 'sunset.png': SUNSET });
    await r2.install(page);
    await cms.open();
    await cms.signIn();

    const { cover, dialog } = await openSelectImageDialog(page, 'Cloudflare R2');

    await enterCredential(dialog, 'Cloudflare R2', r2.secretAccessKey);
    await selectOption(
      dialog
        .getByRole('listbox', { name: 'Available Images' })
        .getByRole('option', { name: 'sunset.png' }),
    );
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      'https://cdn.example.com/sunset.png',
    );
    expect(r2.refused).toEqual([]);
  });
});

test.describe('Azure Blob Storage', () => {
  test.use({
    config: createConfig({
      azure_blob_storage: { account_name: 'e2eaccount', container: 'media', prefix: 'blog' },
    }),
  });

  /** @type {MockAzureBlobStorage} */
  let azure;

  test.beforeEach(async ({ cms, page }) => {
    azure = new MockAzureBlobStorage({ accountName: 'e2eaccount', container: 'media' });
    azure.put({ 'blog/sunset.png': SUNSET, 'elsewhere/kite.png': KITE });
    await azure.install(page);
    await cms.open();
    await cms.signIn();
  });

  test.afterEach(() => {
    // Every request carries the SAS token
    expect(azure.refused).toEqual([]);
  });

  test('picks an image, which the entry links to without the SAS token', async ({ page }) => {
    const { cover, dialog } = await openSelectImageDialog(page, 'Azure Blob Storage');

    await enterCredential(dialog, 'Azure Blob Storage', azure.sasToken);

    const images = dialog.getByRole('listbox', { name: 'Available Images' });

    // Only the blobs under the prefix are listed
    await expect(images.getByRole('option')).toHaveCount(1);
    await selectOption(images.getByRole('option', { name: 'sunset.png' }));
    await dialog.getByRole('button', { name: 'Insert' }).click();

    // The token expires, so it’s left out of the link
    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      'https://e2eaccount.blob.core.windows.net/media/blog/sunset.png',
    );
  });

  test('uploads, renames and deletes a file in the asset library', async ({ page }) => {
    await page.getByRole('radio', { name: 'Assets' }).click();
    await page.getByRole('option', { name: /^Azure Blob Storage/ }).click();
    await enterCredential(page.getByRole('main'), 'Azure Blob Storage', azure.sasToken);
    await expect(page.getByRole('row', { name: 'sunset.png' })).toBeVisible();

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Upload New Assets' }).click(),
    ]);

    await chooser.setFiles({ name: 'kite.png', mimeType: 'image/png', buffer: KITE });
    await expect.poll(() => azure.objects.get('blog/kite.png')?.body).toEqual(KITE);
    await expect(page.getByRole('row', { name: 'kite.png' })).toBeVisible();

    await page.getByRole('row', { name: 'sunset.png' }).click();
    await page.getByRole('button', { name: 'Show Edit Options' }).click();
    await page.getByRole('menuitem', { name: /^Rename/ }).click();
    await page
      .getByRole('dialog', { name: /Rename/ })
      .getByRole('textbox')
      .fill('dusk.png');
    await page
      .getByRole('dialog', { name: /Rename/ })
      .getByRole('button', { name: 'Rename' })
      .click();
    await expect.poll(() => azure.objects.get('blog/dusk.png')?.body).toEqual(SUNSET);
    expect(azure.objects.has('blog/sunset.png')).toBe(false);

    await page.getByRole('row', { name: 'dusk.png' }).click();
    await page.getByRole('button', { name: 'Delete Selected Asset' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => azure.objects.has('blog/dusk.png')).toBe(false);
  });
});

test.describe('Uploadcare', () => {
  test.use({
    config: createConfig({ uploadcare: { config: { publicKey: 'e2epublickey00000000' } } }),
  });

  /** @type {MockUploadcare} */
  let uploadcare;

  test.beforeEach(async ({ cms, page }) => {
    uploadcare = new MockUploadcare();
    uploadcare.add('sunset.png', SUNSET);
    await uploadcare.install(page);
    await cms.open();
    await cms.signIn();
  });

  test.afterEach(() => {
    // Every request carries the keys, and every upload is signed
    expect(uploadcare.refused).toEqual([]);
  });

  test('picks an image, which the entry links to on the CDN', async ({ page }) => {
    const { cover, dialog } = await openSelectImageDialog(page, 'Uploadcare');

    await enterCredential(dialog, 'Uploadcare', uploadcare.secretKey);
    await selectOption(
      dialog
        .getByRole('listbox', { name: 'Available Images' })
        .getByRole('option', { name: 'sunset.png' }),
    );
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      `https://ucarecdn.com/${uploadcare.files[0].uuid}/`,
    );
  });

  test('uploads an image with a signature, and picks it', async ({ page }) => {
    const { cover, dialog } = await openSelectImageDialog(page, 'Uploadcare');

    await enterCredential(dialog, 'Uploadcare', uploadcare.secretKey);
    await expect(dialog.getByRole('option', { name: 'sunset.png' })).toBeVisible();

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      dialog.getByRole('button', { name: 'Upload' }).click(),
    ]);

    await chooser.setFiles({ name: 'kite.png', mimeType: 'image/png', buffer: KITE });
    await expect
      .poll(() => uploadcare.files.map(({ name }) => name))
      .toEqual(['sunset.png', 'kite.png']);
    expect(uploadcare.files[1].body).toEqual(KITE);
    await expect(dialog.getByRole('option', { name: 'kite.png' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      `https://ucarecdn.com/${uploadcare.files[1].uuid}/`,
    );
  });

  test('deletes a file in the asset library', async ({ page }) => {
    await page.getByRole('radio', { name: 'Assets' }).click();
    await page.getByRole('option', { name: /^Uploadcare/ }).click();
    await enterCredential(page.getByRole('main'), 'Uploadcare', uploadcare.secretKey);
    await page.getByRole('row', { name: 'sunset.png' }).click();
    await page.getByRole('button', { name: 'Delete Selected Asset' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => uploadcare.files).toEqual([]);
    await expect(page.getByRole('row', { name: 'sunset.png' })).toHaveCount(0);
  });
});

test.describe('Cloudinary', () => {
  test.use({
    config: createConfig(
      { cloudinary: { config: { cloud_name: 'e2e-cloud', api_key: '123456789012345' } } },
      [
        {
          name: 'gallery',
          label: 'Gallery',
          widget: 'image',
          multiple: true,
          max: 3,
          required: false,
        },
      ],
    ),
  });

  /** @type {MockCloudinary} */
  let cloudinary;

  test.beforeEach(async ({ cms, page }) => {
    cloudinary = new MockCloudinary();
    cloudinary.add('sunset.png', SUNSET);
    await cloudinary.install(page);
    await cms.open();
    await cms.signIn();
  });

  test('picks an image with the media library widget', async ({ page }) => {
    const { cover, dialog } = await openSelectImageDialog(page, 'Cloudinary');

    // The user signs in to Cloudinary in a new tab first, so the widget can use the session
    const [loginTab] = await Promise.all([
      page.waitForEvent('popup'),
      dialog.getByRole('button', { name: 'Activate Cloudinary' }).click(),
    ]);

    await loginTab.close();

    // The widget opens in a dialog, and is told what to show
    const widget = page.frameLocator('iframe#cloudinary-iframe');

    await widget.getByRole('button', { name: 'Insert sunset.png' }).click();
    await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
      'https://res.cloudinary.com/e2e-cloud/image/upload/v1/sunset.png',
    );
    // The widget is loaded for the cloud, and configured for the field
    expect(Object.fromEntries(cloudinary.widgetParams[0])).toMatchObject({
      cloud_name: 'e2e-cloud',
      api_key: '123456789012345',
    });
    await expect
      .poll(() => cloudinary.widgetConfigs.at(-1))
      .toMatchObject({ multiple: false, folder: { path: '', resource_type: 'image' } });
  });

  test('tells the widget a multiple image field takes several images', async ({ page }) => {
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await page
      .getByRole('group', { name: '“\u2068Gallery\u2069” Field' })
      .getByRole('button', { name: 'Browse' })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Select Image' });

    await dialog.getByRole('option', { name: 'Cloudinary' }).click();

    const [loginTab] = await Promise.all([
      page.waitForEvent('popup'),
      dialog.getByRole('button', { name: 'Activate Cloudinary' }).click(),
    ]);

    await loginTab.close();
    await expect
      .poll(() => cloudinary.widgetConfigs.at(-1))
      .toMatchObject({
        multiple: true,
        max_files: 3,
      });
  });
});
