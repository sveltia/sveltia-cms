import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField } from '../../fixtures/ui.js';

/**
 * Talks with a `hint` on fields of several types: a string field with every kind of inline Markdown
 * the hint supports and a `\n` line break, a field with HTML the hint doesn’t allow, a list of
 * strings, a list of objects with a hint on its subfield too, an object and a read-only field.
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
        {
          name: 'title',
          label: 'Title',
          // A literal backslash followed by `n`, as a plain YAML string holds it
          hint:
            'Use **bold**, _italic_, ~~struck~~ and `code` words, ' +
            'or [a link](https://example.com/style).\\nKeep it short.',
        },
        {
          name: 'summary',
          label: 'Summary',
          widget: 'text',
          hint: '# Not a heading <img src="/photo.png" alt="Photo"> and <u>no underline</u>',
          required: false,
        },
        {
          name: 'tags',
          label: 'Tags',
          widget: 'list',
          hint: 'One tag per row.',
          required: false,
        },
        {
          name: 'speakers',
          label: 'Speakers',
          widget: 'list',
          hint: 'Add **every** speaker.',
          fields: [{ name: 'name', label: 'Name', hint: 'The _full_ name.' }],
          required: false,
        },
        {
          name: 'venue',
          label: 'Venue',
          widget: 'object',
          hint: 'Where the talk ~~is~~ takes place.',
          fields: [{ name: 'room', label: 'Room', required: false }],
          required: false,
        },
        {
          name: 'track',
          label: 'Track',
          readonly: true,
          default: 'Main',
          hint: 'Set by the organizers.',
        },
      ],
    },
  ],
};

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

/**
 * Get a hint, a paragraph below the input, by its text.
 * @param {import('@playwright/test').Locator} field Field group.
 * @param {string | RegExp} text Text in the hint.
 * @returns {import('@playwright/test').Locator} Hint.
 */
const getHint = (field, text) => field.getByRole('paragraph').filter({ hasText: text });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
});

test('renders the inline Markdown of a hint, and a line break', async ({ page }) => {
  const hint = getHint(getField(page, 'Title'), 'Keep it short.');

  await expect(hint).toContainText('Use bold, italic, struck and code words, or a link.');
  await expect(hint.getByRole('strong')).toHaveText('bold');
  await expect(hint.getByRole('emphasis')).toHaveText('italic');
  await expect(hint.getByRole('deletion')).toHaveText('struck');
  await expect(hint.getByRole('code')).toHaveText('code');
  await expect(hint.getByRole('link', { name: 'a link' })).toHaveAttribute(
    'href',
    'https://example.com/style',
  );
  // The `\n` is a line break, not text
  await expect(hint.locator('br')).toHaveCount(1);
  await expect(hint).not.toContainText('\\n');
});

test('leaves out the block Markdown and the HTML a hint doesn’t allow', async ({ page }) => {
  const field = getField(page, 'Summary');
  const hint = getHint(field, 'no underline');

  // The text is kept, but not the heading, the image or the underline
  await expect(hint).toHaveText('# Not a heading and no underline');
  await expect(field.getByRole('heading')).toHaveCount(0);
  await expect(field.getByRole('img', { name: 'Photo' })).toHaveCount(0);
  await expect(hint.locator('u')).toHaveCount(0);
});

test('shows a hint below a list, an object and a subfield', async ({ page }) => {
  await expect(getHint(getField(page, 'Tags'), 'One tag per row.')).toBeVisible();

  const speakers = getField(page, 'Speakers');
  const speakersHint = getHint(speakers, 'Add every speaker.');

  await expect(speakersHint).toBeVisible();
  await expect(speakersHint.getByRole('strong')).toHaveText('every');

  // The subfield’s hint shows up in each item, inside the list’s
  await expect(getHint(speakers, 'The full name.')).toHaveCount(0);
  await speakers.getByRole('button', { name: /Add.*Speakers/ }).click();
  await speakers.getByRole('button', { name: /Add.*Speakers/ }).click();

  const nameHints = getHint(speakers, 'The full name.');

  await expect(nameHints).toHaveCount(2);
  await expect(nameHints.first().getByRole('emphasis')).toHaveText('full');

  const venueHint = getHint(getField(page, 'Venue'), 'Where the talk is takes place.');

  await expect(venueHint).toBeVisible();
  await expect(venueHint.getByRole('deletion')).toHaveText('is');
});

test('hides the hint of a read-only field', async ({ page }) => {
  const track = getField(page, 'Track');

  await expect(track.getByRole('textbox', { name: 'Track' })).toHaveValue('Main');
  await expect(track.getByText('Set by the organizers.')).toHaveCount(0);
});

test('doesn’t save a hint', async ({ cms, page }) => {
  const editor = getEditor(page);
  const speakers = getField(page, 'Speakers');

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hints');
  await speakers.getByRole('button', { name: /Add.*Speakers/ }).click();
  await speakers.getByRole('textbox', { name: 'Name' }).fill('Ada Lovelace');
  // An optional object is added with a checkbox
  await getField(page, 'Venue')
    .getByRole('checkbox', { name: /Add.*Venue/ })
    .check();
  await getField(page, 'Venue').getByRole('textbox', { name: 'Room' }).fill('A1');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/talks/hints.yml'])
    .toBe('title: Hints\nspeakers:\n  - name: Ada Lovelace\nvenue:\n  room: A1\ntrack: Main\n');
});
