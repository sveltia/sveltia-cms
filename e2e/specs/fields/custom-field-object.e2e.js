import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

test.use({
  config: {
    ...BASE_CONFIG,
    collections: [
      {
        ...BASE_CONFIG.collections[0],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'photo', label: 'Photo', widget: 'photo' },
          { name: 'caption', label: 'Caption', required: false },
        ],
      },
    ],
  },
});

/**
 * Script registering a custom field type storing an object value: an image picked with `pickFile`,
 * its alt text and its size. The control shows the image with the URL `getAsset()` gives.
 */
const REGISTRATION_SCRIPT = `
  const PhotoControl = createClass({
    handlePick: async function () {
      const picked = await this.props.pickFile({ kind: 'image' });

      if (picked) {
        this.props.onChange({ src: picked.value, alt: 'A photo', width: 32 });
      }
    },

    render: function () {
      const value = this.props.value || {};
      const asset = value.src ? this.props.getAsset(value.src) : undefined;

      return h('div', {},
        h('button', { type: 'button', onClick: this.handlePick }, 'Choose Photo'),
        asset && h('img', { src: asset.url, alt: 'Chosen photo' }),
      );
    },
  });

  CMS.registerFieldType('photo', PhotoControl);
`;

test.beforeEach(async ({ cms, page }) => {
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();

    await route.fulfill({
      response,
      body: html.replace('</body>', `<script>${REGISTRATION_SCRIPT}</script></body>`),
    });
  });

  await cms.open();
  await cms.seed({ 'static/images/lake.png': createPNG() });
  await cms.signIn();
});

test('saves an object value in place, in the order the control gave the properties', async ({
  cms,
  page,
}) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Lake');
  await editor.getByRole('textbox', { name: 'Caption' }).fill('Text');
  await editor.getByRole('button', { name: 'Choose Photo' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });

  await dialog.getByRole('option', { name: 'lake.png' }).click();
  await dialog.getByRole('button', { name: 'Insert' }).click();
  // The control can display the stored path with `getAsset()`
  await expect(editor.getByRole('img', { name: 'Chosen photo' })).toHaveAttribute('src', /^blob:/);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/lake.md'])
    .toBe(
      '---\ntitle: Lake\nphoto:\n  src: /images/lake.png\n  alt: A photo\n  width: 32\n' +
        'caption: Text\n---\n',
    );
});
