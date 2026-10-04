import { expect, test } from '../fixtures/test.js';

/**
 * A file in the `raw` format, edited as a whole in a single optional field. Leaving the field empty
 * omits it, so the file is saved with no content at all.
 */
test.use({
  config: {
    backend: { name: 'test-repo' },
    media_folder: 'static/uploads',
    output: { omit_empty_optional_fields: true },
    collections: [
      {
        name: 'files',
        label: 'Files',
        files: [
          {
            name: 'robots',
            label: 'Robots',
            file: 'static/robots.txt',
            format: 'raw',
            fields: [{ name: 'body', label: 'Body', widget: 'text', required: false }],
          },
        ],
      },
    ],
  },
});

test('empties a raw file', async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ 'static/robots.txt': 'User-agent: *\n' });
  await cms.signIn();
  await page.getByRole('row', { name: 'Robots' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const body = editor.getByRole('textbox', { name: 'Body' });

  await expect(body).toHaveValue('User-agent: *');
  await body.fill('');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(editor).toBeHidden();
  expect((await cms.readRepo())['static/robots.txt']).toBe('');
});
