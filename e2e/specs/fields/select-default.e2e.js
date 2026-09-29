import { expect, test } from '../../fixtures/test.js';

/**
 * Talks whose Select fields have their `default` given as `{ label, value }` option objects, as
 * documented by Decap CMS, alongside a plain value.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'talks',
      label: 'Talks',
      label_singular: 'Talk',
      folder: 'content/talks',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'format',
          label: 'Format',
          widget: 'select',
          options: [
            { label: 'In Person', value: 'in-person' },
            { label: 'Online', value: 'online' },
          ],
          default: { label: 'Online', value: 'online' },
        },
        {
          name: 'languages',
          label: 'Languages',
          widget: 'select',
          multiple: true,
          options: [
            { label: 'English', value: 'en' },
            { label: 'French', value: 'fr' },
            { label: 'Japanese', value: 'ja' },
          ],
          default: [{ label: 'French', value: 'fr' }, 'ja'],
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('selects the default options given as option objects, saving their values', async ({
  cms,
  page,
}) => {
  await cms.open();
  // The config is valid, so the CMS signs in rather than reporting an unknown default
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('radio', { name: 'Online' })).toBeChecked();
  await expect(editor.getByRole('radio', { name: 'In Person' })).not.toBeChecked();
  await expect(editor.getByRole('checkbox', { name: 'French' })).toBeChecked();
  await expect(editor.getByRole('checkbox', { name: 'Japanese' })).toBeChecked();
  await expect(editor.getByRole('checkbox', { name: 'English' })).not.toBeChecked();

  await editor.getByRole('textbox', { name: 'Title' }).fill('Runes');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/talks/runes.yml'])
    .toBe('title: Runes\nformat: online\nlanguages:\n  - fr\n  - ja\n');
});
