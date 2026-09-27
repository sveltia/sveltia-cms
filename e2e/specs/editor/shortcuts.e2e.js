import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { selectText } from '../../fixtures/rich-text.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
});

/**
 * Open the First Light post and wait for its fields.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const openFirstLight = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Light/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');

  return editor;
};

test('saves with Accel+S', async ({ cms, page }) => {
  const editor = await openFirstLight(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Last Light');
  await page.keyboard.press('ControlOrMeta+s');

  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
  expect((await cms.readRepo())['content/posts/2026-01-first-light.md']).toContain(
    'title: Last Light\n',
  );
  // The editor is closed after saving
  await expect(editor).toBeHidden();
});

test('saves with Accel+S right after a rich text shortcut', async ({ cms, page }) => {
  const editor = await openFirstLight(page);
  const body = editor.getByRole('textbox', { name: 'Body' });

  // The rich text editor writes a change to the draft a moment after it’s made, and the Save
  // button used to be disabled until then, so the shortcut was ignored
  await selectText(body, 'observatory');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('ControlOrMeta+s');

  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
  expect((await cms.readRepo())['content/posts/2026-01-first-light.md']).toContain(
    '\nThe **observatory** opens its doors.\n',
  );
});

test('saves with Accel+S right after another rich text shortcut', async ({ cms, page }) => {
  // The editor opens with a view transition, which used to catch the hit test Sveltia UI makes
  // before activating a button with its shortcut, so a shortcut pressed before the transition was
  // over was ignored. It showed here in about a third of the runs
  const editor = await openFirstLight(page);
  const body = editor.getByRole('textbox', { name: 'Body' });

  await selectText(body, 'observatory');
  await page.keyboard.press('ControlOrMeta+b');
  await expect(
    editor.getByRole('document', { name: 'Content Preview' }).locator('strong'),
  ).toHaveText('observatory');
  await selectText(body, 'opens');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('ControlOrMeta+s');

  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
  expect((await cms.readRepo())['content/posts/2026-01-first-light.md']).toContain(
    '\nThe **observatory** **opens** its doors.\n',
  );
});

test('ignores Accel+S while there’s nothing to save', async ({ cms, page }) => {
  const editor = await openFirstLight(page);
  const files = await cms.readRepo();

  await page.keyboard.press('ControlOrMeta+s');
  await page.waitForTimeout(500);
  await expect(editor).toBeVisible();
  expect(await cms.readRepo()).toEqual(files);
});

test('closes the editor with Escape', async ({ page }) => {
  const editor = await openFirstLight(page);

  await editor.getByRole('textbox', { name: 'Title' }).click();
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(page.getByRole('row', { name: /First Light/ })).toBeVisible();
});

test('closes the editor with Escape pressed right after it opens', async ({ page }) => {
  // The editor opens with a view transition, which used to catch the hit test Sveltia UI makes
  // before activating a button with its shortcut, so the key was ignored until it was over
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Light/ }).click();
  await expect(editor.getByRole('button', { name: 'Cancel Editing' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
});

test('closes a menu with Escape, leaving the editor open', async ({ page }) => {
  const editor = await openFirstLight(page);
  const menu = page.getByRole('menu', { name: 'Editor Options' });

  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(editor).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
});

test('cancels editing the slug with Escape, leaving the editor open', async ({ cms, page }) => {
  const editor = await openFirstLight(page);

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Edit Slug' }),
  );

  const panel = page.getByRole('group', { name: 'Slug', exact: true });

  await panel.getByRole('button', { name: 'Edit Slug' }).click();
  await panel.getByRole('textbox', { name: 'Slug' }).fill('2026-01-changed');
  await page.keyboard.press('Escape');

  await expect(panel.getByRole('textbox', { name: 'Slug' })).toHaveText('2026-01-first-light');
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
});
