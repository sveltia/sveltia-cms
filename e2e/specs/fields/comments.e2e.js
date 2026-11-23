import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * A blog whose fields carry the `comment` option, which Netlify/Decap CMS writes to the file as a
 * YAML comment for developers, rather than showing it to editors.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title', comment: 'Shown as the page heading' },
        {
          name: 'seo',
          label: 'SEO',
          widget: 'object',
          fields: [
            {
              name: 'description',
              label: 'Description',
              comment: 'Used by search engines\\nKeep it short',
            },
          ],
        },
        {
          name: 'links',
          label: 'Links',
          widget: 'list',
          comment: 'Related pages',
          fields: [{ name: 'url', label: 'URL', comment: 'Not repeated on every item' }],
        },
        { name: 'body', label: 'Body', widget: 'markdown', required: false },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'content/posts/hello.md': '---\ntitle: Hello\nseo:\n  description: Hi\nlinks: []\n---\n',
    'content/posts/notes.md': [
      '---',
      '# Oh hai!',
      '# Never mind these.',
      '',
      '# Shown as the page heading',
      'title: Notes',
      'seo:',
      '  description: Hi',
      'links:',
      '  - url: /about',
      '---',
      '',
    ].join('\n'),
  });
  await cms.signIn();
});

test('writes the field comments to the front matter without showing them', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /Hello/ }).click();

  const editor = getEditor(page);

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Hello');
  // The comments are meant for developers reading the file, not for editors
  await expect(editor.getByText('Shown as the page heading')).toHaveCount(0);
  await expect(editor.getByText(/Used by search engines/)).toHaveCount(0);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello World');
  await editor.getByRole('button', { name: /Add.*Links/ }).click();
  await editor.getByRole('textbox', { name: 'URL' }).fill('/about');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/hello.md'])
    .toBe(
      [
        '---',
        '# Shown as the page heading',
        'title: Hello World',
        'seo:',
        '  # Used by search engines',
        '  # Keep it short',
        '  description: Hi',
        '# Related pages',
        'links:',
        '  - url: /about',
        '---',
        '',
      ].join('\n'),
    );
});

test('keeps the comments at the top of the front matter without repeating them', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /Notes/ }).click();

  const editor = getEditor(page);
  const title = editor.getByRole('textbox', { name: 'Title' });

  await expect(title).toHaveValue('Notes');
  await title.fill('Notes 1');
  await editor.getByRole('button', { name: 'Save' }).click();

  /**
   * Get the file as it should be saved with the given title.
   * @param {string} value Title.
   * @returns {string} File content.
   */
  const expected = (value) =>
    [
      '---',
      '# Oh hai!',
      '# Never mind these.',
      '',
      '# Shown as the page heading',
      `title: ${value}`,
      'seo:',
      '  # Used by search engines',
      '  # Keep it short',
      '  description: Hi',
      '# Related pages',
      'links:',
      '  - url: /about',
      '---',
      '',
    ].join('\n');

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/notes.md'])
    .toBe(expected('Notes 1'));

  // Saving again doesn’t take the field comment for one at the top of the file
  await page.getByRole('row', { name: /Notes 1/ }).click();
  await expect(title).toHaveValue('Notes 1');
  await title.fill('Notes 2');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/notes.md'])
    .toBe(expected('Notes 2'));
});
