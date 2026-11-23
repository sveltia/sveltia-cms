import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField } from '../../fixtures/ui.js';

/**
 * @import { Locator } from '@playwright/test';
 */

/**
 * Flights whose DateTime fields each pick their time zone in another way: the browser’s with
 * `input_timezone: local`, UTC with `input_timezone: utc` or the deprecated `picker_utc`, and an
 * IANA time zone, stored with its offset or, with `output_utc`, in UTC. Two fields store the value
 * in a custom format, one given with `format` and the other with `date_format` and `time_format`.
 * Every field shows the departure at 10:30 in its own time zone.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'flights',
      label: 'Flights',
      label_singular: 'Flight',
      folder: 'content/flights',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        ...[
          { name: 'local', label: 'Local', input_timezone: 'local' },
          { name: 'local_utc', label: 'Local to UTC', output_utc: true },
          { name: 'utc', label: 'UTC', input_timezone: 'utc' },
          { name: 'picker_utc', label: 'Picker UTC', picker_utc: true },
          { name: 'tokyo', label: 'Tokyo', input_timezone: 'Asia/Tokyo' },
          {
            name: 'tokyo_utc',
            label: 'Tokyo to UTC',
            input_timezone: 'Asia/Tokyo',
            output_utc: true,
          },
          {
            name: 'formatted',
            label: 'Formatted',
            format: 'YYYY-MM-DD HH:mm',
            output_utc: true,
          },
          {
            name: 'tokyo_formatted',
            label: 'Tokyo Formatted',
            date_format: 'DD.MM.YYYY',
            time_format: 'HH:mm',
            input_timezone: 'Asia/Tokyo',
          },
        ].map((field) => ({ widget: 'datetime', default: '{{now}}', ...field })),
      ],
    },
  ],
};

const PATH = 'content/flights/nrt.yml';

/**
 * Labels of the DateTime fields, in the order of the config.
 */
const LABELS = [
  'Local',
  'Local to UTC',
  'UTC',
  'Picker UTC',
  'Tokyo',
  'Tokyo to UTC',
  'Formatted',
  'Tokyo Formatted',
];

/**
 * Get the values of the DateTime inputs.
 * @param {Locator} editor Content editor.
 * @returns {Promise<string[]>} Values, in the order of {@link LABELS}.
 */
const getInputValues = (editor) =>
  Promise.all(
    LABELS.map((label) => editor.getByRole('textbox', { name: label, exact: true }).inputValue()),
  );

/**
 * Do something with each DateTime field in turn, as a user would.
 * @param {(label: string) => Promise<void>} action Action, given the field label.
 * @returns {Promise<void>} Once done with every field.
 */
const forEachField = (action) =>
  LABELS.reduce(async (previous, label) => {
    await previous;
    await action(label);
  }, Promise.resolve());

/**
 * Get the content of the flight file with the given values of the DateTime fields.
 * @param {string} title Title.
 * @param {string[]} values Values, in the order of {@link LABELS}.
 * @returns {string} File content.
 */
const getFlight = (title, values) =>
  [
    `title: ${title}`,
    ...CONFIG.collections[0].fields.slice(1).map(({ name }, index) => `${name}: ${values[index]}`),
    '',
  ].join('\n');

// The local time zone is 5 hours behind UTC in January and 4 hours behind in July and September,
// while Tokyo is 9 hours ahead all year
test.use({
  config: CONFIG,
  timezoneId: 'America/New_York',
  viewport: { width: 1280, height: 3000 },
});

test.beforeEach(async ({ cms, page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T12:34:56Z'));
  await cms.open();
  await cms.seed({
    [PATH]: getFlight('NRT', [
      '2026-01-15T10:30:00',
      '2026-01-15T15:30:00Z',
      '2026-01-15T10:30:00Z',
      '2026-01-15T10:30:00Z',
      '2026-01-15T10:30:00+09:00',
      '2026-01-15T01:30:00Z',
      '2026-01-15 15:30',
      '15.01.2026 10:30',
    ]),
    // The same departure, stored at other offsets, and in ISO 8601 rather than the custom format
    'content/flights/kix.yml': getFlight('KIX', [
      '2026-01-15T15:30:00Z',
      '2026-01-15T10:30:00-05:00',
      '2026-01-15T11:30:00+01:00',
      '2026-01-15T19:30:00+09:00',
      '2026-01-15T01:30:00Z',
      '2026-01-15T10:30:00+09:00',
      '2026-01-15T15:30:00Z',
      '2026-01-15T01:30:00Z',
    ]),
    // The fields with a time zone of their own store a value without an offset
    'content/flights/itm.yml': getFlight('ITM', [
      '2026-01-15T10:30:00',
      '2026-01-15T15:30:00Z',
      '2026-01-15T10:30:00',
      '2026-01-15T10:30:00',
      '2026-01-15T10:30:00',
      '2026-01-15T01:30:00Z',
      '2026-01-15 15:30',
      '15.01.2026 10:30',
    ]),
  });
  await cms.signIn();
});

test('shows each stored value in the time zone of its field', async ({ page }) => {
  await page.getByRole('row', { name: /NRT/ }).click();

  const editor = getEditor(page);

  await expect.poll(() => getInputValues(editor)).toEqual(LABELS.map(() => '2026-01-15T10:30'));

  // A field in another time zone than the browser’s names it below the input
  await Promise.all(
    ['Local', 'Local to UTC', 'Formatted'].map((label) =>
      expect(getField(editor, label, { exact: true }).getByText(/^UTC$|^\(.+\) /)).toHaveCount(0),
    ),
  );

  // The label and the time zone
  await expect(
    getField(editor, 'UTC', { exact: true }).getByText('UTC', { exact: true }),
  ).toHaveCount(2);
  await expect(
    getField(editor, 'Picker UTC', { exact: true }).getByText('UTC', { exact: true }),
  ).toBeVisible();

  await Promise.all(
    ['Tokyo', 'Tokyo to UTC', 'Tokyo Formatted'].map((label) =>
      expect(getField(editor, label, { exact: true }).getByText('(+09:00) Tokyo')).toBeVisible(),
    ),
  );

  // Reading the values back changes nothing
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('stores a typed value in the time zone of its field', async ({ cms, page }) => {
  await page.getByRole('row', { name: /NRT/ }).click();

  const editor = getEditor(page);

  await forEachField((label) =>
    editor.getByRole('textbox', { name: label, exact: true }).fill('2026-07-15T14:45'),
  );

  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(
      getFlight('NRT', [
        '2026-07-15T14:45:00',
        '2026-07-15T18:45:00Z',
        '2026-07-15T14:45:00Z',
        '2026-07-15T14:45:00Z',
        '2026-07-15T14:45:00+09:00',
        '2026-07-15T05:45:00Z',
        '2026-07-15 18:45',
        '15.07.2026 14:45',
      ]),
    );
});

test('sets the current time in the time zone of each field with Now', async ({ cms, page }) => {
  await page.getByRole('row', { name: /NRT/ }).click();

  const editor = getEditor(page);

  await forEachField((label) =>
    getField(editor, label, { exact: true }).getByRole('button', { name: 'Now' }).click(),
  );

  await expect(editor.getByRole('textbox', { name: 'Local', exact: true })).toHaveValue(
    '2026-09-28T08:34',
  );
  await expect(editor.getByRole('textbox', { name: 'UTC', exact: true })).toHaveValue(
    '2026-09-28T12:34',
  );
  await expect(editor.getByRole('textbox', { name: 'Tokyo', exact: true })).toHaveValue(
    '2026-09-28T21:34',
  );
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(
      getFlight('NRT', [
        '2026-09-28T08:34:00',
        '2026-09-28T12:34:00Z',
        '2026-09-28T12:34:00Z',
        '2026-09-28T12:34:00Z',
        '2026-09-28T21:34:00+09:00',
        '2026-09-28T12:34:00Z',
        '2026-09-28 12:34',
        '28.09.2026 21:34',
      ]),
    );
});

test('fills in the current time for a new entry in the time zone of each field', async ({
  cms,
  page,
}) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('HND');
  await expect(editor.getByRole('textbox', { name: 'Tokyo', exact: true })).toHaveValue(
    '2026-09-28T21:34',
  );
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/flights/hnd.yml'])
    .toBe(
      getFlight('HND', [
        '2026-09-28T08:34:00',
        '2026-09-28T12:34:00Z',
        '2026-09-28T12:34:00Z',
        '2026-09-28T12:34:00Z',
        '2026-09-28T21:34:00+09:00',
        '2026-09-28T12:34:00Z',
        '2026-09-28 12:34',
        '28.09.2026 21:34',
      ]),
    );
});

test('converts a value stored at another offset, leaving it unmodified', async ({ page }) => {
  await page.getByRole('row', { name: /KIX/ }).click();

  const editor = getEditor(page);

  await expect.poll(() => getInputValues(editor)).toEqual(LABELS.map(() => '2026-01-15T10:30'));

  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('reads a value without an offset in the time zone of its field', async ({ page }) => {
  // A local field reads it in the browser’s time zone, and a field with a time zone of its own in
  // that one, as the fields in a custom format do
  await page.getByRole('row', { name: /ITM/ }).click();

  const editor = getEditor(page);

  await expect.poll(() => getInputValues(editor)).toEqual(LABELS.map(() => '2026-01-15T10:30'));

  // Reading the values back changes nothing
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('stores a typed value without an offset in the form the field writes', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /ITM/ }).click();

  const editor = getEditor(page);

  await forEachField((label) =>
    editor.getByRole('textbox', { name: label, exact: true }).fill('2026-07-15T14:45'),
  );

  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/flights/itm.yml'])
    .toBe(
      getFlight('ITM', [
        '2026-07-15T14:45:00',
        '2026-07-15T18:45:00Z',
        '2026-07-15T14:45:00Z',
        '2026-07-15T14:45:00Z',
        '2026-07-15T14:45:00+09:00',
        '2026-07-15T05:45:00Z',
        '2026-07-15 18:45',
        '15.07.2026 14:45',
      ]),
    );
});
