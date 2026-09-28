import { expect, test } from '../../fixtures/test.js';

/**
 * A blog whose posts have fields with default values, including a required KeyValue field and a
 * required List field limited to one item, whose defaults are a blank pair and a blank item.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      extension: 'yml',
      fields: [
        { name: 'title', label: 'Title', default: 'Untitled' },
        { name: 'tags', label: 'Tags', widget: 'list', default: ['news'] },
        { name: 'metadata', label: 'Metadata', widget: 'keyvalue' },
        {
          name: 'author',
          label: 'Author',
          widget: 'list',
          max: 1,
          fields: [{ name: 'name', label: 'Name', default: 'Anonymous' }],
        },
        {
          name: 'links',
          label: 'Links',
          label_singular: 'Link',
          widget: 'list',
          required: false,
          fields: [{ name: 'url', label: 'URL' }],
        },
      ],
    },
  ],
};

const PATH = 'content/posts/hello.yml';

const FILE = [
  'title: Hello',
  'tags:',
  '  - a',
  '  - b',
  'metadata:',
  '  color: red',
  'author:',
  '  - name: Melvin',
  'links:',
  '  - url: https://example.com',
  '  - url: https://example.org',
  '',
].join('\n');

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ [PATH]: FILE });
  await cms.signIn();
  await page.getByRole('row', { name: /Hello/ }).click();
  await expect(
    page
      .getByRole('group', { name: 'Content Editor' })
      .getByRole('group', { name: /Links.*Field/ }),
  ).toBeVisible();
});

test('restores the default values of the entry and saves them', async ({ cms, page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Restore Default' }),
  );
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restore Default' }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Untitled');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The required KeyValue field gets a blank row to fill in, which can’t be saved as it is
  await expect(
    editor.getByRole('group', { name: /Metadata.*Field/ }).getByRole('alert'),
  ).toBeVisible();
  expect((await cms.readRepo())[PATH]).toBe(FILE);

  const metadata = editor.getByRole('group', { name: /Metadata.*Field/ });

  await metadata.getByRole('textbox', { name: 'Key' }).fill('size');
  await metadata.getByRole('textbox', { name: 'Value' }).fill('L');
  // The error goes away as soon as the pair is filled in
  await expect(metadata.getByRole('alert')).toBeHidden();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(
      [
        'title: Untitled',
        'tags:',
        '  - news',
        'metadata:',
        '  size: L',
        'author:',
        '  - name: Anonymous',
        'links: []',
        '',
      ].join('\n'),
    );
});

test('reverts a cleared list', async ({ page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const links = editor.getByRole('group', { name: /Links.*Field/ });
  const optionsButton = links.getByRole('button', { name: 'Show Field Options' }).first();

  await optionsButton.click();
  await page.getByRole('menuitem', { name: 'Clear' }).click();
  await expect(links.getByText('0 Links')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled();

  // The items come back in their original order, and the entry is no longer modified
  await optionsButton.click();
  await page.getByRole('menuitem', { name: 'Revert Changes' }).click();
  await expect
    .poll(() =>
      links
        .getByRole('textbox', { name: 'URL' })
        .evaluateAll((inputs) => inputs.map((input) => /** @type {any} */ (input).value)),
    )
    .toEqual(['https://example.com', 'https://example.org']);
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
});
