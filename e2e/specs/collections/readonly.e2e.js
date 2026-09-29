import { expect, test } from '../../fixtures/test.js';

import { openCollection } from './helpers.js';

/**
 * A site with a read-only archive collection next to an editable one, and a file collection with
 * one read-only file.
 */
const READONLY_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    {
      name: 'news',
      label: 'News',
      folder: 'content/news',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'text' },
      ],
    },
    {
      name: 'archive',
      label: 'Archive',
      folder: 'content/archive',
      media_folder: '/static/archive',
      readonly: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'text' },
        {
          name: 'related',
          label: 'Related',
          widget: 'relation',
          collection: 'news',
          required: false,
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
          file: 'data/site.yml',
          readonly: true,
          fields: [{ name: 'name', label: 'Site Name' }],
        },
        {
          name: 'menu',
          label: 'Menu',
          file: 'data/menu.yml',
          fields: [{ name: 'label', label: 'Label' }],
        },
      ],
    },
  ],
};

const READONLY_FILES = {
  'content/news/hello.md': '---\ntitle: Hello\n---\n\nFirst post.\n',
  'content/archive/old-post.md': '---\ntitle: Old Post\nrelated: hello\n---\n\nFrom long ago.\n',
  'data/site.yml': 'name: Garden\n',
  'data/menu.yml': 'label: Home\n',
};

test.use({ config: READONLY_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(READONLY_FILES);
  await cms.signIn();
});

test('shows a read-only collection for reference only', async ({ cms, page }) => {
  const collection = await openCollection(page, 'Archive');

  await expect(collection.getByRole('status')).toHaveText(
    /This collection is read-only\. You can view its content but cannot make any changes\./,
  );
  await expect(collection.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();

  await page.getByRole('row', { name: /Old Post/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('status')).toHaveText(
    /This entry is read-only\. You can view it but cannot make any changes\./,
  );
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('From long ago.');
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveAttribute('readonly');
  await expect(editor.getByRole('button', { name: 'Save' })).toHaveCount(0);

  await cms.openPopup(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Edit Slug' }),
  );
  await expect(page.getByRole('menuitem', { name: 'Edit Slug' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Duplicate Entry' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Delete Entry' })).toHaveCount(0);
});

test('refuses to open a new entry in a read-only collection from its URL', async ({ page }) => {
  await openCollection(page, 'Archive');
  await page.evaluate(() => {
    window.location.hash = '#/collections/archive/new';
  });

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor).toContainText(
    'This collection is read-only. You can view its content but cannot make any changes.',
  );
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveCount(0);
});

test('locks a read-only file while its sibling stays editable', async ({ cms, page }) => {
  await openCollection(page, 'Settings');
  await page.getByRole('row', { name: /Site/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Site Name' })).toHaveAttribute('readonly');
  await expect(editor.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Cancel Editing' }).click();

  await page.getByRole('row', { name: /Menu/ }).click();
  await editor.getByRole('textbox', { name: 'Label' }).fill('Start');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await cms.readRepo())['data/menu.yml']).toBe('label: Start\n');
});

test('refuses to delete an entry a read-only entry refers to', async ({ cms, page }) => {
  await openCollection(page, 'News');
  await page.getByRole('row', { name: /Hello/ }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Delete Entry' }),
  );

  const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

  await expect(dialog.getByRole('listitem')).toHaveText([
    /Archive › Old Post.*Related: The entry is read-only, so the reference can’t be removed\./,
  ]);
  await expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(Object.keys(await cms.readRepo())).toContain('content/news/hello.md');
});

test('refuses to rename an entry a read-only entry refers to', async ({ cms, page }) => {
  await openCollection(page, 'News');
  await page.getByRole('row', { name: /Hello/ }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Edit Slug' }),
  );

  const panel = page.getByRole('group', { name: 'Slug', exact: true });

  await panel.getByRole('button', { name: 'Edit Slug' }).click();
  await panel.getByRole('textbox', { name: 'Slug' }).fill('hi');
  await page.keyboard.press('Enter');
  await page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('button', { name: 'Save' })
    .click();

  await expect(page.getByRole('alertdialog')).toContainText(
    'This entry can’t be renamed, because the following read-only entries refer to it by its ' +
      'current name: \u2068Archive › Old Post\u2069.',
  );

  const repo = await cms.readRepo();

  expect(Object.keys(repo)).toContain('content/news/hello.md');
  expect(repo['content/archive/old-post.md']).toContain('related: hello\n');
});

test('keeps assets out of a read-only collection’s media folder', async ({ page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page
    .getByRole('listbox', { name: 'Asset Folder List' })
    .getByRole('option', { name: /Archive/ })
    .click();

  await expect(page.getByRole('status').filter({ hasText: 'This folder' })).toHaveText(
    /This folder is read-only\. You can view its assets but cannot make any changes\./,
  );
  await expect(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();

  // The global folder is unaffected
  await page
    .getByRole('listbox', { name: 'Asset Folder List' })
    .getByRole('option', { name: /Global Assets/ })
    .click();
  // The empty folder offers another upload button of its own
  await expect(page.getByRole('button', { name: 'Upload New Assets' }).first()).toBeEnabled();
});

test.describe('with the whole CMS read-only', () => {
  test.use({ config: { ...READONLY_CONFIG, readonly: true } });

  test('explains the read-only mode everywhere', async ({ page }) => {
    // Nothing can be created, so the global Create menu isn’t offered
    await expect(page.getByRole('button', { name: 'Create Entry or Assets' })).toBeDisabled();

    const collection = await openCollection(page, 'News');

    await expect(collection.getByRole('status')).toHaveText(
      /The CMS is in read-only mode\. You can view content and assets but cannot make any changes\./,
    );
    await expect(collection.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();

    await page.getByRole('row', { name: /Hello/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('status')).toHaveText(/The CMS is in read-only mode\./);
    await expect(editor.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });
});
