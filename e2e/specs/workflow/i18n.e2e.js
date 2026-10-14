import { openEntryPullRequest, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, getEntryRows } from '../../fixtures/ui.js';
import { getEditPane, showLocale } from '../multilingual/helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({
  config: {
    ...WORKFLOW_CONFIG,
    i18n: { structure: 'multiple_folders', locales: ['en', 'ja'] },
    collections: [
      {
        ...WORKFLOW_CONFIG.collections[0],
        // Lets a locale be turned off for an entry
        i18n: { initial_locales: 'default' },
        fields: [
          { name: 'title', label: 'Title', i18n: true },
          { name: 'body', label: 'Body', widget: 'text', i18n: true },
        ],
      },
    ],
  },
});

const EN_PATH = 'content/posts/en/first-post.md';
const JA_PATH = 'content/posts/ja/first-post.md';

test.beforeEach(async ({ github }) => {
  github.commit({
    [EN_PATH]: '---\ntitle: First Post\n---\n\nHello, world!\n',
    [JA_PATH]: '---\ntitle: 最初の投稿\n---\n\nこんにちは世界！\n',
  });
});

/**
 * Get the button of the English editor pane switching it to Japanese, whose name tells whether the
 * locale is turned off.
 * @param {Page} page Page.
 * @returns {Locator} Radio button.
 */
const getJapaneseSwitcher = (page) =>
  getEditPane(page, 'English').getByRole('radio', { name: /^Japanese\b/ });

test('loads a pull request deleting a turned-off locale’s file as an edit', async ({
  cms,
  github,
  page,
}) => {
  // Saving the entry with Japanese turned off and nothing else changed deletes the Japanese file
  // only. That doesn’t make the pull request an Unpublish of the whole entry.
  openEntryPullRequest(github, { slug: 'first-post', files: { [JA_PATH]: null } });
  await cms.open();

  await expect(getEntryRows(page)).toHaveText([/First Post.*Draft/]);
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();
  await expect(page.getByRole('group', { name: 'Draft' })).toContainText('First Post');
  await expect(page.getByRole('group', { name: 'Pending Deletion' })).toHaveCount(0);
});

test('keeps a turned-off locale off when another locale changed too', async ({
  cms,
  github,
  page,
}) => {
  openEntryPullRequest(github, {
    slug: 'first-post',
    files: { [EN_PATH]: '---\ntitle: First Post\n---\n\nHello again!\n', [JA_PATH]: null },
  });
  await cms.open();
  await page.getByRole('row', { name: /First Post/ }).click();

  await expect(getEditPane(page, 'English').getByRole('textbox', { name: 'Body' })).toHaveValue(
    'Hello again!',
  );
  // The Japanese locale isn’t brought back from the published entry
  await expect(getJapaneseSwitcher(page)).toHaveAccessibleName('Japanese (disabled)');
});

test('offers no backup of a draft saved right after turning a locale off', async ({
  cms,
  github,
  page,
}) => {
  await cms.open();
  await page.getByRole('row', { name: /First Post/ }).click();

  const japanese = await showLocale(page, 1, 'Japanese');

  // Turning the locale off is the first change, and it’s backed up shortly after. Saving straight
  // away deletes the backup, but the editor stays open while asking whether to send the entry for
  // review, which used to give the pending backup time to be made again
  await cms.chooseMenuItem(
    japanese.getByRole('button', { name: /Show.*Japanese.*Content Options/ }),
    page.getByRole('menuitem', { name: /Disable.*Japanese/ }),
  );
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  const reviewDialog = page.getByRole('alertdialog', { name: 'Send for Review' });

  await expect(reviewDialog).toBeVisible();
  // Long enough for the backup to have been made
  await page.waitForTimeout(1000);
  await reviewDialog.getByRole('button', { name: 'Later' }).click();
  await expect.poll(() => github.readFile(JA_PATH, 'cms/posts/first-post')).toBeUndefined();

  // Reopen the draft: it isn’t offered to be restored from a backup, which would also take the
  // focus away from the field being edited
  await page.getByRole('row', { name: /First Post/ }).click();

  const body = getEditPane(page, 'English').getByRole('textbox', { name: 'Body' });

  await body.fill('Hello again!');
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeEnabled();
  await expect(page.getByRole('alertdialog', { name: 'Restore Draft' })).toHaveCount(0);
  await expect(body).toHaveValue('Hello again!');
});
