import { expect, test } from '../../fixtures/test.js';

/**
 * Conference talks whose fields each carry a rule that a list or an object can break: an item
 * count, a pattern tested against the items joined with commas, a number of selected options and a
 * required object with types. Once a save attempt has shown an error, it has to follow the edits
 * made in the editor, without another save.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  output: { omit_empty_optional_fields: true },
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
        { name: 'tags', label: 'Tags', label_singular: 'Tag', widget: 'list', min: 2, max: 3 },
        {
          name: 'keywords',
          label: 'Keywords',
          label_singular: 'Keyword',
          widget: 'list',
          required: false,
          pattern: ['^[a-z]+(,[a-z]+)+$', 'Enter two lowercase words or more'],
        },
        {
          name: 'colors',
          label: 'Colors',
          widget: 'select',
          multiple: true,
          max: 1,
          required: false,
          options: [
            { label: 'Red', value: 'red' },
            { label: 'Green', value: 'green' },
            { label: 'Blue', value: 'blue' },
          ],
        },
        {
          name: 'speakers',
          label: 'Speakers',
          label_singular: 'Speaker',
          widget: 'list',
          required: false,
          max: 2,
          fields: [{ name: 'name', label: 'Name' }],
        },
        {
          name: 'venue',
          label: 'Venue',
          widget: 'object',
          types: [
            {
              name: 'online',
              label: 'Online',
              widget: 'object',
              fields: [{ name: 'url', label: 'URL', required: false }],
            },
            {
              name: 'hall',
              label: 'Hall',
              widget: 'object',
              fields: [{ name: 'room', label: 'Room', required: false }],
            },
          ],
        },
      ],
    },
  ],
};

const TALK_PATH = 'content/talks/runes.yml';

/**
 * Get a talk file that’s valid unless the given lines make it invalid: they replace the tags or the
 * venue, or are added between them.
 * @param {object} args Arguments.
 * @param {string} [args.tags] Tags in YAML.
 * @param {string} [args.extra] Other fields in YAML, added after the tags.
 * @param {string} [args.venue] Venue in YAML.
 * @returns {string} File content.
 */
const getTalk = ({
  tags = 'tags:\n  - svelte\n  - runes\n',
  extra = '',
  venue = 'venue:\n  type: hall\n  room: A\n',
} = {}) => `title: Runes\n${tags}${extra}${venue}`;

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

/**
 * Seed the talk, sign in and open it, then change the title and try to save it, so the errors are
 * shown.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 * @param {string} args.file Content of the talk file.
 * @returns {Promise<import('@playwright/test').Locator>} Content editor.
 */
const openAndTrySaving = async ({ cms, page, file }) => {
  await cms.open();
  await cms.seed({ [TALK_PATH]: file });
  await cms.signIn();
  await page.getByRole('row', { name: /Runes/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Runes in Depth');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /One field has an error/ })).toBeVisible();
  expect((await cms.readRepo())[TALK_PATH]).toBe(file);

  return editor;
};

/**
 * Save the talk, and wait for the file to be written with the new title.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Locator} args.editor Content editor.
 * @returns {Promise<string | undefined>} Saved file content.
 */
const save = async ({ cms, editor }) => {
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())[TALK_PATH])
    .toContain('title: Runes in Depth\n');

  return (await cms.readRepo())[TALK_PATH];
};

test('follows the item count of a list without subfields as items are removed and added', async ({
  cms,
  page,
}) => {
  const editor = await openAndTrySaving({
    cms,
    page,
    file: getTalk({ tags: 'tags:\n  - svelte\n  - runes\n  - state\n  - effects\n' }),
  });

  const tags = editor.getByRole('group', { name: /Tags.*Field/ });
  const error = tags.getByRole('alert');

  await expect(error).toContainText('You cannot add more than 3 items.');

  // The editor rewrites the whole list, writing the list itself before its items and deleting the
  // key path of the last item, so the count has to come from the items that are left
  await tags.getByRole('button', { name: 'Remove' }).last().click();
  await expect(error).toHaveCount(0);

  await tags.getByRole('button', { name: 'Remove' }).last().click();
  await tags.getByRole('button', { name: 'Remove' }).last().click();
  await expect(error).toContainText('You must add at least 2 items.');

  // Typing in a new row writes the new item, e.g. `tags.1`, which has no field config of its own
  await tags.getByRole('button', { name: /Add.*Tag/ }).click();
  await tags.getByRole('textbox', { name: 'Item Value' }).last().fill('signals');
  await expect(error).toHaveCount(0);

  expect(await save({ cms, editor })).toBe(
    getTalk({ tags: 'tags:\n  - svelte\n  - signals\n' }).replace('Runes', 'Runes in Depth'),
  );
});

test('tests the pattern of a list without subfields against its items joined with commas', async ({
  cms,
  page,
}) => {
  const editor = await openAndTrySaving({
    cms,
    page,
    file: getTalk({ extra: 'keywords:\n  - svelte\n' }),
  });

  const keywords = editor.getByRole('group', { name: /Keywords.*Field/ });
  const error = keywords.getByRole('alert');

  await expect(error).toContainText('Enter two lowercase words or more');

  // Each item matches `[a-z]+` on its own, but the pattern needs `svelte,runes`
  await keywords.getByRole('button', { name: /Add.*Keyword/ }).click();

  const newItem = keywords.getByRole('textbox', { name: 'Item Value' }).last();

  await newItem.fill('runes');
  await expect(error).toHaveCount(0);
  await newItem.fill('Runes');
  await expect(error).toContainText('Enter two lowercase words or more');
  await newItem.fill('runes');
  await expect(error).toHaveCount(0);

  expect(await save({ cms, editor })).toContain('keywords:\n  - svelte\n  - runes\n');
});

test('follows the number of selected options as one is unchecked', async ({ cms, page }) => {
  const editor = await openAndTrySaving({
    cms,
    page,
    file: getTalk({ extra: 'colors:\n  - red\n  - green\n' }),
  });

  const colors = editor.getByRole('group', { name: /Colors.*Field/ });
  const error = colors.getByRole('alert');

  await expect(error).toContainText('You cannot select more than 1 option.');
  await colors.getByRole('checkbox', { name: 'Green' }).click();
  await expect(error).toHaveCount(0);
  await colors.getByRole('checkbox', { name: 'Blue' }).click();
  await expect(error).toContainText('You cannot select more than 1 option.');
  await colors.getByRole('checkbox', { name: 'Red' }).click();
  await expect(error).toHaveCount(0);

  expect(await save({ cms, editor })).toContain('colors:\n  - blue\n');
});

test('follows the item count of a list of objects as an item is removed', async ({ cms, page }) => {
  const editor = await openAndTrySaving({
    cms,
    page,
    file: getTalk({ extra: 'speakers:\n  - name: Ana\n  - name: Bo\n  - name: Cy\n' }),
  });

  const speakers = editor.getByRole('group', { name: /Speakers.*Field/ });
  // The subfields of each item have their own group and alert
  const error = speakers.getByRole('alert').first();

  await expect(error).toContainText('You cannot add more than 2 items.');
  await speakers.getByRole('button', { name: 'Remove' }).last().click();
  await expect(speakers.getByRole('alert')).toHaveCount(0);

  expect(await save({ cms, editor })).toContain('speakers:\n  - name: Ana\n  - name: Bo\n');
});

test('no longer reports a required object with types missing once one is added', async ({
  cms,
  page,
}) => {
  const editor = await openAndTrySaving({ cms, page, file: getTalk({ venue: '' }) });
  const venue = editor.getByRole('group', { name: /Venue.*Field/ });
  const error = venue.getByRole('alert');

  await expect(error).toContainText('This field is required.');

  // The subfields are written and the object is left with no value of its own
  await cms.chooseMenuItem(
    venue.getByRole('button', { name: /Add.*Venue/ }),
    page.getByRole('menuitem', { name: 'Online' }),
  );
  await expect(venue.getByRole('textbox', { name: 'URL' })).toBeVisible();
  await expect(error).toHaveCount(0);

  // Removed again, so it’s missing again
  await venue.getByRole('button', { name: 'Remove' }).click();
  await expect(error).toContainText('This field is required.');

  await cms.chooseMenuItem(
    venue.getByRole('button', { name: /Add.*Venue/ }),
    page.getByRole('menuitem', { name: 'Hall' }),
  );
  await venue.getByRole('textbox', { name: 'Room' }).fill('B');
  await expect(error).toHaveCount(0);

  expect(await save({ cms, editor })).toContain('venue:\n  type: hall\n  room: B\n');
});
