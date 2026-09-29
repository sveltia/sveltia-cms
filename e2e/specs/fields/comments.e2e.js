import { expect, test } from '../../fixtures/test.js';

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
  });
  await cms.signIn();
});

test('writes the field comments to the front matter without showing them', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /Hello/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

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
