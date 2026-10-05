import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../fixtures/configs/workflow.js';
import { BASE_CONFIG, expect, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * The blog with a Markdown body, which offers the editor components.
 */
const CONFIG = {
  ...BASE_CONFIG,
  collections: [
    {
      ...BASE_CONFIG.collections[0],
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'markdown' },
      ],
    },
  ],
};

/**
 * Add scripts to the admin page, the way a site extends the CMS: after the CMS `<script>`, and
 * optionally before it. A single route has to add both, as a later route would fetch the original
 * page again.
 * @param {Page} page Page.
 * @param {object} scripts Scripts.
 * @param {string} [scripts.before] Script to run before the CMS is loaded.
 * @param {string} [scripts.after] Script to run after the CMS is loaded.
 */
const addScripts = async (page, { before, after }) => {
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();
    let html = await response.text();

    if (before) {
      html = html.replace('<script src=', `<script>${before}</script><script src=`);
    }

    if (after) {
      html = html.replace('</body>', `<script>${after}</script></body>`);
    }

    await route.fulfill({ response, body: html });
  });
};

/**
 * Start a new post and fill in its title.
 * @param {Page} page Page.
 * @param {string} title Title.
 * @returns {Promise<Locator>} Content editor.
 */
const createPost = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);

  return editor;
};

test.describe('CMS.init()', () => {
  // The admin page of the dev server starts the CMS on its own
  test.skip(process.env.E2E_TARGET === 'dev', 'The dev server’s admin page can’t be changed');

  test.use({ config: CONFIG });

  test('merges the config it’s given with the config file', async ({ cms, page }) => {
    // The site starts the CMS itself, adding a collection to those of `config.yml`
    await addScripts(page, {
      before: 'window.CMS_MANUAL_INIT = true;',
      after: `CMS.init({ config: { collections: [${JSON.stringify({
        name: 'notes',
        label: 'Notes',
        folder: 'content/notes',
        create: true,
        fields: [{ name: 'title', label: 'Title' }],
      })}] } });`,
    });
    await cms.open();
    await cms.signIn();

    await expect(
      page.getByRole('tree', { name: 'Collection List' }).getByRole('treeitem'),
    ).toHaveText([/Posts/, /Notes/]);
  });

  test('doesn’t load the config file with `load_config_file: false`', async ({ cms, page }) => {
    /** @type {string[]} */
    const configRequests = [];

    page.on('request', (request) => {
      if (request.url().includes('config.yml')) {
        configRequests.push(request.url());
      }
    });

    await addScripts(page, {
      before: 'window.CMS_MANUAL_INIT = true;',
      after: `CMS.init({ config: ${JSON.stringify({
        load_config_file: false,
        backend: { name: 'test-repo' },
        media_folder: 'static/images',
        collections: [
          {
            name: 'notes',
            label: 'Notes',
            folder: 'content/notes',
            create: true,
            fields: [{ name: 'title', label: 'Title' }],
          },
        ],
      })} });`,
    });
    await cms.open();
    await cms.signIn();

    await expect(
      page.getByRole('tree', { name: 'Collection List' }).getByRole('treeitem'),
    ).toHaveText([/Notes/]);
    expect(configRequests).toEqual([]);
  });
});

test.describe('CMS.registerEditorComponent()', () => {
  test.use({ config: CONFIG });

  test.beforeEach(async ({ cms, page }) => {
    // A Hugo shortcode for a YouTube video, and a callout whose Markdown body is rendered in the
    // preview with `CMS.renderRichText()`
    await addScripts(page, {
      after: `
        CMS.registerEditorComponent({
          id: 'youtube',
          label: 'YouTube',
          fields: [{ name: 'id', label: 'Video ID' }],
          pattern: /^{{< youtube (\\S+) >}}$/,
          fromBlock: (match) => ({ id: match[1] }),
          toBlock: ({ id }) => '{{< youtube ' + id + ' >}}',
          toPreview: ({ id }) => '<p class="video">Video ' + id + '</p>',
        });
        CMS.registerEditorComponent({
          id: 'callout',
          label: 'Callout',
          fields: [{ name: 'text', label: 'Text', widget: 'markdown' }],
          pattern: /^<aside>\\n([\\s\\S]*?)\\n<\\/aside>$/,
          fromBlock: (match) => ({ text: match[1] }),
          toBlock: ({ text }) => '<aside>\\n' + text + '\\n</aside>',
          toPreview: ({ text }) => {
            const element = document.createElement('aside');

            CMS.renderRichText(element, text);

            return element;
          },
        });
      `,
    });
    await cms.open();
  });

  test('inserts a custom component, and saves it as its block', async ({ cms, page }) => {
    await cms.signIn();

    const editor = await createPost(page, 'Launch Day');
    const field = editor.getByRole('group', { name: /Body.*Field/ });

    await cms.chooseMenuItem(
      field.getByRole('button', { name: 'Insert' }),
      page.getByRole('menuitem', { name: 'YouTube' }),
    );
    await field
      .getByRole('group', { name: 'YouTube', exact: true })
      .getByRole('textbox', { name: 'Video ID' })
      .fill('dQw4w9WgXcQ');

    // The preview shows what the component renders
    await expect(page.locator('.video')).toHaveText('Video dQw4w9WgXcQ');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/launch-day.md'])
      .toBe('---\ntitle: Launch Day\n---\n\n{{< youtube dQw4w9WgXcQ >}}\n');
  });

  test('reads the components back from the Markdown', async ({ cms, page }) => {
    await cms.seed({
      'content/posts/launch-day.md':
        '---\ntitle: Launch Day\n---\n\nWatch this.\n\n{{< youtube dQw4w9WgXcQ >}}\n\n<aside>\nDoors open at **noon**.\n</aside>\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Launch Day/ }).click();

    const field = page
      .getByRole('group', { name: 'Content Editor' })
      .getByRole('group', { name: /Body.*Field/ });

    await expect(
      field
        .getByRole('group', { name: 'YouTube', exact: true })
        .getByRole('textbox', { name: 'Video ID' }),
    ).toHaveValue('dQw4w9WgXcQ');
    await expect(
      field
        .getByRole('group', { name: 'Callout', exact: true })
        .getByRole('textbox', { name: 'Text' }),
    ).toHaveText('Doors open at noon.');
  });

  test('renders a preview with CMS.renderRichText()', async ({ cms, page }) => {
    await cms.seed({
      'content/posts/notice.md':
        '---\ntitle: Notice\n---\n\n<aside>\nDoors open at **noon**.\n</aside>\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Notice/ }).click();

    // The callout’s Markdown is rendered in the preview, bold text and all
    const preview = page.getByRole('document', { name: 'Content Preview' });

    await expect(preview.getByRole('complementary')).toHaveText('Doors open at noon.');
    await expect(preview.getByRole('complementary').locator('strong')).toHaveText('noon');
  });

  test('shows the syntax of a component in the preview of a longer body (known issue)', async ({
    cms,
    page,
  }) => {
    // A pattern anchored with `^` and `$`, like the YouTube one, the way Decap CMS documents them,
    // is matched against the whole body in the preview, so it only matches a component that makes
    // up the whole body; the editor matches it block by block. Once the preview matches it the same
    // way, expect “Video dQw4w9WgXcQ” in the preview instead of the shortcode
    await cms.seed({
      'content/posts/launch-day.md':
        '---\ntitle: Launch Day\n---\n\nWatch this.\n\n{{< youtube dQw4w9WgXcQ >}}\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Launch Day/ }).click();

    const preview = page.getByRole('document', { name: 'Content Preview' });

    await expect(preview).toContainText('{{< youtube dQw4w9WgXcQ >}}');
    await expect(preview.locator('.video')).toHaveCount(0);
  });
});

test.describe('CMS.registerPreviewStyle()', () => {
  test.use({ config: CONFIG });

  test('styles the preview with a raw stylesheet and a linked one', async ({ cms, page }) => {
    await page.route('**/preview.css', (route) =>
      route.fulfill({ contentType: 'text/css', body: 'p { font-style: italic; }' }),
    );
    await addScripts(page, {
      after: `
        CMS.registerPreviewStyle('h1 { color: rgb(200, 0, 0); }', { raw: true });
        CMS.registerPreviewStyle('/preview.css');
      `,
    });
    await cms.open();
    await cms.seed({
      'content/posts/styled.md': '---\ntitle: Styled\n---\n\n# Big News\n\nRead on.\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Styled/ }).click();

    // With custom styles, the preview is rendered in an iframe, which they can’t leak out of
    const frame = page.getByRole('group', { name: 'Preview Content' }).frameLocator('iframe');

    await expect(frame.locator('h1', { hasText: 'Big News' })).toHaveCSS('color', 'rgb(200, 0, 0)');
    await expect(frame.locator('p', { hasText: 'Read on.' })).toHaveCSS('font-style', 'italic');
    // The rest of the page isn’t styled
    await expect(
      page.getByRole('group', { name: /Body.*Field/ }).getByRole('heading', { name: 'Big News' }),
    ).not.toHaveCSS('color', 'rgb(200, 0, 0)');
  });
});

test.describe('CMS.registerEventListener()', () => {
  test.use({ config: CONFIG });

  test('changes the data before saving, and reports the saved entry', async ({ cms, page }) => {
    await addScripts(page, {
      after: `
        window.events = [];
        CMS.registerEventListener({
          name: 'preSave',
          handler: ({ entry }) => {
            window.events.push('preSave');

            return entry.get('data').set('title', entry.get('data').get('title').toUpperCase());
          },
        });
        CMS.registerEventListener({
          name: 'postSave',
          handler: ({ entry }) => {
            const title = entry.getIn(['data', 'title']);

            window.events.push('postSave ' + entry.get('slug') + ' ' + title);
          },
        });
      `,
    });
    await cms.open();
    await cms.signIn();

    const editor = await createPost(page, 'Quiet Night');

    await editor.getByRole('textbox', { name: 'Body' }).click();
    await page.keyboard.type('Stars out.');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The listener’s change is what’s written
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/quiet-night.md'])
      .toBe('---\ntitle: QUIET NIGHT\n---\n\nStars out.\n');
    await expect
      .poll(() => page.evaluate(() => /** @type {any} */ (window).events))
      .toEqual(['preSave', 'postSave quiet-night QUIET NIGHT']);
  });

  test.describe('with Editorial Workflow', () => {
    test.use({ config: WORKFLOW_CONFIG });

    test('reports publishing an entry', async ({ cms, github, page }) => {
      openEntryPullRequest(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
        status: 'pending_publish',
      });
      await addScripts(page, {
        after: `
          window.events = [];
          ['prePublish', 'postPublish'].forEach((name) => {
            CMS.registerEventListener({
              name,
              handler: ({ entry }) => {
                window.events.push(name + ' ' + entry.get('slug'));
              },
            });
          });
        `,
      });
      await cms.open();
      await page.getByRole('row', { name: /Second Post/ }).click();
      await page.getByRole('button', { name: 'Publish Entry' }).click();
      await page
        .getByRole('alertdialog', { name: 'Publish Entry' })
        .getByRole('button', { name: 'Publish' })
        .click();

      await expect
        .poll(() => page.evaluate(() => /** @type {any} */ (window).events))
        .toEqual(['prePublish second-post', 'postPublish second-post']);
    });
  });
});
