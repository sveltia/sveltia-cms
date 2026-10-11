import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Build the config of a blog whose Markdown body takes the given `allow_nested_components` option.
 * @param {boolean | 'exclude_self'} [allowNested] Option value, or `undefined` to leave it out.
 * @returns {object} Config.
 */
const getConfig = (allowNested) => ({
  ...BASE_CONFIG,
  collections: [
    {
      ...BASE_CONFIG.collections[0],
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'body',
          label: 'Body',
          widget: 'markdown',
          ...(allowNested === undefined ? {} : { allow_nested_components: allowNested }),
        },
      ],
    },
  ],
});

/**
 * Script registering three components with a Markdown field of their own, which has an editor with
 * an Insert menu, one of them edited in a dialog, and one component without.
 */
const REGISTER_COMPONENTS = `
  [['callout', 'Callout', 'aside'], ['details', 'Details', 'details'], ['note', 'Note', 'section']]
    .forEach(([id, label, tag]) => {
      CMS.registerEditorComponent({
        id,
        label,
        mode: id === 'note' ? 'dialog' : 'block',
        fields: [{ name: 'text', label: label + ' Text', widget: 'markdown' }],
        pattern: new RegExp('^<' + tag + '>\\n([\\\\s\\\\S]*?)\\n</' + tag + '>$'),
        fromBlock: (match) => ({ text: match[1] }),
        toBlock: ({ text }) => '<' + tag + '>\\n' + text + '\\n</' + tag + '>',
      });
    });
  CMS.registerEditorComponent({
    id: 'youtube',
    label: 'YouTube',
    fields: [{ name: 'id', label: 'Video ID' }],
    pattern: /^{{< youtube (\\S+) >}}$/,
    fromBlock: (match) => ({ id: match[1] }),
    toBlock: ({ id }) => '{{< youtube ' + id + ' >}}',
  });
`;

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  // The editor reads the components when it’s opened
  await page.evaluate(REGISTER_COMPONENTS);
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
});

/**
 * Get the body field.
 * @param {Page} page Page.
 * @returns {Locator} Field.
 */
const getBody = (page) =>
  page.getByRole('group', { name: 'Content Editor' }).getByRole('group', { name: /Body.*Field/ });

/**
 * Get the toolbar of a rich text field’s own editor, which comes before those of the components
 * inserted in it.
 * @param {Locator} field Field.
 * @returns {Locator} Toolbar.
 */
const getToolbar = (field) => field.getByRole('toolbar', { name: 'Text Editor' }).first();

/**
 * Insert a component in a rich text field, and get it.
 * @param {Locator} field Field.
 * @param {string} label Component label.
 * @returns {Promise<Locator>} Component.
 */
const insertComponent = async (field, label) => {
  const page = field.page();

  await getToolbar(field).getByRole('button', { name: 'Insert' }).click();
  await page.getByRole('menuitem', { name: label }).click();

  const component = field.getByRole('group', { name: label, exact: true }).first();

  await expect(component).toBeVisible();

  return component;
};

/**
 * Get the Markdown field of a component.
 * @param {Locator} component Component.
 * @returns {Locator} Field.
 */
const getComponentField = (component) =>
  component.getByRole('group', { name: /Text.*Field/ }).first();

/**
 * Check the components the Insert menu of a rich text field offers, then close the menu.
 * @param {Locator} field Field.
 * @param {string[]} labels Component labels.
 */
const expectInsertMenu = async (field, labels) => {
  const page = field.page();
  const menu = page.locator('[role="menu"]:not([inert])');

  await getToolbar(field).getByRole('button', { name: 'Insert' }).click();
  await expect(menu.getByRole('menuitem')).toHaveText(labels);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
};

test.describe('by default', () => {
  test.use({ config: getConfig() });

  test('offers every component in a component, including itself', async ({ page }) => {
    const body = getBody(page);

    await expectInsertMenu(body, ['Callout', 'Details', 'Note', 'YouTube']);

    const callout = getComponentField(await insertComponent(body, 'Callout'));

    await expect(getToolbar(callout).getByRole('button', { name: 'Image' })).toBeVisible();
    await expectInsertMenu(callout, ['Callout', 'Details', 'Note', 'YouTube']);
  });
});

test.describe('with `allow_nested_components: true`', () => {
  test.use({ config: getConfig(true) });

  test('offers every component in a component, including itself', async ({ page }) => {
    const callout = getComponentField(await insertComponent(getBody(page), 'Callout'));

    await expect(getToolbar(callout).getByRole('button', { name: 'Image' })).toBeVisible();
    await expectInsertMenu(callout, ['Callout', 'Details', 'Note', 'YouTube']);
  });
});

test.describe('with `allow_nested_components: false`', () => {
  test.use({ config: getConfig(false) });

  test('offers no component in a component', async ({ page }) => {
    const body = getBody(page);

    // The field itself still offers them all
    await expect(getToolbar(body).getByRole('button', { name: 'Image' })).toBeVisible();
    await expectInsertMenu(body, ['Callout', 'Details', 'Note', 'YouTube']);

    const callout = getComponentField(await insertComponent(body, 'Callout'));
    const toolbar = getToolbar(callout);

    // The formatting buttons are left
    await expect(toolbar.getByRole('button', { name: 'Bold' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Image' })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Insert' })).toHaveCount(0);
  });
});

test.describe('with `allow_nested_components: exclude_self`', () => {
  test.use({ config: getConfig('exclude_self') });

  test('offers the components other than those it’s in', async ({ cms, page }) => {
    const editor = page.getByRole('group', { name: 'Content Editor' });
    const body = getBody(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('Nested');
    await expectInsertMenu(body, ['Callout', 'Details', 'Note', 'YouTube']);

    const callout = getComponentField(await insertComponent(body, 'Callout'));

    // The built-in image component is still offered
    await expect(getToolbar(callout).getByRole('button', { name: 'Image' })).toBeVisible();
    await expectInsertMenu(callout, ['Details', 'Note', 'YouTube']);

    // A component two levels down leaves out both it’s in
    const details = getComponentField(await insertComponent(callout, 'Details'));

    await expectInsertMenu(details, ['Note', 'YouTube']);

    // What’s nested is saved inside its parent
    await details.getByRole('textbox', { name: 'Details Text' }).click();
    await page.keyboard.type('Hidden.');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/nested.md'])
      .toBe('---\ntitle: Nested\n---\n\n<aside>\n<details>\nHidden.\n</details>\n</aside>\n');
  });
});

test.describe('with a component in the dialog of another', () => {
  test.use({ config: getConfig() });

  // A component in block mode inserted in the rich text field of a component in dialog mode never
  // finds the locale and key path it belongs to, as it looks them up from the elements around it,
  // and the dialog is rendered outside the entry editor. So it shows no fields, and the Save writes
  // its block with `undefined` for its value, or drops it. Once fixed, the Callout shows its
  // “Callout Text” field, and `exclude_self` leaves both components out of its Insert menu.
  test('shows no fields for a component in a dialog (known issue)', async ({ page }) => {
    await getToolbar(getBody(page)).getByRole('button', { name: 'Insert' }).click();
    await page.getByRole('menuitem', { name: 'Note' }).click();

    const note = page
      .getByRole('dialog', { name: 'Note' })
      .getByRole('group', { name: /Note Text.*Field/ });

    const callout = await insertComponent(note, 'Callout');

    // The component looks for them in the next frame, and renders its fields in the one after
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );
    await expect(callout.getByRole('group', { name: /Callout Text.*Field/ })).toHaveCount(0);
  });
});

test.describe('with `allow_nested_components: false` in `field_defaults.richtext`', () => {
  test.use({
    config: { ...getConfig(), field_defaults: { richtext: { allow_nested_components: false } } },
  });

  test('offers no component in a component', async ({ page }) => {
    const callout = getComponentField(await insertComponent(getBody(page), 'Callout'));

    await expect(getToolbar(callout).getByRole('button', { name: 'Insert' })).toHaveCount(0);
  });
});
