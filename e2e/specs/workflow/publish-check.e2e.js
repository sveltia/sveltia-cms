import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 * @import { MockGitHub } from '../../fixtures/github.js';
 */

/**
 * Blog with Editorial Workflow whose posts refer to an author with a Relation field. Publishing
 * checks that a pull request holds nothing the CMS hasn’t shown, so these are the changes the CMS
 * itself commits beyond the entry: the posts rewritten when an author is renamed or deleted, and
 * the files a rename vacates.
 */
const CONFIG = {
  ...GITHUB_CONFIG,
  publish_mode: 'editorial_workflow',
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
        {
          name: 'author',
          label: 'Author',
          widget: 'relation',
          collection: 'authors',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
          required: false,
        },
      ],
    },
    {
      name: 'authors',
      label: 'Authors',
      label_singular: 'Author',
      folder: 'content/authors',
      create: true,
      identifier_field: 'name',
      fields: [{ name: 'name', label: 'Name' }],
    },
  ],
};

test.use({ config: CONFIG });

/**
 * Seed the repository with an author and a post referring to it.
 * @param {MockGitHub} github GitHub mock.
 */
const seedAuthor = (github) => {
  github.commit({
    'content/authors/ada.md': '---\nname: Ada\n---\n',
    'content/posts/hello.md': '---\ntitle: Hello\nauthor: ada\n---\n',
  });
};

/**
 * Open a collection.
 * @param {Page} page Page.
 * @param {string} name Collection label.
 */
const openCollection = async (page, name) => {
  await page.getByRole('treeitem', { name }).click();
};

/**
 * Open an entry in the editor.
 * @param {Page} page Page.
 * @param {string} title Entry title.
 * @returns {Promise<Locator>} Editor.
 */
const openEntry = async (page, title) => {
  await page.getByRole('row', { name: new RegExp(`^${title}`) }).click();

  return page.getByRole('group', { name: 'Content Editor' });
};

/**
 * Move the entry open in the editor to the Ready stage, then publish it.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 */
const markReadyAndPublish = async (cms, page) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: /Status: .*Draft/ }),
    page.getByRole('menuitemradio', { name: 'Ready' }),
  );
  await expect(page.getByRole('button', { name: /Status: .*Ready/ })).toBeVisible();
  await page.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();
};

test('publishes the rename of an author, along with the posts referring to it', async ({
  cms,
  github,
  page,
}) => {
  seedAuthor(github);
  await cms.open();
  await openCollection(page, 'Authors');

  const editor = await openEntry(page, 'Ada');

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Edit Slug' }),
  );

  const panel = page.getByRole('group', { name: 'Slug', exact: true });

  await panel.getByRole('button', { name: 'Edit Slug' }).click();
  await panel.getByRole('textbox', { name: 'Slug' }).fill('ada-lovelace');
  await panel.getByRole('textbox', { name: 'Slug' }).press('Enter');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The branch is named after the new slug
  await expect
    .poll(() => github.readFile('content/posts/hello.md', 'cms/authors/ada-lovelace'))
    .toBe('---\ntitle: Hello\nauthor: ada-lovelace\n---\n');

  await openEntry(page, 'Ada');
  await markReadyAndPublish(cms, page);

  // The vacated file and the rewritten post are what the CMS commits for a rename
  await expect.poll(() => github.pullRequests[0]?.state).toBe('merged');
  expect(github.readFile('content/authors/ada.md')).toBeUndefined();
  expect(github.readFile('content/authors/ada-lovelace.md')).toBe('---\nname: Ada\n---\n');
  expect(github.readFile('content/posts/hello.md')).toBe(
    '---\ntitle: Hello\nauthor: ada-lovelace\n---\n',
  );
});

test('carries out the deletion of an author, along with the posts referring to it', async ({
  cms,
  github,
  page,
}) => {
  seedAuthor(github);
  await cms.open();
  await openCollection(page, 'Authors');
  await openEntry(page, 'Ada');
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Delete Entry' }),
  );
  await page.getByRole('alertdialog', { name: 'Delete Entry' }).getByRole('button').first().click();

  await expect.poll(() => github.pullRequests[0]?.labels).toEqual(['sveltia-cms/pending_deletion']);

  await openEntry(page, 'Ada');
  await page.getByRole('button', { name: 'Delete Entry' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

  // The reference is removed from the post in the same pull request, which the check allows
  await expect.poll(() => github.pullRequests[0]?.state).toBe('merged');
  expect(github.readFile('content/authors/ada.md')).toBeUndefined();
  expect(github.readFile('content/posts/hello.md')).not.toContain('author: ada');
});

test('carries out the deletion of two authors one after the other', async ({
  cms,
  github,
  page,
}) => {
  github.commit({
    'content/authors/ada.md': '---\nname: Ada\n---\n',
    'content/authors/grace.md': '---\nname: Grace\n---\n',
    'content/posts/hello.md': '---\ntitle: Hello\nauthor: ada\n---\n',
  });

  await cms.open();
  await openCollection(page, 'Authors');
  await page.getByRole('checkbox', { name: /Select .*Ada/ }).check();
  await page.getByRole('checkbox', { name: /Select .*Grace/ }).check();
  await page.getByRole('button', { name: 'Delete Selected Entries' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

  // Each pull request removes the reference to the whole selection, so both rewrite the post
  await expect.poll(() => github.pullRequests.length).toBe(2);

  const board = page.getByRole('group', { name: 'Editorial Workflow' });

  /**
   * Carry out the pending deletion of the given author from the board.
   * @param {string} name Author name.
   */
  const carryOut = async (name) => {
    await board
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name }) })
      .getByRole('button', { name: 'Delete Entry' })
      .click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  };

  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();
  await carryOut('Ada');
  await expect.poll(() => github.pullRequests.map(({ state }) => state)).toContain('merged');

  // The post already carries the rewrite on the configured branch, so the second pull request’s
  // copy of it publishes nothing and doesn’t stand in the way
  await carryOut('Grace');
  await expect
    .poll(() => github.pullRequests.map(({ state }) => state))
    .toEqual(['merged', 'merged']);
  expect(github.readFile('content/authors/ada.md')).toBeUndefined();
  expect(github.readFile('content/authors/grace.md')).toBeUndefined();
  expect(github.readFile('content/posts/hello.md')).not.toContain('author: ada');
});
