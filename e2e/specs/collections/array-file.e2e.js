import { createPNG } from '../../fixtures/files.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';
import { getEditor, showLocale } from '../multilingual/helpers.js';

import { getEntryList, openCollection } from './helpers.js';

/**
 * @import { Page } from '@playwright/test';
 */

const MEMBERS = 'data/members.json';

/**
 * Entry collection storing all the entries in one JSON file.
 */
const MEMBERS_COLLECTION = {
  name: 'members',
  label: 'Members',
  label_singular: 'Member',
  file: MEMBERS,
  identifier_field: 'name',
  fields: [
    { name: 'name', label: 'Name' },
    { name: 'role', label: 'Role', required: false },
  ],
};

/**
 * The members file, as the developer wrote it: an item has a property that isn’t a field, and
 * another item isn’t an object at all, so neither makes an entry of its own.
 */
const MEMBERS_FILE = `[
  {
    "name": "Alice",
    "role": "Chair",
    "since": 2019
  },
  "TBD",
  {
    "name": "Bob",
    "role": "Treasurer"
  },
  {
    "name": "Carol",
    "role": "Secretary"
  }
]
`;

/**
 * Format the members file as the CMS writes it.
 * @param {any[]} items Items.
 * @returns {string} File content.
 */
const format = (items) => `${JSON.stringify(items, null, 2)}\n`;
const ALICE = { name: 'Alice', role: 'Chair', since: 2019 };
const BOB = { name: 'Bob', role: 'Treasurer' };
const CAROL = { name: 'Carol', role: 'Secretary' };

/**
 * Open a member in the entry editor.
 * @param {Page} page Page.
 * @param {string} name Member name.
 * @returns {Promise<import('@playwright/test').Locator>} Editor.
 */
const openMember = async (page, name) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: new RegExp(name) }).click();
  await expect(editor.getByRole('textbox', { name: 'Name' })).toHaveValue(name);

  return editor;
};

test.describe('test repository', () => {
  test.use({
    config: { ...GITHUB_CONFIG, backend: { name: 'test-repo' }, collections: [MEMBERS_COLLECTION] },
  });

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed({ [MEMBERS]: MEMBERS_FILE });
    await cms.signIn();
    await openCollection(page, 'Members');
  });

  test('lists an entry for each object in the file, in their order', async ({ page }) => {
    await expect(getEntryList(page)).toMatchAriaSnapshot(`
      - rowgroup:
        - row /Alice/
        - row /Bob/
        - row /Carol/
    `);
  });

  test('saves an entry in place, leaving the other items alone', async ({ cms, page }) => {
    const editor = await openMember(page, 'Bob');

    await editor.getByRole('textbox', { name: 'Role' }).fill('Vice Chair');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([ALICE, 'TBD', { name: 'Bob', role: 'Vice Chair' }, CAROL]));
  });

  test('keeps the properties that aren’t fields when saving an entry', async ({ cms, page }) => {
    const editor = await openMember(page, 'Alice');

    await editor.getByRole('textbox', { name: 'Role' }).fill('President');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([{ ...ALICE, role: 'President' }, 'TBD', BOB, CAROL]));
  });

  test('adds a new entry to the end of the file', async ({ cms, page }) => {
    await page.getByRole('button', { name: 'Create New Entry' }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Name' }).fill('Dave');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([ALICE, 'TBD', BOB, CAROL, { name: 'Dave', role: '' }]));
    await expect(getEntryList(page).getByRole('row').last()).toHaveAccessibleName(/Dave/);
  });

  test('saves an entry twice without reloading', async ({ cms, page }) => {
    await page.getByRole('button', { name: 'Create New Entry' }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Name' }).fill('Dave');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('row', { name: /Dave/ })).toBeVisible();

    const reopened = await openMember(page, 'Dave');

    await reopened.getByRole('textbox', { name: 'Role' }).fill('Member');
    await reopened.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([ALICE, 'TBD', BOB, CAROL, { name: 'Dave', role: 'Member' }]));
  });

  test('removes a deleted entry from the file', async ({ cms, page }) => {
    await openMember(page, 'Alice');
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitem', { name: 'Delete Entry' }),
    );
    await page
      .getByRole('alertdialog', { name: 'Delete Entry' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format(['TBD', BOB, CAROL]));
    await expect(getEntryList(page)).toMatchAriaSnapshot(`
      - rowgroup:
        - row /Bob/
        - row /Carol/
    `);
  });

  test('reorders the entries by moving the items in the file', async ({ cms, page }) => {
    await page.getByRole('button', { name: 'Reorder Entries' }).click();
    await page.getByRole('row', { name: /Carol/ }).getByRole('button', { name: 'Move Up' }).click();
    await page.getByRole('button', { name: 'Done Reordering Entries' }).click();

    // The item that isn’t an entry stays where it is
    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([ALICE, 'TBD', CAROL, BOB]));
    await expect(getEntryList(page)).toMatchAriaSnapshot(`
      - rowgroup:
        - row /Alice/
        - row /Carol/
        - row /Bob/
    `);

    // The entries can be edited in their new positions
    const editor = await openMember(page, 'Bob');

    await editor.getByRole('textbox', { name: 'Role' }).fill('Auditor');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([ALICE, 'TBD', CAROL, { name: 'Bob', role: 'Auditor' }]));
  });
});

test.describe('GitHub', () => {
  test.use({ config: { ...GITHUB_CONFIG, collections: [MEMBERS_COLLECTION] } });

  test.beforeEach(async ({ github }) => {
    github.commit({ [MEMBERS]: MEMBERS_FILE });
  });

  test('keeps a colleague’s change to another entry', async ({ cms, github, page }) => {
    await cms.open();
    await openCollection(page, 'Members');

    const editor = await openMember(page, 'Bob');

    github.commit({ [MEMBERS]: format([{ ...ALICE, role: 'President' }, 'TBD', BOB, CAROL]) });
    await editor.getByRole('textbox', { name: 'Role' }).fill('Vice Chair');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(() => github.readFile(MEMBERS))
      .toBe(
        format([
          { ...ALICE, role: 'President' },
          'TBD',
          { name: 'Bob', role: 'Vice Chair' },
          CAROL,
        ]),
      );
    // The commit message names the entry rather than its position
    expect(github.received.map(({ message }) => message.headline)).toEqual(['Update Member “Bob”']);
  });

  test('refuses to save over a colleague’s change to the same entry', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();
    await openCollection(page, 'Members');

    const editor = await openMember(page, 'Bob');
    const changed = format([ALICE, 'TBD', { name: 'Bob', role: 'Auditor' }, CAROL]);

    github.commit({ [MEMBERS]: changed });
    await editor.getByRole('textbox', { name: 'Role' }).fill('Vice Chair');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The entry is told by its position, and the item there can’t be told from another entry that
    // has moved there, so it’s never overwritten
    const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

    await expect(dialog).toContainText('Cancel editing, then open the entry again from the list');
    await expect(dialog.getByRole('button', { name: 'Save Anyway' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).toBeHidden();
    expect(github.received).toHaveLength(0);
    expect(github.readFile(MEMBERS)).toBe(changed);
  });

  test('leaves alone an entry that has moved to the position of the entry being saved', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();
    await openCollection(page, 'Members');

    const editor = await openMember(page, 'Bob');
    // A colleague has added a member at the top, so Alice is now where Bob was
    const shifted = format([{ name: 'Zoe' }, 'TBD', ALICE, BOB, CAROL]);

    github.commit({ [MEMBERS]: shifted });
    await editor.getByRole('textbox', { name: 'Role' }).fill('Vice Chair');
    await editor.getByRole('button', { name: 'Save' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save Anyway' })).toHaveCount(0);
    expect(github.received).toHaveLength(0);
    expect(github.readFile(MEMBERS)).toBe(shifted);
  });

  test('keeps showing an open entry when another one moves to its position', async ({
    cms,
    github,
    page,
  }) => {
    await page.clock.install();
    await cms.open();
    await openCollection(page, 'Members');

    const editor = await openMember(page, 'Bob');

    // A colleague has added a member at the top, so Alice is now where Bob was
    github.commit({ [MEMBERS]: format([{ name: 'Zoe' }, 'TBD', ALICE, BOB, CAROL]) });
    // Coming back to the window checks for changes, once some time has passed since the last check
    await page.clock.fastForward('00:11');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    const notice = editor.getByRole('alert');

    await expect(notice).toContainText('open the entry again from the list');
    await expect(notice.getByRole('button', { name: 'Reload Entry' })).toHaveCount(0);
    // The untouched entry isn’t replaced with the one now at its position
    await expect(editor.getByRole('textbox', { name: 'Name' })).toHaveValue('Bob');
  });

  test('refuses to delete an entry that a colleague has moved', async ({ cms, github, page }) => {
    await cms.open();
    await openCollection(page, 'Members');
    await page.getByRole('checkbox', { name: /Select.*Alice/ }).check();

    // A colleague has put a new member first, so the item the user has seen is now second
    github.commit({ [MEMBERS]: format([{ name: 'Zoe' }, ALICE, 'TBD', BOB, CAROL]) });
    await page.getByRole('button', { name: /^Delete Selected Entr(y|ies)$/ }).click();
    await page
      .getByRole('alertdialog', { name: /^Delete Entr(y|ies)$/ })
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(page.getByRole('alert')).toContainText(
      'An entry stored in the same file has been changed by someone else.',
    );
    expect(github.received).toHaveLength(0);
    expect(github.readFile(MEMBERS)).toBe(format([{ name: 'Zoe' }, ALICE, 'TBD', BOB, CAROL]));
  });
});

test.describe('i18n', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      backend: { name: 'test-repo' },
      // The site-level structure doesn’t apply, as each item holds all the translations
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'] },
      collections: [
        {
          ...MEMBERS_COLLECTION,
          i18n: true,
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'role', label: 'Role', i18n: true, required: false },
          ],
        },
      ],
    },
  });

  test('saves a translation in the item of the entry', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({
      [MEMBERS]: format([
        { en: { name: 'Alice', role: 'Chair' }, fr: { name: 'Alice', role: 'Présidente' } },
        { en: { name: 'Bob', role: 'Treasurer' }, fr: { name: 'Bob', role: 'Trésorier' } },
      ]),
    });
    await cms.signIn();
    await openCollection(page, 'Members');
    await page.getByRole('row', { name: /Bob/ }).click();

    const french = await showLocale(page, 1, 'French');

    await expect(french.getByRole('textbox', { name: 'Role' })).toHaveValue('Trésorier');
    await french.getByRole('textbox', { name: 'Role' }).fill('Trésorier adjoint');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(
        format([
          { en: { name: 'Alice', role: 'Chair' }, fr: { name: 'Alice', role: 'Présidente' } },
          {
            en: { name: 'Bob', role: 'Treasurer' },
            fr: { name: 'Bob', role: 'Trésorier adjoint' },
          },
        ]),
      );
  });
});

test.describe('entry-relative media folder', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      backend: { name: 'test-repo' },
      collections: [
        {
          ...MEMBERS_COLLECTION,
          media_folder: 'images',
          public_folder: 'images',
          fields: [
            ...MEMBERS_COLLECTION.fields,
            { name: 'photo', label: 'Photo', widget: 'image', required: false },
          ],
        },
      ],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      [MEMBERS]: format([
        { name: 'Alice', photo: 'images/alice.png' },
        { name: 'Bob', photo: 'images/bob.png' },
      ]),
      'data/images/alice.png': createPNG({ color: [255, 0, 0] }),
      'data/images/bob.png': createPNG({ color: [0, 0, 255] }),
    });
    await cms.signIn();
  });

  test('updates the reference to a renamed image in the item using it', async ({ cms, page }) => {
    await page.getByRole('radio', { name: 'Assets' }).click();
    await page.getByRole('option', { name: /Members/ }).click();
    await page.getByRole('row', { name: 'bob.png' }).click();
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Edit Options' }),
      page.getByRole('menuitem', { name: 'Rename Asset' }),
    );

    const dialog = page.getByRole('dialog', { name: /Rename.*bob\.png/ });

    await dialog.getByRole('textbox').fill('robert.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(
        format([
          { name: 'Alice', photo: 'images/alice.png' },
          { name: 'Bob', photo: 'images/robert.png' },
        ]),
      );
    expect(Object.keys(await cms.readRepo())).toContain('data/images/robert.png');
  });

  test('leaves the images alone when an entry is deleted', async ({ cms, page }) => {
    await openCollection(page, 'Members');
    await openMember(page, 'Bob');
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitem', { name: 'Delete Entry' }),
    );
    await page
      .getByRole('alertdialog', { name: 'Delete Entry' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect
      .poll(async () => (await cms.readRepo())[MEMBERS])
      .toBe(format([{ name: 'Alice', photo: 'images/alice.png' }]));

    // The entries share the folder of the file, and another entry could use any image in it
    const paths = Object.keys(await cms.readRepo());

    expect(paths).toContain('data/images/alice.png');
    expect(paths).toContain('data/images/bob.png');
  });
});
