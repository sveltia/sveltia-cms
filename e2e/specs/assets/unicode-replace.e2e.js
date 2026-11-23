import { createPNG } from '../../fixtures/files.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Blog with an image field, on GitHub, where a path is a string of bytes: a file name spelled in
 * the decomposed Unicode form, as saved on macOS, and the same name in the composed form typed in
 * the browser are two different files.
 */
const CONFIG = {
  ...GITHUB_CONFIG,
  collections: [
    {
      ...GITHUB_CONFIG.collections[0],
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
      ],
    },
  ],
};

const DECOMPOSED = 'cafe\u0301.png';
const COMPOSED = DECOMPOSED.normalize();

test.use({ config: CONFIG });

test('replaces an image whose file name is decomposed in place', async ({ cms, github, page }) => {
  const newImage = createPNG({ color: [0, 0, 255] });

  github.commit({
    'content/posts/kite.md': `---\ntitle: Kite\ncover: /images/${DECOMPOSED}\n---\n`,
    [`static/images/${DECOMPOSED}`]: createPNG({ color: [255, 0, 0] }),
  });
  await cms.open();
  await page.getByRole('row', { name: /Kite/ }).click();

  const editor = getEditor(page);
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

  await cover
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: COMPOSED, mimeType: 'image/png', buffer: newImage });
  await page
    .getByRole('alertdialog', { name: 'File Name Conflict Resolution' })
    .getByRole('button', { name: 'Replace' })
    .click();
  await editor.getByRole('button', { name: 'Save' }).click();

  // The existing file is updated rather than another one added next to it
  await expect.poll(() => github.readFile(`static/images/${DECOMPOSED}`)).toBe(newImage.toString());
  expect(github.readFile(`static/images/${COMPOSED}`)).toBeUndefined();
  expect(github.readFile('content/posts/kite.md')).toBe(
    `---\ntitle: Kite\ncover: /images/${DECOMPOSED}\n---\n`,
  );
});
