import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Paint swatches with fields whose editors can’t show every value a file may hold: a color input
 * only takes a 6-digit hex color, a number input with the default `int` type only an integer, and a
 * date input only a date it can parse.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'swatches',
      label: 'Swatches',
      folder: 'content/swatches',
      extension: 'yml',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'color', label: 'Color', widget: 'color', allow_input: true },
        { name: 'shade', label: 'Shade', widget: 'color', readonly: true },
        { name: 'weight', label: 'Weight', widget: 'number' },
        { name: 'code', label: 'Code', widget: 'number', value_type: 'int/string' },
        {
          name: 'mixed',
          label: 'Mixed',
          widget: 'datetime',
          time_format: false,
          required: false,
        },
      ],
    },
  ],
};

const PATH = 'content/swatches/white.yml';

const FILE = [
  'title: White',
  "color: '#fff'",
  'shade: red',
  'weight: 4.5',
  "code: '007'",
  'mixed: sometime in spring',
  '',
].join('\n');

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

test('keeps the stored values the editors can’t show when another field is saved', async ({
  cms,
  page,
}) => {
  await cms.open();
  await cms.seed({ [PATH]: FILE });
  await cms.signIn();
  await page.getByRole('row', { name: /White/ }).click();

  const editor = getEditor(page);

  // The input shows the number, without the leading zeros of the string it’s stored as
  await expect(editor.getByRole('spinbutton', { name: 'Code' })).toHaveValue('7');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Snow');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(FILE.replace('title: White', 'title: Snow'));
});
