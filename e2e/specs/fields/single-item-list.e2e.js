import { expect, test } from '../../fixtures/test.js';

/**
 * A blog whose posts have List fields limited to one item: a required author and an optional
 * sponsor, each stored as an array holding a single object.
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
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'author',
          label: 'Author',
          widget: 'list',
          max: 1,
          fields: [{ name: 'name', label: 'Name' }],
        },
        {
          name: 'sponsor',
          label: 'Sponsor',
          widget: 'list',
          max: 1,
          required: false,
          fields: [{ name: 'name', label: 'Name' }],
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  // The post was saved before the author field was added
  await cms.seed({ 'content/posts/hello.yml': 'title: Hello\nsponsor: []\n' });
  await cms.signIn();
});

test('fills in the item of a required list limited to one item', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const author = editor.getByRole('group', { name: 'Author', exact: true });
  const sponsor = editor.getByRole('group', { name: 'Sponsor', exact: true });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Night Sky');
  // The author’s subfields are there to fill in, without the list controls
  await author.getByRole('textbox', { name: 'Name' }).fill('Melvin');
  await expect(author.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await expect(author.getByText(/1 Author/)).toHaveCount(0);
  // The optional sponsor is added on demand
  await sponsor.getByRole('button', { name: /Add.*Sponsor/ }).click();
  await sponsor.getByRole('textbox', { name: 'Name' }).fill('Acme');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/night-sky.yml'])
    .toBe('title: Night Sky\nauthor:\n  - name: Melvin\nsponsor:\n  - name: Acme\n');
});

test('adds the missing item to an existing entry without counting it as a change', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /Hello/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const saveButton = editor.getByRole('button', { name: 'Save' });
  const name = editor.getByRole('group', { name: 'Author', exact: true }).getByRole('textbox');

  await expect(name).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await name.fill('Elsie');
  await saveButton.click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/hello.yml'])
    .toBe('title: Hello\nauthor:\n  - name: Elsie\nsponsor: []\n');
});
