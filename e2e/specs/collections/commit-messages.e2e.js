import {
  COLLECTION_OPTIONS_CONFIG,
  COLLECTION_OPTIONS_FILES,
} from '../../fixtures/configs/collection-options.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

import { openCollection } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { MockGitHub } from '../../fixtures/github.js';
 */

test.use({
  config: {
    ...COLLECTION_OPTIONS_CONFIG,
    backend: {
      ...GITHUB_CONFIG.backend,
      commit_messages: {
        create: 'content: add {{collection}} “{{slug}}” by {{author-login}}',
        update: 'content: edit {{path}}',
        delete: 'content: remove {{collection}} “{{slug}}” ({{author-name}})',
        uploadMedia: 'media: add {{path}} by {{author-email}}',
      },
    },
  },
});

test.beforeEach(async ({ cms, github, page }) => {
  github.commit(COLLECTION_OPTIONS_FILES, { message: 'Plant the garden' });
  await cms.open();
  await openCollection(page, 'FAQs');
});

/**
 * Get the headlines of the commits the CMS has made.
 * @param {MockGitHub} github GitHub mock.
 * @returns {string[]} Headlines, the oldest first.
 */
const getHeadlines = (github) => github.received.map(({ message }) => message.headline);

/**
 * Open an FAQ in the entry editor.
 * @param {Page} page Page.
 * @param {RegExp} question Question.
 * @returns {Promise<Locator>} Editor.
 */
const openFAQ = async (page, question) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: question }).click();
  await expect(editor.getByRole('textbox', { name: 'Question' })).toHaveValue(question);

  return editor;
};

test('fills the templates for a new entry', async ({ github, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Question' }).fill('Is there parking?');
  await editor.getByRole('textbox', { name: 'Answer' }).fill('On the street.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => getHeadlines(github))
    .toEqual(['content: add FAQ “is-there-parking” by mona']);
  expect(github.readFile('content/faqs/is-there-parking.md')).toBe(
    '---\norder: 4\nquestion: Is there parking?\nanswer: On the street.\n---\n',
  );
});

test('fills the templates for an updated entry', async ({ github, page }) => {
  const editor = await openFAQ(page, /Who can join\?/);

  await editor.getByRole('textbox', { name: 'Answer' }).fill('Anyone in the neighborhood.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => getHeadlines(github))
    .toEqual(['content: edit content/faqs/who-can-join.md']);
});

test('counts the other files a commit changes', async ({ github, page }) => {
  await page.getByRole('button', { name: 'Reorder Entries' }).click();
  await page
    .getByRole('row', { name: /Are tools provided/ })
    .getByRole('button', { name: 'Move Up' })
    .click();
  await page.getByRole('button', { name: 'Done Reordering Entries' }).click();

  // Two entries are renumbered in one commit, which is named after the first
  await expect
    .poll(() => getHeadlines(github))
    .toEqual([expect.stringMatching(/^content: edit content\/faqs\/[\w-]+\.md \+1$/)]);
  expect(github.readFile('content/faqs/are-tools-provided.md')).toMatch(/^---\norder: 2\n/);
  expect(github.readFile('content/faqs/who-can-join.md')).toMatch(/^---\norder: 3\n/);
});

test('fills the templates for a deleted entry', async ({ cms, github, page }) => {
  await openFAQ(page, /Are tools provided\?/);
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Delete Entry' }),
  );
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(() => getHeadlines(github))
    .toEqual(['content: remove FAQ “are-tools-provided” (Mona Lisa)']);
  expect(github.readFile('content/faqs/are-tools-provided.md')).toBeUndefined();
});

test('fills the templates for uploaded files', async ({ github, page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  // The empty asset list has an Upload button of its own
  await page.getByRole('button', { name: 'Upload New Assets' }).first().click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles([
    { name: 'kale.png', mimeType: 'image/png', buffer: createPNG({ color: [0, 128, 0] }) },
    { name: 'leek.png', mimeType: 'image/png', buffer: createPNG({ color: [128, 255, 128] }) },
  ]);
  await page
    .getByRole('alertdialog', { name: 'Upload New Assets' })
    .getByRole('button', { name: 'Upload' })
    .click();

  await expect
    .poll(() => getHeadlines(github))
    .toEqual(['media: add static/uploads/kale.png by mona@example.com +1']);
});

test.describe('with `skip_ci` on', () => {
  test.use({
    config: {
      ...COLLECTION_OPTIONS_CONFIG,
      backend: { ...GITHUB_CONFIG.backend, skip_ci: true },
    },
  });

  test('marks a commit to skip the CI, except a deletion', async ({ cms, github, page }) => {
    const editor = await openFAQ(page, /Who can join\?/);

    await editor.getByRole('textbox', { name: 'Answer' }).fill('Anyone in the neighborhood.');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => github.received).toHaveLength(1);

    // Saving closes the editor
    await openFAQ(page, /Who can join\?/);
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitem', { name: 'Delete Entry' }),
    );
    await page
      .getByRole('alertdialog', { name: 'Delete Entry' })
      .getByRole('button', { name: 'Delete' })
      .click();

    // Deleting the entry renumbers the one after it in the same commit
    await expect
      .poll(() => getHeadlines(github))
      .toEqual(['[skip ci] Update FAQ “who-can-join”', 'Delete FAQ “who-can-join” +1']);
  });
});
