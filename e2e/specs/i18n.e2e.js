import { BASE_CONFIG, expect, test } from '../fixtures/test.js';
import { getEditor } from '../fixtures/ui.js';

test.use({
  config: {
    ...BASE_CONFIG,
    i18n: { structure: 'multiple_files', locales: ['en', 'fr'] },
    collections: [
      {
        ...BASE_CONFIG.collections[0],
        i18n: true,
        fields: [
          { name: 'title', label: 'Title', i18n: true },
          { name: 'body', label: 'Body', widget: 'text', i18n: true },
        ],
      },
    ],
  },
});

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'content/posts/hello.en.md': '---\ntitle: Hello\n---\n\nHow are you?\n',
    'content/posts/hello.fr.md': '---\ntitle: Bonjour\n---\n\nComment allez-vous ?\n',
    // An entry without a file in the default locale
    'content/posts/salut.fr.md': '---\ntitle: Salut\n---\n\nÇa va ?\n',
  });
  await cms.signIn();
});

test('creates an entry in every locale', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);
  const english = editor.getByRole('group', { name: /Edit.*English/ });
  const french = editor.getByRole('group', { name: /Edit.*French/ });

  await english.getByRole('textbox', { name: 'Title' }).fill('Good Morning');
  await english.getByRole('textbox', { name: 'Body' }).fill('Have a nice day.');
  // The second pane shows the preview until another locale is picked
  await editor
    .getByRole('group', { name: /Preview/ })
    .getByRole('radio', { name: 'French' })
    .click();
  await french.getByRole('textbox', { name: 'Title' }).fill('Bon matin');
  await french.getByRole('textbox', { name: 'Body' }).fill('Bonne journée.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => {
      const files = await cms.readRepo();

      return [files['content/posts/good-morning.en.md'], files['content/posts/good-morning.fr.md']];
    })
    .toEqual([
      '---\ntitle: Good Morning\n---\n\nHave a nice day.\n',
      '---\ntitle: Bon matin\n---\n\nBonne journée.\n',
    ]);
});

test('updates one locale only', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Hello/ }).click();

  const editor = getEditor(page);

  // Show French in the first pane
  await editor
    .getByRole('group', { name: /Edit.*English/ })
    .getByRole('radio', { name: 'French' })
    .click();

  const body = editor.getByRole('group', { name: /Edit.*French/ }).getByRole('textbox', {
    name: 'Body',
  });

  await expect(body).toHaveValue('Comment allez-vous ?');
  await body.fill('Ça va bien ?');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/hello.fr.md'])
    .toBe('---\ntitle: Bonjour\n---\n\nÇa va bien ?\n');
  expect((await cms.readRepo())['content/posts/hello.en.md']).toBe(
    '---\ntitle: Hello\n---\n\nHow are you?\n',
  );
});

test('updates an entry without a file in the default locale', async ({ cms, page }) => {
  const path = 'content/posts/salut.fr.md';

  await page.getByRole('row', { name: /Salut/ }).click();

  const editor = getEditor(page);

  // English is disabled; show French in the first pane
  await editor
    .getByRole('group', { name: /Edit.*English/ })
    .getByRole('radio', { name: 'French' })
    .click();
  await editor
    .getByRole('group', { name: /Edit.*French/ })
    .getByRole('textbox', { name: 'Title' })
    .fill('Coucou');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The save failed, as the entry has no English file to take its path from
  await expect
    .poll(async () => (await cms.readRepo())[path])
    .toBe('---\ntitle: Coucou\n---\n\nÇa va ?\n');
  expect((await cms.readRepo())['content/posts/salut.en.md']).toBeUndefined();
});
