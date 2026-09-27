import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // The `{{year}}` and `{{month}}` slug tags come from the time of saving, not the entry date
  await page.clock.install({ time: new Date('2026-05-10T12:00:00Z') });
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
});

test('creates a post with every field type filled in', async ({ cms, page }) => {
  const cover = createPNG({ color: [10, 20, 30] });

  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Comet Watch: Tonight’s Guide');
  await editor.getByRole('textbox', { name: 'Date' }).fill('2026-04-01');
  await editor.getByRole('switch', { name: 'Draft' }).click();
  // A select field with a few options is shown as radio buttons, and so is a relation field
  await editor
    .getByRole('radiogroup', { name: 'Category' })
    .getByRole('radio', { name: 'Review' })
    .click();
  await editor.getByRole('textbox', { name: 'Item Value' }).fill('comets');
  await editor.getByRole('button', { name: /Add.*Tags/ }).click();
  await editor.getByRole('textbox', { name: 'Item Value' }).nth(1).fill('guides');
  await editor
    .getByRole('radiogroup', { name: 'Author' })
    .getByRole('radio', { name: 'John Smith' })
    .click();
  await editor.getByRole('spinbutton', { name: 'Rating' }).fill('5');
  await editor
    .getByRole('group', { name: /Cover Image/ })
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'comet.png', mimeType: 'image/png', buffer: cover });
  await editor.getByRole('textbox', { name: 'Excerpt' }).fill('Where to look.\nWhen to look.');
  // The rich text editor can’t be filled in; type into it like a user
  await editor.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('Look **north** after dusk.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(
      async () => (await cms.readRepo())['content/posts/2026-05-comet-watch-tonight-s-guide.md'],
    )
    .toBe(
      [
        '---',
        "title: 'Comet Watch: Tonight’s Guide'",
        'date: 2026-04-01',
        'draft: true',
        'category: review',
        'tags:',
        '  - comets',
        '  - guides',
        'author: john-smith',
        'rating: 5',
        'cover: /uploads/comet.png',
        'excerpt: |-',
        '  Where to look.',
        '  When to look.',
        '---',
        '',
        'Look **north** after dusk.',
        '',
      ].join('\n'),
    );
  expect(await cms.readRepoFile('static/uploads/comet.png')).toEqual(cover);
  await expect(page.getByRole('row', { name: /Comet Watch/ })).toBeVisible();
});

test('updates one field, and writes the empty optional fields', async ({ cms, page }) => {
  await page.getByRole('row', { name: /First Light/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');
  await editor.getByRole('spinbutton', { name: 'Rating' }).fill('3');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The new value goes where the field is in the config, and the file keeps its name. The optional
  // fields the file didn’t have are written as empty, as `omit_empty_optional_fields` is off
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
    .toBe(
      [
        '---',
        'title: First Light',
        'date: 2026-01-15',
        'draft: false',
        'category: news',
        'tags:',
        '  - astronomy',
        '  - events',
        'author: jane-doe',
        'rating: 3',
        "cover: ''",
        "excerpt: ''",
        '---',
        '',
        'The observatory opens its doors.',
        '',
      ].join('\n'),
    );
});

test.describe('with the empty optional fields omitted', () => {
  test.use({ config: { ...MONOLINGUAL_CONFIG, output: { omit_empty_optional_fields: true } } });

  test('updates one field and leaves the rest of the file as it was', async ({ cms, page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');
    await editor.getByRole('spinbutton', { name: 'Rating' }).fill('3');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toBe(
        MONOLINGUAL_FILES['content/posts/2026-01-first-light.md'].replace(
          'author: jane-doe\n',
          'author: jane-doe\nrating: 3\n',
        ),
      );
  });
});

test('refuses to save a post with invalid fields', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('spinbutton', { name: 'Rating' }).fill('7');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert').filter({ hasText: /6 fields have errors/ })).toBeVisible();
  await expect(editor.getByRole('group', { name: /Title/ }).getByRole('alert')).toContainText(
    'This field is required.',
  );
  await expect(editor.getByRole('group', { name: /Rating/ }).getByRole('alert')).toContainText(
    'The value must be less than or equal to 5.',
  );

  // Correcting the fields makes the post savable
  await editor.getByRole('textbox', { name: 'Title' }).fill('Fixed');
  await editor.getByRole('textbox', { name: 'Date' }).fill('2026-05-01');
  await editor
    .getByRole('radiogroup', { name: 'Category' })
    .getByRole('radio', { name: 'News' })
    .click();
  await editor
    .getByRole('radiogroup', { name: 'Author' })
    .getByRole('radio', { name: 'Jane Doe' })
    .click();
  await editor.getByRole('spinbutton', { name: 'Rating' }).fill('2');
  await editor.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('Now valid.');

  expect(Object.keys(await cms.readRepo())).not.toContain('content/posts/2026-05-fixed.md');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => Object.keys(await cms.readRepo()))
    .toContain('content/posts/2026-05-fixed.md');
});
