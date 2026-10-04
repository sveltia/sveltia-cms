import { expect, test } from '../../fixtures/test.js';

/**
 * Mountain reports with an optional low temperature, which is always below freezing, stored as a
 * string by the `int/string` value type.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'reports',
      label: 'Reports',
      label_singular: 'Report',
      folder: 'content/reports',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'low',
          label: 'Low Temperature',
          widget: 'number',
          value_type: 'int/string',
          min: -90,
          max: -1,
          required: false,
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('saves an entry whose optional number field is left empty', async ({ cms, page }) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Summit');
  // The empty string the field starts with isn’t shown as `NaN`
  await expect(editor.getByRole('spinbutton', { name: 'Low Temperature' })).toHaveValue('');
  await editor.getByRole('button', { name: 'Save' }).click();

  // An empty field is no value at all rather than zero, so it’s not above the maximum
  await expect
    .poll(async () => (await cms.readRepo())['content/reports/summit.yml'])
    .toBe("title: Summit\nlow: ''\n");
});
