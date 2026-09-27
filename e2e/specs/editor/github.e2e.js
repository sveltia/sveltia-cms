import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';

/**
 * A post with a simple list and a list of objects, whose items shift when one is removed.
 */
const FIRST_POST = [
  '---',
  'title: First Post',
  'tags:',
  '  - one',
  '  - two',
  '  - three',
  'links:',
  '  - label: Home',
  '    url: https://example.com/',
  '  - label: Blog',
  '    url: https://example.com/blog/',
  '---',
  '',
  'Hello, world!',
  '',
].join('\n');

test.use({
  config: {
    ...GITHUB_CONFIG,
    collections: [
      {
        ...GITHUB_CONFIG.collections[0],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'tags', label: 'Tags', widget: 'list' },
          {
            name: 'links',
            label: 'Links',
            widget: 'list',
            summary: '{{label}}',
            fields: [
              { name: 'label', label: 'Label' },
              { name: 'url', label: 'URL' },
            ],
          },
          { name: 'body', label: 'Body', widget: 'text' },
        ],
      },
    ],
  },
});

test.beforeEach(async ({ github }) => {
  github.commit({ [POST_PATH]: FIRST_POST }, { message: 'Add the first post' });
});

/**
 * Open the first post in the entry editor.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const openFirstPost = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Post/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Post');

  return editor;
};

test.describe('History panel', () => {
  test('lists the commits of the entry, the latest first', async ({ cms, github, page }) => {
    github.commit({ [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') }, { author: github.user });
    // A commit to another file isn’t listed
    github.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
    await cms.open();
    await openFirstPost(page);
    await page
      .getByRole('radiogroup', { name: 'Sidebar Panels' })
      .getByRole('radio', { name: 'History' })
      .click();

    const commits = page.getByRole('group', { name: 'History', exact: true }).getByRole('link');

    await expect(commits).toHaveCount(2);
    await expect(commits.first()).toContainText(github.user.name);
    await expect(commits.last()).toContainText(github.colleague.name);

    // A commit opens on GitHub in a new tab
    await page.context().route('https://github.com/**', (route) => route.fulfill({ body: '' }));

    const [popup] = await Promise.all([page.waitForEvent('popup'), commits.last().click()]);

    expect(popup.url()).toBe(
      `https://github.com/sveltia/e2e-site/commit/${github.commits.at(-3)?.oid}`,
    );
  });

  test('is unavailable for a new entry', async ({ cms, page }) => {
    await cms.open();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await expect(
      page
        .getByRole('radiogroup', { name: 'Sidebar Panels' })
        .getByRole('radio', { name: 'History' }),
    ).toBeDisabled();
  });
});

test.describe('draft backup', () => {
  /**
   * Edit the first post, wait for the backup, then close the editor without saving.
   * @param {Page} page Page.
   * @param {(editor: Locator) => Promise<void>} edit Function making the changes.
   */
  const editAndLeave = async (page, edit) => {
    const editor = await openFirstPost(page);

    await edit(editor);
    // The draft is backed up 500 ms after the last change
    await page.waitForTimeout(1000);
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  };

  /**
   * Answer the prompt to restore the backup of the first post, opening the post first unless the
   * editor is already open.
   * @param {Page} page Page.
   * @param {'Restore' | 'Discard'} answer Button to click.
   * @param {object} [options] Options.
   * @param {boolean} [options.open] Whether to open the post.
   * @returns {Promise<Locator>} Editor.
   */
  const answerPrompt = async (page, answer, { open = true } = {}) => {
    if (open) {
      await page.getByRole('row', { name: /First Post/ }).click();
    }

    const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });

    await expect(dialog).toContainText('This entry has a backup from');
    await dialog.getByRole('button', { name: answer }).click();
    await expect(dialog).toBeHidden();

    return page.getByRole('group', { name: 'Content Editor' });
  };

  /**
   * Type in a text field like a user, who clicks it first. A change is only backed up once the
   * user has interacted with the editor, which a `fill()` alone doesn’t count as.
   * @param {Locator} textbox Text field.
   * @param {string} value New value.
   */
  const typeIn = async (textbox, value) => {
    await textbox.click();
    await textbox.fill(value);
  };

  test('restores the changes made before leaving the editor', async ({ cms, github, page }) => {
    await cms.open();
    await editAndLeave(page, async (editor) => {
      await typeIn(editor.getByRole('textbox', { name: 'Title' }), 'Backed-up Post');
      await typeIn(editor.getByRole('textbox', { name: 'Body' }), 'Not saved yet.');
    });

    const editor = await answerPrompt(page, 'Restore');

    await expect(
      page.getByRole('status').filter({ hasText: 'Draft backup restored.' }),
    ).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Backed-up Post');
    await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Not saved yet.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(() => github.readFile(POST_PATH))
      .toBe(
        FIRST_POST.replace('title: First Post', 'title: Backed-up Post').replace(
          'Hello, world!',
          'Not saved yet.',
        ),
      );
  });

  test('restores the changes after the page is reloaded', async ({ cms, page }) => {
    await cms.open();

    const editor = await openFirstPost(page);

    await typeIn(editor.getByRole('textbox', { name: 'Title' }), 'Backed-up Post');
    await page.waitForTimeout(1000);
    await page.reload();
    await answerPrompt(page, 'Restore', { open: false });
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Backed-up Post');
  });

  test('discards the backup', async ({ cms, page }) => {
    await cms.open();
    await editAndLeave(page, async (editor) => {
      await typeIn(editor.getByRole('textbox', { name: 'Title' }), 'Backed-up Post');
    });

    const editor = await answerPrompt(page, 'Discard');

    await expect(
      page.getByRole('status').filter({ hasText: 'Draft backup deleted.' }),
    ).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Post');
    await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();

    // The backup is gone, so the entry opens without the prompt next time
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await openFirstPost(page);
    await page.waitForTimeout(500);
    await expect(page.getByRole('alertdialog', { name: 'Restore Draft' })).toBeHidden();
  });

  test('doesn’t back up an entry that was only opened', async ({ cms, page }) => {
    await cms.open();
    await editAndLeave(page, async () => {});
    await openFirstPost(page);
    await page.waitForTimeout(500);
    await expect(page.getByRole('alertdialog', { name: 'Restore Draft' })).toBeHidden();
  });

  test('restores the lists an item was removed from', async ({ cms, github, page }) => {
    // Issue #985: the items after a removed one shift, and restoring the backup over the loaded
    // content left the keys of the last items in place, which were saved as extra values
    await cms.open();
    await editAndLeave(page, async (editor) => {
      await editor
        .getByRole('group', { name: /Tags/ })
        .getByRole('button', { name: 'Remove' })
        .first()
        .click();
      await expect(editor.getByRole('textbox', { name: 'Item Value' })).toHaveCount(2);

      const links = editor.getByRole('group', { name: /Links/ });

      await links.getByRole('button', { name: 'Remove' }).first().click();
      await expect(links.getByRole('textbox', { name: 'Label' })).toHaveCount(1);
    });

    const editor = await answerPrompt(page, 'Restore');

    await expect(editor.getByRole('textbox', { name: 'Item Value' })).toHaveCount(2);
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(() => github.readFile(POST_PATH))
      .toBe(
        FIRST_POST.replace('  - one\n', '').replace(
          '  - label: Home\n    url: https://example.com/\n',
          '',
        ),
      );
  });
});
