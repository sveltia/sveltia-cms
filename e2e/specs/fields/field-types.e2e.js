import { FIELD_TYPES_CONFIG, FIELD_TYPES_FILES } from '../../fixtures/configs/field-types.js';
import { expect, test } from '../../fixtures/test.js';

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: FIELD_TYPES_CONFIG, viewport: { width: 1280, height: 6000 } });

const STAR_PARTY_PATH = 'content/events/star-party.yml';

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FIELD_TYPES_FILES);
  await cms.signIn();
});

test('creates an event with every field type filled in', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('group', { name: /Notes/ })).toBeVisible();
  await editor.getByRole('textbox', { name: 'Title' }).fill('Meteor Night');
  await editor.getByRole('textbox', { name: 'Starts At' }).fill('2026-08-12T22:30');

  // A select field with many options is a dropdown, and a multiple one lists the chosen options
  const countries = editor.getByRole('combobox', { name: 'Countries' });

  await cms.chooseMenuItem(countries, page.getByRole('option', { name: 'Japan' }));
  await cms.chooseMenuItem(countries, page.getByRole('option', { name: 'Canada' }));
  await expect(editor.getByRole('grid', { name: 'Selected Options' }).getByRole('row')).toHaveText([
    /Japan/,
    /Canada/,
  ]);
  await cms.chooseMenuItem(
    editor.getByRole('combobox', { name: 'Country', exact: true }),
    page.getByRole('option', { name: 'Peru' }),
  );

  // A relation field with many options is a dropdown that searches the display and search fields
  await cms.openPopup(editor.getByRole('combobox', { name: 'Venue' }), page.getByRole('listbox'));
  await page.keyboard.type('Hal');
  await expect(page.getByRole('option')).toHaveText([
    'Blue Hall (Toronto)',
    'East Pavilion (Halifax)',
  ]);
  await page.getByRole('option', { name: 'East Pavilion (Halifax)' }).click();

  await editor.getByRole('textbox', { name: 'Color' }).fill('#123abc');
  await editor.getByRole('textbox', { name: 'Embed Code' }).click();
  await page.keyboard.type('<b>Hi</b>');

  const metadata = editor.getByRole('group', { name: /Metadata/ });

  // The empty field offers a blank row to type into
  await metadata.getByRole('textbox', { name: 'Key' }).fill('capacity');
  await metadata.getByRole('textbox', { name: 'Value' }).fill('120');

  await editor
    .getByRole('group', { name: /Flyer/ })
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'flyer.txt', mimeType: 'text/plain', buffer: Buffer.from('Flyer') });

  const speakers = editor.getByRole('group', { name: /Speakers.*Field/ });

  await speakers.getByRole('button', { name: /Add.*Speaker/ }).click();
  await speakers.getByRole('textbox', { name: 'Name' }).fill('Mona Lisa');

  // A list with types asks which type of item to add
  const sections = editor.getByRole('group', { name: /Sections.*Field/ });

  await cms.chooseMenuItem(
    sections.getByRole('button', { name: /Add.*Section/ }),
    page.getByRole('menuitem', { name: 'Quote' }),
  );
  await sections.getByRole('textbox', { name: 'Quote' }).fill('Look up.');
  await sections.getByRole('textbox', { name: 'Author' }).fill('Mona');

  await editor.getByRole('button', { name: 'Save' }).click();

  // The UUID is generated, the hidden field gets its default, and the compute field its value from
  // the other fields, showing the label of the selected option. An optional object left unchecked
  // isn’t written
  await expect
    .poll(async () => (await cms.readRepo())['content/events/meteor-night.yml'])
    .toMatch(
      new RegExp(
        `^${[
          'title: Meteor Night',
          'id: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}',
          'kind: event',
          'starts_at: 2026-08-12T22:30:00',
          'countries:',
          '  - jp',
          '  - ca',
          'country: pe',
          'venue: east-pavilion',
          "color: '#123abc'",
          'snippet: <b>Hi</b>',
          'metadata:',
          "  capacity: '120'",
          'flyer: /uploads/flyer.txt',
          'slug_preview: Meteor Night \\(Peru\\)',
          'speakers:',
          '  - name: Mona Lisa',
          'sections:',
          '  - type: quote',
          '    quote: Look up.',
          '    author: Mona',
          '',
        ].join('\\n')}$`,
      ),
    );
  expect((await cms.readRepoFile('static/uploads/flyer.txt'))?.toString()).toBe('Flyer');
});

test('keeps every other field as it was when one changes', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Star Party/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('group', { name: /Notes/ })).toBeVisible();
  await editor.getByRole('textbox', { name: 'Title' }).fill('Star Party!');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The compute field follows the title, and is added where it is in the config
  await expect
    .poll(async () => (await cms.readRepo())[STAR_PARTY_PATH])
    .toBe(
      FIELD_TYPES_FILES[STAR_PARTY_PATH].replace('title: Star Party', 'title: Star Party!').replace(
        'country: ca\n',
        'country: ca\nslug_preview: Star Party! (Canada)\n',
      ),
    );
});

test('refuses to save a list of objects with more items than its maximum', async ({
  cms,
  page,
}) => {
  // The file was edited outside the CMS
  await cms.seed({
    [STAR_PARTY_PATH]: FIELD_TYPES_FILES[STAR_PARTY_PATH].replace(
      '  - name: Ana Lima\n',
      '  - name: Ana Lima\n  - name: Extra Person\n',
    ),
  });
  // The test backend signs in again on its own
  await page.reload();
  await page.getByRole('row', { name: /Star Party/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const speakers = editor.getByRole('group', { name: /Speakers.*Field/ });

  await expect(editor.getByRole('group', { name: /Notes/ })).toBeVisible();
  // There’s no room for another item
  await expect(speakers.getByRole('button', { name: /Add.*Speaker/ })).toBeHidden();
  await editor.getByRole('textbox', { name: 'Title' }).fill('Star Party!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(speakers.getByRole('alert')).toContainText('You cannot add more than 3 items.');
  expect((await cms.readRepo())[STAR_PARTY_PATH]).toContain('title: Star Party\n');

  await speakers.getByRole('button', { name: 'Remove' }).last().click();
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())[STAR_PARTY_PATH])
    .toContain('title: Star Party!\n');
});

/**
 * Get the Star Party event file with the given metadata pairs. The file includes the value of the
 * compute field, which the CMS otherwise adds on opening the entry, so opening it changes nothing.
 * @param {string} pairs Metadata pairs in YAML.
 * @returns {string} File content.
 */
const getStarPartyWithMetadata = (pairs) =>
  FIELD_TYPES_FILES[STAR_PARTY_PATH].replace(
    'country: ca\n',
    `country: ca\nmetadata:\n${pairs}slug_preview: Star Party (Canada)\n`,
  );

test('reorders key-value pairs, saving them in the new order', async ({ cms, page }) => {
  // The file was edited outside the CMS
  await cms.seed({
    [STAR_PARTY_PATH]: getStarPartyWithMetadata(
      "  capacity: '120'\n  dress_code: casual\n  parking: free\n",
    ),
  });
  // The test backend signs in again on its own
  await page.reload();
  await page.getByRole('row', { name: /Star Party/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const metadata = editor.getByRole('group', { name: /Metadata/ });
  const saveButton = editor.getByRole('button', { name: 'Save' });

  await expect(editor.getByRole('group', { name: /Notes/ })).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await metadata.getByRole('button', { name: 'Reorder Item' }).first().focus();
  await page.keyboard.press('End');
  await expect
    .poll(() =>
      metadata
        .getByRole('textbox', { name: 'Key' })
        .evaluateAll((inputs) => inputs.map((input) => /** @type {any} */ (input).value)),
    )
    .toEqual(['dress_code', 'parking', 'capacity']);
  // Only the order has changed, which is a change of its own
  await expect(saveButton).toBeEnabled();

  // Moving the pair back undoes the change
  await metadata.getByRole('button', { name: 'Reorder Item' }).last().focus();
  await page.keyboard.press('Home');
  await expect(saveButton).toBeDisabled();

  await metadata.getByRole('button', { name: 'Reorder Item' }).nth(1).focus();
  await page.keyboard.press('ArrowDown');
  await saveButton.click();

  await expect
    .poll(async () => (await cms.readRepo())[STAR_PARTY_PATH])
    .toBe(getStarPartyWithMetadata("  capacity: '120'\n  parking: free\n  dress_code: casual\n"));
});
