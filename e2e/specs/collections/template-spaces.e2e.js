import { expect, test } from '../../fixtures/test.js';
import { getEditor, getEntryList } from '../../fixtures/ui.js';

// Every template is written with spaces inside the curly braces and around the pipes, which the
// CMS treats like the canonical `{{slug}}` and `{{title | upper}}` forms
test.use({
  config: {
    backend: { name: 'test-repo' },
    media_folder: 'static/images',
    collections: [
      {
        name: 'posts',
        label: 'Posts',
        label_singular: 'Post',
        folder: 'content/posts',
        create: true,
        slug: '{{ title|lower }}',
        path: '{{ slug }}/index',
        summary: '{{ title | upper }}',
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'upper', label: 'Upper', widget: 'compute', value: '{{ fields.title|upper }}' },
          // The current date and time are only filled in for a `default` of exactly `{{now}}`
          { name: 'date', label: 'Date', widget: 'datetime', default: '{{ now }}' },
          {
            name: 'permalink',
            widget: 'hidden',
            default: 'posts/\\{{ page.fileSlug }}/',
          },
        ],
      },
    ],
  },
});

test('treats a template with spaces inside the tags like the canonical one', async ({
  cms,
  page,
}) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Hello World');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/hello-world/index.md'])
    .toMatch(
      /^---\ntitle: Hello World\nupper: HELLO WORLD\ndate: \d{4}-\d{2}-\d{2}T[\d:.]+Z?\npermalink: posts\/\{\{ page\.fileSlug \}\}\/\n---\n$/,
    );

  const row = getEntryList(page).getByRole('row', { name: 'Hello World', exact: true });

  await expect(row.getByRole('gridcell', { name: 'HELLO WORLD', exact: true })).toBeVisible();
  // The slug is read back from the path, so the entry opens again
  await row.click();
  await expect(editor.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Hello World',
  );
});
