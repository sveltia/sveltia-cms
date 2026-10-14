import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * Articles named after a sequential number, with no field holding it.
 * @see https://github.com/sveltia/sveltia-cms/issues/1072
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'articles',
      label: 'Articles',
      label_singular: 'Article',
      folder: 'content/articles',
      create: true,
      slug: {
        auto_increment: true,
        pattern: ['^[0-9]+$', 'Must contain only numbers'],
      },
      fields: [{ name: 'title', label: 'Title' }],
    },
  ],
};

const FILES = {
  'content/articles/3.md': '---\ntitle: Third\n---\n',
  'content/articles/12.md': '---\ntitle: Twelfth\n---\n',
  'content/articles/about.md': '---\ntitle: About\n---\n',
};

/**
 * Wait for the article files in the repository to be the given ones.
 * @param {CMS} cms CMS fixture.
 * @param {string[]} names File names under `content/articles/`, sorted.
 */
const expectArticles = async (cms, names) => {
  await expect
    .poll(async () =>
      Object.keys(await cms.readRepo())
        .filter((path) => path.startsWith('content/articles/'))
        .map((path) => path.replace('content/articles/', ''))
        .sort(),
    )
    .toEqual(names);
};

/**
 * Create an article with the given title and save it, which takes us back to the entry list.
 * @param {Page} page Page.
 * @param {string} title Title.
 */
const createArticle = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

test('numbers new articles after the highest numeric slug', async ({ cms, page }) => {
  await createArticle(page, 'Thirteenth');
  await createArticle(page, 'Fourteenth');
  await expectArticles(cms, ['12.md', '13.md', '14.md', '3.md', 'about.md']);
  expect((await cms.readRepo())['content/articles/14.md']).toBe('---\ntitle: Fourteenth\n---\n');
});

test('shows the next number as the slug, which a typed-in slug replaces', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Hundredth');
  await page
    .getByRole('radiogroup', { name: 'Sidebar Panels' })
    .getByRole('radio', { name: 'Slug' })
    .click();

  const panel = page.getByRole('group', { name: 'Slug', exact: true });

  // The number is shown before it’s assigned on save
  await expect(panel.getByText('13', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Edit Slug' }).click();

  const input = panel.getByRole('textbox', { name: 'Slug' });

  await expect(input).toHaveValue('13');
  // The pattern still applies to a typed-in slug
  await input.fill('one-hundred');
  await expect(panel.getByText('Must contain only numbers')).toBeVisible();
  await input.fill('100');
  await input.press('Enter');
  await expect(panel.getByText('100', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
  await expectArticles(cms, ['100.md', '12.md', '3.md', 'about.md']);
});
