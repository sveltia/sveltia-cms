import { FIELD_TYPES_CONFIG, FIELD_TYPES_FILES } from '../../fixtures/configs/field-types.js';
import { expect, test } from '../../fixtures/test.js';

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: FIELD_TYPES_CONFIG, viewport: { width: 1280, height: 6000 } });

const STAR_PARTY_PATH = 'content/events/star-party.yml';
const STAR_PARTY = FIELD_TYPES_FILES[STAR_PARTY_PATH];

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(FIELD_TYPES_FILES);
  await cms.signIn();
  await page.getByRole('row', { name: /Star Party/ }).click();
  await expect(
    page.getByRole('group', { name: 'Content Editor' }).getByRole('group', { name: /Notes/ }),
  ).toBeVisible();
});

/**
 * Get the saved file of the Star Party event, minus the compute field the CMS adds on saving.
 * @param {import('../../fixtures/test.js').CMS} cms CMS.
 * @returns {Promise<string | undefined>} File content.
 */
const readStarParty = async (cms) =>
  (await cms.readRepo())[STAR_PARTY_PATH]?.replace(/^slug_preview: .+\n/m, '');

test('reorders list items with the keyboard', async ({ cms, page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const speakers = editor.getByRole('group', { name: /Speakers.*Field/ });

  await speakers.getByRole('button', { name: 'Reorder Item' }).first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(speakers.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('John Smith');
  // The handle keeps the focus, so the item can be moved on
  await expect(speakers.getByRole('button', { name: 'Reorder Item' }).nth(1)).toBeFocused();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => readStarParty(cms))
    .toBe(
      STAR_PARTY.replace(
        '  - name: Jane Doe\n    role: Host\n  - name: John Smith\n    role: Astronomer\n',
        '  - name: John Smith\n    role: Astronomer\n  - name: Jane Doe\n    role: Host\n',
      ),
    );
});

test('removes a list item', async ({ cms, page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const speakers = editor.getByRole('group', { name: /Speakers.*Field/ });

  await speakers.getByRole('button', { name: 'Remove' }).nth(1).click();
  await expect(speakers.getByRole('group', { name: '2 Speakers' })).toBeVisible();
  // There’s room for another item again
  await expect(speakers.getByRole('button', { name: /Add.*Speaker/ })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => readStarParty(cms))
    .toBe(STAR_PARTY.replace('  - name: John Smith\n    role: Astronomer\n', ''));
});

test('clears a list from the field options', async ({ cms, page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const sections = editor.getByRole('group', { name: /Sections.*Field/ });

  await cms.chooseMenuItem(
    sections.getByRole('button', { name: 'Show Field Options' }).first(),
    page.getByRole('menuitem', { name: 'Clear' }),
  );
  await expect(sections.getByText('0 Sections')).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  // The optional field is left out once empty
  await expect
    .poll(() => readStarParty(cms))
    .toBe(
      STAR_PARTY.replace(
        'sections:\n  - type: text\n    body: Bring warm clothes.\n' +
          '  - type: quote\n    quote: The sky is the limit.\n    author: Someone\n',
        '',
      ),
    );
});

test('shows the summary of collapsed items', async ({ page }) => {
  const speakers = page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('group', { name: /Speakers.*Field/ });

  await speakers.getByRole('button', { name: 'Collapse All' }).click();
  await expect(speakers.getByRole('textbox')).toHaveCount(0);
  await expect(speakers.getByText('Jane Doe (Host)')).toBeVisible();
  await expect(speakers.getByText('John Smith (Astronomer)')).toBeVisible();

  await speakers.getByRole('button', { name: 'Expand All' }).click();
  await expect(speakers.getByRole('textbox', { name: 'Name' })).toHaveCount(3);
});

test('expands a collapsed item of a list with types from the preview', async ({ page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const sections = editor.getByRole('group', { name: /Sections.*Field/ });

  await sections.getByRole('button', { name: 'Collapse All' }).click();
  await expect(sections.getByRole('textbox')).toHaveCount(0);

  await editor.getByRole('document', { name: 'Content Preview' }).getByText('Someone').click();
  await expect(sections.getByRole('textbox', { name: 'Author' })).toBeFocused();
});

test('expands a collapsed item of a list with types to show an error on saving', async ({
  cms,
  page,
}) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const sections = editor.getByRole('group', { name: /Sections.*Field/ });

  await sections.getByRole('textbox', { name: 'Author' }).clear();
  await sections.getByRole('button', { name: 'Collapse All' }).click();
  await expect(sections.getByRole('textbox')).toHaveCount(0);

  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /One field has an error/ })).toBeVisible();
  await expect(sections.getByRole('textbox', { name: 'Author' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(await readStarParty(cms)).toBe(STAR_PARTY);
});

test('duplicates an item and adds one below another', async ({ cms, page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const sections = editor.getByRole('group', { name: /Sections.*Field/ });
  const options = sections.getByRole('button', { name: 'List Item Options' });

  await cms.chooseMenuItem(options.first(), page.getByRole('menuitem', { name: 'Duplicate' }));
  await expect(sections.getByRole('textbox', { name: 'Body' })).toHaveCount(2);
  await sections.getByRole('textbox', { name: 'Body' }).nth(1).fill('Bring snacks too.');

  // In a list with types, “Add Item Below” opens a submenu of the types
  const addBelow = page.getByRole('menuitem', { name: 'Add Item Below' });

  await cms.openPopup(options.last(), addBelow);
  await cms.chooseMenuItem(addBelow, page.getByRole('menuitem', { name: 'Text' }));
  await sections.getByRole('textbox', { name: 'Body' }).last().fill('See you there.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => readStarParty(cms))
    .toBe(
      STAR_PARTY.replace(
        '  - type: text\n    body: Bring warm clothes.\n',
        '  - type: text\n    body: Bring warm clothes.\n  - type: text\n    body: Bring snacks too.\n',
      ).replace(
        '    author: Someone\n',
        '    author: Someone\n  - type: text\n    body: See you there.\n',
      ),
    );
});

test('removes an optional object when it’s unchecked', async ({ cms, page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const organizer = editor.getByRole('group', { name: /Organizer.*Field/ });

  // Collapsed by default, with its summary
  await expect(organizer.getByText('Night Sky Club <club@example.com>')).toBeVisible();
  await expect(organizer.getByRole('textbox')).toHaveCount(0);
  await organizer.getByRole('checkbox', { name: /Add.*Organizer/ }).click();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => readStarParty(cms))
    .toBe(
      STAR_PARTY.replace('organizer:\n  name: Night Sky Club\n  email: club@example.com\n', ''),
    );
});
