import { createPNG } from '../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../fixtures/test.js';
import { getEditor, getEntryRows, listedAssets, openCollection } from '../fixtures/ui.js';

/**
 * @import { CMS } from '../fixtures/test.js';
 */

/**
 * A name with a combining accent, in Unicode normalization form D, as a file added on Linux or by
 * some macOS programs can have, and its spelling in form C, which the CMS uses. The origin private
 * file system compares names byte for byte, like Linux does, so it doesn’t find a file by the other
 * spelling, and can hold both.
 */
const DECOMPOSED = 'cafe\u0301';
const COMPOSED = DECOMPOSED.normalize();
const IMAGE = createPNG({ width: 4, height: 4 });

/**
 * List the files in the test repository, as they’re spelled there, in a folder.
 * @param {CMS} cms CMS fixture.
 * @param {string} folder Folder path, with the names in form C.
 * @returns {Promise<string[]>} File paths, sorted.
 */
const listFiles = async (cms, folder) =>
  Object.keys(await cms.readRepo())
    .filter((path) => path.normalize().startsWith(`${folder}/`))
    .sort();

test.use({
  config: {
    ...BASE_CONFIG,
    collections: [
      ...BASE_CONFIG.collections,
      {
        ...BASE_CONFIG.collections[0],
        name: 'menu',
        label: 'Menu',
        label_singular: 'Item',
        // Configured in form C, while the folder on the disk is in form D
        folder: `content/${COMPOSED}`,
      },
    ],
  },
});

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    [`content/posts/${DECOMPOSED}.md`]: '---\ntitle: Coffee\n---\n\nBlack.\n',
    'content/posts/tea.md': '---\ntitle: Tea\n---\n\nGreen.\n',
    [`content/${DECOMPOSED}/latte.md`]: '---\ntitle: Latte\n---\n\nMilky.\n',
    [`static/images/${DECOMPOSED}.png`]: IMAGE,
  });
  await cms.signIn();
});

test('updates an entry whose file name is decomposed', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Coffee/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('With milk.');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The file is updated rather than joined by another one with the composed name
  await expect
    .poll(() => listFiles(cms, 'content/posts'))
    .toEqual([`content/posts/${DECOMPOSED}.md`, 'content/posts/tea.md']);
  expect((await cms.readRepo())[`content/posts/${DECOMPOSED}.md`]).toBe(
    '---\ntitle: Coffee\n---\n\nWith milk.\n',
  );
});

test('deletes an entry whose file name is decomposed', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Coffee/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect(getEntryRows(page)).toHaveCount(1);
  await expect.poll(() => listFiles(cms, 'content/posts')).toEqual(['content/posts/tea.md']);
});

test('lists and saves the entries in a folder whose name is decomposed', async ({ cms, page }) => {
  await openCollection(page, 'Menu');
  await expect(getEntryRows(page)).toHaveCount(1);
  await page.getByRole('row', { name: /Latte/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Foamy.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())[`content/${DECOMPOSED}/latte.md`])
    .toBe('---\ntitle: Latte\n---\n\nFoamy.\n');

  // The editor closes on a save
  await expect(editor).toBeHidden();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
  await editor.getByRole('textbox', { name: 'Title' }).fill('Mocha');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Chocolatey.');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The new entry goes in the same folder rather than in a second one that looks the same
  await expect
    .poll(() => listFiles(cms, `content/${COMPOSED}`))
    .toEqual([`content/${DECOMPOSED}/latte.md`, `content/${DECOMPOSED}/mocha.md`]);
});

test('renames an asset whose file name is decomposed', async ({ cms, page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await expect.poll(() => listedAssets(page)).toEqual([`${COMPOSED}.png`]);
  await page.getByRole('row', { name: `${COMPOSED}.png` }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Rename Asset' }),
  );

  const dialog = page.getByRole('dialog', { name: /Rename/ });

  await dialog.getByRole('textbox').fill('espresso.png');
  await dialog.getByRole('button', { name: 'Rename' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['espresso.png']);
  await expect.poll(() => listFiles(cms, 'static/images')).toEqual(['static/images/espresso.png']);
  expect(await cms.readRepoFile('static/images/espresso.png')).toEqual(IMAGE);
});
