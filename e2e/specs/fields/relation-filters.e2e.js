import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField } from '../../fixtures/ui.js';

/**
 * Options shared by the Relation fields referring to a dish. Up to 10 options are shown as radio
 * buttons, which makes the options offered easy to list.
 */
const DISH_RELATION = {
  widget: 'relation',
  collection: 'dishes',
  value_field: '{{slug}}',
  search_fields: ['name'],
  display_fields: ['name'],
  dropdown_threshold: 10,
  required: false,
};

/**
 * A restaurant whose menus pick dishes with Relation fields narrowed down by `filters`: fixed
 * `values`, a `{{fields.fieldName}}` tag following the menu’s cuisine or its lists of diets, and
 * `exclude: true`. A dish also pairs with another dish, excluding itself with a `{{slug}}` tag.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'menus',
      label: 'Menus',
      label_singular: 'Menu',
      folder: 'content/menus',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'cuisine',
          label: 'Cuisine',
          widget: 'select',
          options: [
            { label: 'Japanese', value: 'japanese' },
            { label: 'Indian', value: 'indian' },
          ],
          required: false,
        },
        {
          name: 'diets',
          label: 'Diets',
          widget: 'list',
          field: { name: 'diet', label: 'Diet' },
          required: false,
        },
        {
          name: 'avoid',
          label: 'Avoid',
          widget: 'list',
          field: { name: 'tag', label: 'Avoided Tag' },
          required: false,
        },
        {
          ...DISH_RELATION,
          name: 'dessert',
          label: 'Dessert',
          filters: [{ field: 'course', values: ['dessert'] }],
        },
        {
          ...DISH_RELATION,
          name: 'pick',
          label: 'Chef’s Pick',
          filters: [{ field: 'course', values: ['dessert'], exclude: true }],
        },
        {
          ...DISH_RELATION,
          name: 'main',
          label: 'Main',
          filters: [
            { field: 'course', values: ['main'] },
            { field: 'cuisine', values: ['{{fields.cuisine}}'] },
          ],
        },
        {
          ...DISH_RELATION,
          name: 'side',
          label: 'Side',
          filters: [
            { field: 'tags', values: ['{{fields.diets}}'] },
            { field: 'tags', values: ['{{fields.avoid}}'], exclude: true },
          ],
        },
      ],
    },
    {
      name: 'dishes',
      label: 'Dishes',
      label_singular: 'Dish',
      folder: 'content/dishes',
      extension: 'yml',
      create: true,
      identifier_field: 'name',
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'course', label: 'Course' },
        { name: 'cuisine', label: 'Cuisine' },
        { name: 'tags', label: 'Tags', widget: 'list', required: false },
        {
          ...DISH_RELATION,
          name: 'pairs_with',
          label: 'Pairs With',
          filters: [{ field: 'slug', values: ['{{slug}}'], exclude: true }],
        },
      ],
    },
  ],
};

/**
 * Get the content of a dish file.
 * @param {string} name Name.
 * @param {string} course Course.
 * @param {string} cuisine Cuisine.
 * @param {string[]} tags Tags.
 * @returns {string} File content.
 */
const getDish = (name, course, cuisine, tags) =>
  `name: ${name}\ncourse: ${course}\ncuisine: ${cuisine}\n` +
  `tags:${tags.length ? tags.map((tag) => `\n  - ${tag}`).join('') : ' []'}\n`;

/**
 * Dishes on offer, for each course and cuisine, tagged with the diets they suit.
 */
const DISH_FILES = {
  'content/dishes/miso-soup.yml': getDish('Miso Soup', 'starter', 'japanese', [
    'vegan',
    'gluten-free',
  ]),
  'content/dishes/ramen.yml': getDish('Ramen', 'main', 'japanese', []),
  'content/dishes/vegetable-curry.yml': getDish('Vegetable Curry', 'main', 'indian', ['vegan']),
  'content/dishes/butter-chicken.yml': getDish('Butter Chicken', 'main', 'indian', ['gluten-free']),
  'content/dishes/mochi.yml': getDish('Mochi', 'dessert', 'japanese', ['vegan', 'gluten-free']),
  'content/dishes/kulfi.yml': getDish('Kulfi', 'dessert', 'indian', ['gluten-free']),
};

const MENU_PATH = 'content/menus/tasting.yml';

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

/**
 * Sign in with the dishes, and a menu if given, in the repository.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {string} [args.menu] Content of the menu file.
 */
const signIn = async ({ cms, menu }) => {
  await cms.open();
  await cms.seed({ ...DISH_FILES, ...(menu ? { [MENU_PATH]: menu } : {}) });
  await cms.signIn();
};

/**
 * Get the radio buttons of a field, which a Select or Relation field with a few options shows.
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} label Field label.
 * @returns {import('@playwright/test').Locator} Radio buttons.
 */
const getOptions = (page, label) =>
  getEditor(page).getByRole('radiogroup', { name: label, exact: true }).getByRole('radio');

/**
 * Check the options a field offers, in order. A radio button’s label is its accessible name, not
 * its text content.
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} label Field label.
 * @param {string[]} names Option labels.
 */
const expectOptions = async (page, label, names) => {
  const options = getOptions(page, label);

  await expect(options).toHaveCount(names.length);
  await Promise.all(
    names.map((name, index) => expect(options.nth(index)).toHaveAccessibleName(name)),
  );
};

/**
 * Pick an option of a field.
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} label Field label.
 * @param {string} name Option label.
 */
const pick = async (page, label, name) => {
  await getOptions(page, label)
    .and(page.getByRole('radio', { name, exact: true }))
    .click();
};

test.describe('menus', () => {
  test('offer only the dishes matching fixed values, and save the one picked', async ({
    cms,
    page,
  }) => {
    await signIn({ cms });
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Tasting');

    // The options are sorted by label, after the one clearing the optional field
    await expectOptions(page, 'Dessert', ['(None)', 'Kulfi', 'Mochi']);
    // `exclude` turns the filter around: anything but a dessert
    await expectOptions(page, 'Chef’s Pick', [
      '(None)',
      'Butter Chicken',
      'Miso Soup',
      'Ramen',
      'Vegetable Curry',
    ]);

    await pick(page, 'Dessert', 'Mochi');
    await pick(page, 'Chef’s Pick', 'Ramen');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MENU_PATH])
      .toBe('title: Tasting\ndessert: mochi\npick: ramen\n');
  });

  test('offer the mains of the cuisine picked, following it as it changes', async ({
    cms,
    page,
  }) => {
    await signIn({ cms });
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    // No cuisine is picked yet: the tag is resolved to an empty value, which no dish matches
    await expectOptions(page, 'Main', ['(None)']);

    await pick(page, 'Cuisine', 'Japanese');
    await expectOptions(page, 'Main', ['(None)', 'Ramen']);

    await pick(page, 'Cuisine', 'Indian');
    await expectOptions(page, 'Main', ['(None)', 'Butter Chicken', 'Vegetable Curry']);

    await pick(page, 'Main', 'Butter Chicken');
    await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Tasting');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[MENU_PATH])
      .toBe('title: Tasting\ncuisine: indian\nmain: butter-chicken\n');
  });

  test('offer the sides sharing any of the diets listed, without an avoided tag', async ({
    cms,
    page,
  }) => {
    await signIn({
      cms,
      menu: 'title: Tasting\ndiets:\n  - vegan\n  - gluten-free\navoid: []\n',
    });
    await page.getByRole('row', { name: /Tasting/ }).click();

    // A dish matches when one of its tags is one of the diets
    await expectOptions(page, 'Side', [
      '(None)',
      'Butter Chicken',
      'Kulfi',
      'Miso Soup',
      'Mochi',
      'Vegetable Curry',
    ]);

    const diets = getField(page, 'Diets');

    // The options follow the list as an item is removed or edited
    await diets.getByRole('button', { name: 'Remove' }).last().click();
    await expectOptions(page, 'Side', ['(None)', 'Miso Soup', 'Mochi', 'Vegetable Curry']);

    await diets.getByRole('textbox', { name: 'Diet' }).fill('gluten-free');
    await expectOptions(page, 'Side', ['(None)', 'Butter Chicken', 'Kulfi', 'Miso Soup', 'Mochi']);

    // An avoided tag rules out a dish, even one matching a diet
    const avoid = getField(page, 'Avoid');

    await avoid.getByRole('button', { name: /Add.*Avoid/ }).click();
    await avoid.getByRole('textbox', { name: 'Avoided Tag' }).fill('vegan');
    await expectOptions(page, 'Side', ['(None)', 'Butter Chicken', 'Kulfi']);
  });

  test('offer every side while the lists are empty, and follow a tag to the other list', async ({
    cms,
    page,
  }) => {
    await signIn({ cms, menu: 'title: Tasting\ndiets:\n  - vegan\navoid: []\n' });
    await page.getByRole('row', { name: /Tasting/ }).click();
    await expectOptions(page, 'Side', ['(None)', 'Miso Soup', 'Mochi', 'Vegetable Curry']);

    // An empty list puts no constraint on the options
    await getField(page, 'Diets').getByRole('button', { name: 'Remove' }).click();
    await expect(getOptions(page, 'Side')).toHaveCount(7);

    // The same tag avoided now rules out the dishes it picked before
    const avoid = getField(page, 'Avoid');

    await avoid.getByRole('button', { name: /Add.*Avoid/ }).click();
    await avoid.getByRole('textbox', { name: 'Avoided Tag' }).fill('vegan');
    await expectOptions(page, 'Side', ['(None)', 'Butter Chicken', 'Kulfi', 'Ramen']);
  });
});

test.describe('dishes', () => {
  test('pair with any other dish, but not with themselves', async ({ cms, page }) => {
    await signIn({ cms });
    await page.getByRole('treeitem', { name: 'Dishes' }).click();
    await page.getByRole('row', { name: /Mochi/ }).click();

    await expectOptions(page, 'Pairs With', [
      '(None)',
      'Butter Chicken',
      'Kulfi',
      'Miso Soup',
      'Ramen',
      'Vegetable Curry',
    ]);

    await pick(page, 'Pairs With', 'Miso Soup');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/dishes/mochi.yml'])
      .toBe(`${DISH_FILES['content/dishes/mochi.yml']}pairs_with: miso-soup\n`);
  });

  test('pair a new dish with any dish, as it has no slug yet', async ({ cms, page }) => {
    await signIn({ cms });
    await page.getByRole('treeitem', { name: 'Dishes' }).click();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await getEditor(page).getByRole('textbox', { name: 'Name' }).fill('Mochi');

    // The `{{slug}}` tag is ignored, so even a dish with the slug the new one will get is offered
    await expectOptions(page, 'Pairs With', [
      '(None)',
      'Butter Chicken',
      'Kulfi',
      'Miso Soup',
      'Mochi',
      'Ramen',
      'Vegetable Curry',
    ]);
  });
});
