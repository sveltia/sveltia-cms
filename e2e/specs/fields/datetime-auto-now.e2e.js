import { expect, test } from '../../fixtures/test.js';

/**
 * A blog whose posts record when they were created and last updated, with DateTime fields set on
 * save by the `auto_now` option.
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
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'date',
          label: 'Date',
          widget: 'datetime',
          output_utc: true,
          auto_now: ['create'],
        },
        {
          name: 'lastmod',
          label: 'Last Modified',
          widget: 'datetime',
          output_utc: true,
          auto_now: true,
        },
      ],
    },
  ],
};

const PATH = 'content/posts/hello.yml';

// The values are shown in local time
test.use({ config: CONFIG, timezoneId: 'UTC' });

test.beforeEach(async ({ cms, page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T12:34:56Z'));
  await cms.open();
  await cms.seed({
    [PATH]: [
      'title: Hello',
      'date: 2026-01-01T00:00:07Z',
      'lastmod: 2026-01-02T00:00:00Z',
      '',
    ].join('\n'),
  });
  await cms.signIn();
});

test('sets the creation and modification dates when an entry is created', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  // The fields have no value until the entry is saved, so they’re hidden, and they don’t stop the
  // entry from being saved although they’re required
  await editor.getByRole('textbox', { name: 'Title' }).fill('Bonjour');
  await expect(editor.getByRole('group', { name: /Date/ })).toBeHidden();
  await expect(editor.getByRole('group', { name: /Last Modified/ })).toBeHidden();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/bonjour.yml'])
    .toBe(
      ['title: Bonjour', 'date: 2026-09-28T12:34:56Z', 'lastmod: 2026-09-28T12:34:56Z', ''].join(
        '\n',
      ),
    );
});

test('only sets the modification date when an entry is updated', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Hello/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  // Once saved, the fields show their values as text, which can’t be edited
  await expect(editor.getByRole('group', { name: /Last Modified/ })).toContainText(
    'Jan 2, 2026, 12:00 AM',
  );
  await expect(editor.getByRole('textbox', { name: 'Last Modified' })).toHaveCount(0);
  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(
      ['title: Hello!', 'date: 2026-01-01T00:00:07Z', 'lastmod: 2026-09-28T12:34:56Z', ''].join(
        '\n',
      ),
    );
});
