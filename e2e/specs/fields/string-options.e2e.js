import { expect, test } from '../../fixtures/test.js';

/**
 * Concert venues with a string field for each option that shapes the input or checks the value:
 * the `email` and `url` types, a `prefix` and a `suffix`, which are saved with the value, the
 * `before_input` and `after_input` labels, which aren’t, and `minlength` and `maxlength` with the
 * character counter, on a string field and a multiline text field.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'venues',
      label: 'Venues',
      label_singular: 'Venue',
      folder: 'content/venues',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'website', label: 'Website', type: 'url', required: false },
        {
          name: 'contact',
          label: 'Contact',
          type: 'email',
          prefix: 'mailto:',
          required: false,
        },
        { name: 'price', label: 'Price', prefix: '$', suffix: ' CAD', required: false },
        {
          name: 'page',
          label: 'Page',
          before_input: 'example.com/',
          after_input: '**.html**',
          required: false,
        },
        { name: 'tagline', label: 'Tagline', minlength: 10, maxlength: 20, required: false },
        { name: 'room', label: 'Room', prefix: 'Room ', maxlength: 3, required: false },
        {
          name: 'directions',
          label: 'Directions',
          widget: 'text',
          minlength: 10,
          maxlength: 40,
          required: false,
        },
      ],
    },
  ],
};

const VENUE_PATH = 'content/venues/massey-hall.yml';

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

/**
 * Sign in and start a new venue with its required fields filled in.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 * @returns {Promise<import('@playwright/test').Locator>} Content editor.
 */
const createVenue = async ({ cms, page }) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Massey Hall');
  await editor.getByRole('textbox', { name: 'Email' }).fill('box@example.com');

  return editor;
};

/**
 * Get a field’s group in the editor.
 * @param {import('@playwright/test').Locator} editor Content editor.
 * @param {string} label Field label.
 * @returns {import('@playwright/test').Locator} Field group.
 */
const getField = (editor, label) =>
  editor.getByRole('group', { name: new RegExp(`${label}.*Field`) });

/**
 * Get a pattern matching the text of a character counter, like `10 / 4 / 20` for the minimum, the
 * count and the maximum.
 * @param {...number} numbers Numbers shown, separated by slashes.
 * @returns {RegExp} Pattern.
 */
const counted = (...numbers) => new RegExp(`^\\s*${numbers.join('\\s*/\\s*')}\\s*$`);

/**
 * Click Save, and check that it’s refused with an error and nothing is written.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 * @param {import('@playwright/test').Locator} args.editor Content editor.
 */
const expectSaveRefused = async ({ cms, page, editor }) => {
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /One field has an error/ })).toBeVisible();
  expect((await cms.readRepo())[VENUE_PATH]).toBeUndefined();
};

/**
 * Click Save, and wait for the venue file to be written.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Locator} args.editor Content editor.
 * @returns {Promise<string>} Saved file content.
 */
const save = async ({ cms, editor }) => {
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await cms.readRepo())[VENUE_PATH]).toBeDefined();

  return /** @type {string} */ ((await cms.readRepo())[VENUE_PATH]);
};

test.describe('`type` option', () => {
  test('refuses an email without a domain name and saves a valid one', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Email');
    const input = field.getByRole('textbox', { name: 'Email' });

    // The input mode gives a phone the keyboard for an email address
    await expect(input).toHaveAttribute('inputmode', 'email');

    // The browser accepts `box@example`, but a real address needs a dot in its domain name
    await input.fill('box@example');
    await expectSaveRefused({ cms, page, editor });
    await expect(field.getByRole('alert')).toContainText('Please enter a valid email.');

    await input.fill('box office');
    await expect(field.getByRole('alert')).toContainText('Please enter a valid email.');

    // The error follows the edit, without another save
    await input.fill('box@masseyhall.com');
    await expect(field.getByRole('alert')).toHaveCount(0);

    expect(await save({ cms, editor })).toBe('title: Massey Hall\nemail: box@masseyhall.com\n');
  });

  test('refuses a URL without a scheme and saves a valid one', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Website');
    const input = field.getByRole('textbox', { name: 'Website' });

    await expect(input).toHaveAttribute('inputmode', 'url');
    await input.fill('masseyhall.com');
    await expectSaveRefused({ cms, page, editor });
    await expect(field.getByRole('alert')).toContainText('Please enter a valid URL.');

    await input.fill('https://masseyhall.com/');
    await expect(field.getByRole('alert')).toHaveCount(0);

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\nwebsite: https://masseyhall.com/\n',
    );
  });

  test('checks an optional email or URL only when it’s filled in', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });

    await getField(editor, 'Website').getByRole('textbox').fill('masseyhall.com');
    await getField(editor, 'Website').getByRole('textbox').fill('');

    expect(await save({ cms, editor })).toBe('title: Massey Hall\nemail: box@example.com\n');
  });

  test('checks an email without its prefix, and saves it with the prefix', async ({
    cms,
    page,
  }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Contact');
    const input = field.getByRole('textbox', { name: 'Contact' });

    // `mailto:box@example.com` isn’t an email address, but what the user typed is
    await input.fill('box@example');
    await expectSaveRefused({ cms, page, editor });
    await expect(field.getByRole('alert')).toContainText('Please enter a valid email.');

    await input.fill('tickets@masseyhall.com');
    await expect(field.getByRole('alert')).toHaveCount(0);
    await expect(input).toHaveValue('tickets@masseyhall.com');

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\ncontact: mailto:tickets@masseyhall.com\n',
    );
  });
});

test.describe('`prefix` and `suffix` options', () => {
  test('shows them around the input and saves them with the value', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Price');
    const input = field.getByRole('textbox', { name: 'Price' });

    await expect(field.getByText('$', { exact: true })).toBeVisible();
    await expect(field.getByText('CAD', { exact: true })).toBeVisible();

    await input.fill('45');
    // The input holds only what the user typed, while the preview shows the whole value
    await expect(input).toHaveValue('45');
    await expect(editor.getByRole('document', { name: 'Content Preview' })).toContainText(
      '$45 CAD',
    );

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\nprice: $45 CAD\n',
    );
  });

  test('leaves them out of an empty value', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });
    const input = getField(editor, 'Price').getByRole('textbox', { name: 'Price' });

    await input.fill('45');
    await input.fill('');

    // An empty value isn’t `$ CAD`, so it’s omitted like any other empty optional field
    expect(await save({ cms, editor })).toBe('title: Massey Hall\nemail: box@example.com\n');
  });

  test('strips them from a saved value in the input, and keeps them on another save', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.seed({
      [VENUE_PATH]: 'title: Massey Hall\nemail: box@example.com\nprice: $45 CAD\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Massey Hall/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const input = getField(editor, 'Price').getByRole('textbox', { name: 'Price' });

    await expect(input).toHaveValue('45');
    await input.fill('60');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[VENUE_PATH])
      .toBe('title: Massey Hall\nemail: box@example.com\nprice: $60 CAD\n');
  });
});

test.describe('`before_input` and `after_input` options', () => {
  test('shows the labels as Markdown around the input, without saving them', async ({
    cms,
    page,
  }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Page');
    const input = field.getByRole('textbox', { name: 'Page' });

    await expect(field.getByText('example.com/', { exact: true })).toBeVisible();
    // The Markdown is rendered rather than shown as is
    await expect(field.locator('strong')).toHaveText('.html');
    await expect(field.getByText('**.html**')).toHaveCount(0);

    // The labels sit on either side of the input
    const before = await field.getByText('example.com/', { exact: true }).boundingBox();
    const inputBox = await input.boundingBox();
    const after = await field.locator('strong').boundingBox();

    expect(before && inputBox && before.x + before.width <= inputBox.x).toBe(true);
    expect(inputBox && after && inputBox.x + inputBox.width <= after.x).toBe(true);

    await input.fill('concerts');
    await expect(input).toHaveValue('concerts');

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\npage: concerts\n',
    );
  });
});

test.describe('`minlength` and `maxlength` options', () => {
  test('counts the characters of a string, and refuses one too short or too long', async ({
    cms,
    page,
  }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Tagline');
    const input = field.getByRole('textbox', { name: 'Tagline' });
    const counter = field.getByLabel(/character.* entered/);

    await expect(counter).toHaveAttribute(
      'aria-label',
      /^No character entered\. Minimum: .*10.*\. Maximum: .*20.*\.$/,
    );
    await expect(counter).toHaveText(counted(10, 0, 20));

    await input.fill('Since 1894');
    await expect(counter).toHaveText(counted(10, 10, 20));
    await expect(counter).toHaveAttribute('aria-label', /^.*10.* characters entered\./);

    // Leading and trailing spaces aren’t counted
    await input.fill('  Live  ');
    await expect(counter).toHaveText(counted(10, 4, 20));
    await expectSaveRefused({ cms, page, editor });
    await expect(field.getByRole('alert')).toContainText('You must enter at least 10 characters.');

    // An emoji is one character, although it takes two UTF-16 code units
    await input.fill('Live music since 1894 🎶');
    await expect(counter).toHaveText(counted(10, 23, 20));
    await expect(field.getByRole('alert')).toContainText(
      'You cannot enter more than 20 characters.',
    );

    // Nothing stops the user from typing more than the maximum
    await expect(input).toHaveValue('Live music since 1894 🎶');

    await input.fill('Live music 🎶');
    await expect(counter).toHaveText(counted(10, 12, 20));
    await expect(field.getByRole('alert')).toHaveCount(0);

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\ntagline: Live music 🎶\n',
    );
  });

  test('counts only what the user typed, without the prefix', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Room');
    const input = field.getByRole('textbox', { name: 'Room' });
    const counter = field.getByLabel(/character.* entered/);

    await expect(counter).toHaveText(counted(0, 3));

    // The saved value is `Room 1234`, but the user only typed the number
    await input.fill('1234');
    await expect(counter).toHaveText(counted(4, 3));
    await expectSaveRefused({ cms, page, editor });
    await expect(field.getByRole('alert')).toContainText(
      'You cannot enter more than 3 characters.',
    );

    await input.fill('101');
    await expect(counter).toHaveText(counted(3, 3));
    await expect(field.getByRole('alert')).toHaveCount(0);

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\nroom: Room 101\n',
    );
  });

  test('counts the characters of a multiline text', async ({ cms, page }) => {
    const editor = await createVenue({ cms, page });
    const field = getField(editor, 'Directions');
    const input = field.getByRole('textbox', { name: 'Directions' });
    const counter = field.getByLabel(/character.* entered/);

    await expect(counter).toHaveText(counted(10, 0, 40));

    await input.fill('Subway\n');
    await expect(counter).toHaveText(counted(10, 6, 40));
    await expectSaveRefused({ cms, page, editor });
    await expect(field.getByRole('alert')).toContainText('You must enter at least 10 characters.');

    // A line break between the lines is a character
    await input.fill('Subway to\nQueen Station');
    await expect(counter).toHaveText(counted(10, 23, 40));
    await expect(field.getByRole('alert')).toHaveCount(0);

    expect(await save({ cms, editor })).toBe(
      'title: Massey Hall\nemail: box@example.com\ndirections: |-\n  Subway to\n  Queen Station\n',
    );
  });
});
