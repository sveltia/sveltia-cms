import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, openEntry } from '../../fixtures/ui.js';

/**
 * A blog whose posts are page bundles keeping their images beside them, and pages using the global
 * media folder. Both have a List field of hero blocks, which the pages’ one has a subtitle for.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      path: '{{slug}}/index',
      media_folder: '',
      public_folder: '',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'blocks',
          label: 'Blocks',
          widget: 'list',
          types: [
            {
              name: 'hero',
              label: 'Hero',
              fields: [
                { name: 'heading', label: 'Heading' },
                { name: 'image', label: 'Image', widget: 'image' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'pages',
      label: 'Pages',
      folder: 'content/pages',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'sections',
          label: 'Sections',
          widget: 'list',
          required: false,
          types: [
            {
              name: 'hero',
              label: 'Hero',
              fields: [
                { name: 'heading', label: 'Heading' },
                { name: 'image', label: 'Image', widget: 'image' },
                { name: 'subtitle', label: 'Subtitle', required: false },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const IMAGE = createPNG();

test.use({ config: CONFIG, permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'content/posts/hello/index.md':
      '---\ntitle: Hello\nblocks:\n  - type: hero\n    heading: Hi there\n    image: photo.png\n---\n',
    'content/posts/hello/photo.png': IMAGE,
    'content/pages/about.md':
      '---\ntitle: About\nsections:\n  - type: hero\n    heading: Old\n---\n',
  });
  await cms.signIn();
});

test('pastes an item into another collection along with its image', async ({ cms, page }) => {
  await openEntry(page, 'Hello', { collection: 'Posts' });

  const editor = getEditor(page);

  await editor.getByRole('button', { name: 'List Item Options' }).click();
  await page.getByRole('menuitem', { name: 'Copy' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Item copied.' })).toBeVisible();
  // The item goes to the system clipboard, so it can be pasted in another tab as well
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toMatchObject({
    format: 'sveltia-cms/list-item',
    type: 'hero',
    values: { _default: { heading: 'Hi there', image: 'photo.png' } },
    assets: { _default: { 'photo.png': 'content/posts/hello/photo.png' } },
  });

  await page.getByRole('button', { name: 'Cancel Editing' }).click();
  await openEntry(page, 'About', { collection: 'Pages' });
  await editor.getByRole('button', { name: 'Paste Item' }).click();
  await expect(editor.getByRole('textbox', { name: 'Heading' }).nth(1)).toHaveValue('Hi there');

  // Replace the old item with the copied one as well
  await editor.getByRole('button', { name: 'List Item Options' }).first().click();
  await page.getByRole('menuitem', { name: 'Paste to Replace' }).click();
  await expect(editor.getByRole('textbox', { name: 'Heading' }).first()).toHaveValue('Hi there');

  await editor.getByRole('button', { name: 'Save' }).click();

  // The image beside the post is copied to the global media folder, where the page can refer to it
  await expect
    .poll(async () => (await cms.readRepo())['content/pages/about.md'])
    .toBe(
      '---\ntitle: About\nsections:\n' +
        "  - type: hero\n    heading: Hi there\n    image: /images/photo.png\n    subtitle: ''\n" +
        "  - type: hero\n    heading: Hi there\n    image: /images/photo.png\n    subtitle: ''\n" +
        '---\n',
    );
  expect(await cms.readRepoFile('static/images/photo.png')).toEqual(IMAGE);
  // The post is left alone
  expect(await cms.readRepoFile('content/posts/hello/photo.png')).toEqual(IMAGE);
});
