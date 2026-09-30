import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Collection with an image field, previewed with a custom template.
 */
const COLLECTION = {
  ...BASE_CONFIG.collections[0],
  fields: [
    { name: 'title', label: 'Title' },
    { name: 'image', label: 'Image', widget: 'image', required: false },
  ],
};

/**
 * Script registering a preview template that shows the image with the URL `getAsset()` gives, the
 * way an admin page would after the CMS `<script>`.
 */
const REGISTRATION_SCRIPT = `
  const PostPreview = createClass({
    render: function () {
      const { entry, getAsset } = this.props;
      const image = entry.getIn(['data', 'image']);
      const asset = image ? getAsset(image) : undefined;

      return h('div', {},
        h('h1', {}, entry.getIn(['data', 'title'])),
        asset && h('img', { src: asset.url, alt: 'Featured' }),
      );
    },
  });

  CMS.registerPreviewTemplate('posts', PostPreview);
`;

/**
 * Serve the admin page with a registration script.
 * @param {Page} page Page.
 * @param {string} [script] Script registering the template.
 */
const registerTemplate = async (page, script = REGISTRATION_SCRIPT) => {
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();

    await route.fulfill({
      response,
      body: html.replace('</body>', `<script>${script}</script></body>`),
    });
  });
};

test.describe('saved image', () => {
  test.use({ config: { ...BASE_CONFIG, collections: [COLLECTION] } });

  test('renders the template again once the image asset has a blob URL', async ({ cms, page }) => {
    await registerTemplate(page);
    await cms.open();
    await cms.seed({
      'static/images/cat.png': createPNG(),
      'content/posts/hello.md': '---\ntitle: Hello\nimage: /images/cat.png\n---\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Hello/ }).click();

    const preview = page.frameLocator('iframe').first();

    await expect(preview.locator('h1')).toHaveText('Hello');
    // The public path given at first doesn’t point to the file on the CMS site; the template is
    // rendered again with the blob URL once the file has been retrieved
    await expect(preview.getByRole('img', { name: 'Featured' })).toHaveAttribute('src', /^blob:/);
  });
});

test.describe('unsaved image', () => {
  test.use({ config: { ...GITHUB_CONFIG, collections: [COLLECTION] } });

  test('gives the asset of an image that hasn’t been saved yet', async ({ cms, github, page }) => {
    void github;
    await registerTemplate(page);
    await cms.open();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
    // The field refers to the file with its temporary blob URL until the entry is saved
    await editor
      .getByRole('group', { name: '“\u2068Image\u2069” Field' })
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: createPNG() });

    await expect(
      page.frameLocator('iframe').first().getByRole('img', { name: 'Featured' }),
    ).toHaveAttribute('src', /^blob:/);
  });
});

test.describe('click-to-highlight', () => {
  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [
        {
          ...BASE_CONFIG.collections[0],
          fields: [
            { name: 'title', label: 'Title' },
            {
              name: 'items',
              label: 'Items',
              widget: 'list',
              collapsed: true,
              fields: [{ name: 'name', label: 'Name' }],
            },
          ],
        },
      ],
    },
  });

  test('highlights the field of an element marked with its key path', async ({ cms, page }) => {
    await registerTemplate(
      page,
      `
        const PostPreview = createClass({
          render: function () {
            const { entry } = this.props;
            const items = entry.getIn(['data', 'items']).toJS();

            return h('article', {},
              h('h1', { 'data-key-path': 'title', tabIndex: 0 }, entry.getIn(['data', 'title'])),
              h('ul', {}, items.map((item, index) =>
                h('li', { key: index, 'data-key-path': 'items.' + index + '.name' },
                  h('span', {}, item.name),
                ),
              )),
            );
          },
        });

        CMS.registerPreviewTemplate('posts', PostPreview);
      `,
    );
    await cms.open();
    await cms.seed({
      'content/posts/hello.md':
        '---\ntitle: Hello\nitems:\n  - name: First\n  - name: Second\n---\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Hello/ }).click();

    const preview = page.frameLocator('iframe').first();
    const editor = page.getByRole('group', { name: 'Content Editor' });

    // The collapsed item is expanded to reveal the field
    await preview.getByText('Second').click();
    await expect(editor.locator('input:focus')).toHaveValue('Second');

    await preview.getByRole('heading', { name: 'Hello' }).focus();
    await page.keyboard.press('Enter');
    await expect(editor.locator('input:focus')).toHaveValue('Hello');
  });
});
