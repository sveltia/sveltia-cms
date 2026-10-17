import { expect, test } from '../../fixtures/test.js';
import { getEditor, openEntry } from '../../fixtures/ui.js';

/** A gallery with a long simple List field, whose order carries meaning. */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'galleries',
      label: 'Galleries',
      folder: 'content/galleries',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'photos', label: 'Photos', widget: 'list', required: false },
      ],
    },
  ],
};

const NAMES = Array.from({ length: 30 }, (_, i) => `photo-${i + 1}`);

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'content/galleries/trip.yml': `title: Trip\nphotos:\n${NAMES.map((n) => `  - ${n}\n`).join('')}`,
  });
  await cms.signIn();
});

test('moves a list item to a typed position', async ({ cms, page }) => {
  await openEntry(page, 'Trip', { collection: 'Galleries' });

  const editor = getEditor(page);
  const options = editor.getByRole('button', { name: 'Reorder Options' });

  await options.nth(26).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();

  const position = page.getByRole('spinbutton', { name: 'Position' });
  const ok = page.getByRole('button', { name: 'OK', exact: true });

  await expect(position).toHaveValue('27');
  // A position outside the list is refused
  await position.fill('31');
  await expect(ok).toBeDisabled();
  await position.fill('4');
  await ok.click();

  await expect(editor.getByRole('textbox', { name: 'Item Value' }).nth(3)).toHaveValue('photo-27');
  await editor.getByRole('button', { name: 'Save' }).click();

  const expected = [...NAMES];

  expected.splice(3, 0, ...expected.splice(26, 1));

  await expect
    .poll(async () => (await cms.readRepo())['content/galleries/trip.yml'])
    .toBe(`title: Trip\nphotos:\n${expected.map((n) => `  - ${n}\n`).join('')}`);
});

test('moves a list item to the top and the bottom', async ({ page }) => {
  await openEntry(page, 'Trip', { collection: 'Galleries' });

  const editor = getEditor(page);
  const options = editor.getByRole('button', { name: 'Reorder Options' });
  const values = editor.getByRole('textbox', { name: 'Item Value' });

  await options.nth(9).click();
  await page.getByRole('menuitem', { name: 'Move to Top' }).click();
  await expect(values.first()).toHaveValue('photo-10');
  // The menu button keeps the focus, so the item can be moved again
  await expect(options.first()).toBeFocused();
  await options.first().click();
  await page.getByRole('menuitem', { name: 'Move to Bottom' }).click();
  await expect(values.last()).toHaveValue('photo-10');
  await expect(values.first()).toHaveValue('photo-1');
});
