import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Blog with an image field, which offers the stock photo services in its Select Image dialog.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
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
      ],
    },
  ],
};

/**
 * A made-up Pexels API key in the format the CMS expects: 56 alphanumeric characters.
 */
const PEXELS_API_KEY = 'e2e'.padEnd(56, '0');

/**
 * Photos listed by the mocked Pexels API.
 */
const PEXELS_PHOTOS = [
  { id: 101, name: 'red-barn', photographer: 'Ana Lima', color: [200, 30, 30] },
  { id: 102, name: 'green-field', photographer: 'Ben Ito', color: [30, 200, 30] },
].map(({ id, name, photographer, color }) => ({
  id,
  url: `https://www.pexels.com/photo/${name}-${id}/`,
  alt: name.replace('-', ' '),
  photographer,
  src: {
    medium: `https://images.pexels.com/photos/${id}/medium.png`,
    large2x: `https://images.pexels.com/photos/${id}/large.png`,
  },
  image: createPNG({ color: /** @type {[number, number, number]} */ (color) }),
}));

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // Never reach the real services
  // Each page has a landscape and a portrait photo
  await page.route('https://picsum.photos/v2/list**', (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));

    return route.fulfill({
      json: [
        { id: `${pageNumber}0`, width: 2000, height: 1000 },
        { id: `${pageNumber}1`, width: 1000, height: 2000 },
      ],
    });
  });
  await page.route('https://picsum.photos/id/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: createPNG({ color: [0, 0, 255] }) }),
  );

  await cms.open();
  await cms.signIn();
});

/**
 * Start a new post, fill in its title and open the Select Image dialog of its cover.
 * @param {Page} page Page.
 * @param {string} title Title.
 * @returns {Promise<{ editor: Locator, cover: Locator, dialog: Locator }>} Content editor, cover
 * field and dialog.
 */
const openSelectImageDialog = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
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

test('inserts a Lorem Picsum photo by its URL, without uploading it', async ({ cms, page }) => {
  const { editor, cover, dialog } = await openSelectImageDialog(page, 'Lake');

  await selectOption(dialog.getByRole('option', { name: 'Lorem Picsum' }));

  const photos = dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option');

  // Three random pages of the ten are listed together
  await expect(photos).toHaveCount(6);

  // Pick a landscape photo, which is shown in the grid with its smaller size
  const src = /** @type {string} */ (
    await photos.locator('img[src$="0/480/320.webp"]').first().getAttribute('src')
  );

  const id = src.split('/')[4];

  await selectOption(photos.filter({ has: page.locator(`img[src="${src}"]`) }));
  await dialog.getByRole('button', { name: 'Insert' }).click();

  // Lorem Picsum is hotlinked, so the field refers to the larger photo on the service
  const url = `https://picsum.photos/id/${id}/1920/1280.webp`;

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(url);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/lake.md'])
    .toBe(`---\ntitle: Lake\ncover: ${url}\n---\n`);
  expect(Object.keys(await cms.readRepo())).toEqual(['content/posts/lake.md']);
});

test('searches Pexels with an API key, and uploads the photo with the entry', async ({
  cms,
  page,
}) => {
  /** @type {URL[]} */
  const requests = [];

  await page.route('https://api.pexels.com/v1/**', (route) => {
    const request = route.request();

    requests.push(new URL(request.url()));

    if (request.headers().authorization !== PEXELS_API_KEY) {
      return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    }

    const { pathname, searchParams } = new URL(request.url());

    const photos =
      pathname === '/v1/search'
        ? PEXELS_PHOTOS.filter(({ alt }) => alt.includes(searchParams.get('query') ?? ''))
        : PEXELS_PHOTOS;

    return route.fulfill({ json: { photos: photos.map(({ image: _image, ...photo }) => photo) } });
  });
  await page.route('https://images.pexels.com/photos/**', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[2]);

    return route.fulfill({
      contentType: 'image/png',
      body: PEXELS_PHOTOS.find((photo) => photo.id === id)?.image,
    });
  });

  const { editor, cover, dialog } = await openSelectImageDialog(page, 'Farm');

  await selectOption(dialog.getByRole('option', { name: 'Pexels' }));

  // The service needs an API key, which is asked for first and used once it’s in the right format
  await dialog.getByRole('textbox', { name: /API Key/ }).fill(PEXELS_API_KEY);

  const list = dialog.getByRole('listbox', { name: 'Available Images' });

  // The photos are named after the description in their Pexels URL
  await expect(list.getByRole('option')).toHaveCount(2);
  await expect(list.getByRole('option', { name: 'red barn' })).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'Search for Images' }).fill('green');
  await expect(list.getByRole('option')).toHaveCount(1);
  expect(requests.at(-1)?.searchParams.get('query')).toBe('green');
  await selectOption(list.getByRole('option', { name: 'green field' }));
  await dialog.getByRole('button', { name: 'Insert' }).click();

  // The credit to give the photographer is offered to copy
  const creditDialog = page.getByRole('alertdialog', { name: 'Photo Credit' });

  await expect(creditDialog.getByRole('textbox')).toHaveValue(
    '<a href="https://www.pexels.com/photo/green-field-102/">Photo by Ben Ito on Pexels</a>',
  );
  await creditDialog.getByRole('button', { name: 'Cancel' }).click();

  // Pexels isn’t hotlinked: the photo is downloaded and uploaded to the media folder on saving
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
    '/images/pexels-ben-ito-102.jpg',
  );
  expect(Object.keys(await cms.readRepo())).toEqual([]);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/farm.md'])
    .toBe('---\ntitle: Farm\ncover: /images/pexels-ben-ito-102.jpg\n---\n');
  expect(await cms.readRepoFile('static/images/pexels-ben-ito-102.jpg')).toEqual(
    PEXELS_PHOTOS[1].image,
  );
});
