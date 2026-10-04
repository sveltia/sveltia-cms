import { expect, test } from '../../fixtures/test.js';

/**
 * Events with a date-only DateTime field in a custom format, stored with `output_utc`. A date has
 * no time zone, so it must be stored and shown as picked wherever the editor is.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/events',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'date',
          label: 'Date',
          widget: 'datetime',
          time_format: false,
          format: 'YYYY-MM-DD',
          output_utc: true,
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test.describe('east of UTC', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });

  test('stores the picked date without shifting it to the day before', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Title' }).fill('Launch');
    await editor.getByRole('textbox', { name: 'Date' }).fill('2026-10-03');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/events/launch.yml'])
      .toBe('title: Launch\ndate: 2026-10-03\n');
  });
});

test.describe('west of UTC', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('shows the stored date as is, leaving the entry unmodified', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({ 'content/events/launch.yml': 'title: Launch\ndate: 2026-10-03\n' });
    await cms.signIn();
    await page.getByRole('row', { name: /Launch/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Launch');
    await expect(editor.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-10-03');
    await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
