import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../fixtures/configs/workflow.js';
import { createPNG } from '../fixtures/files.js';
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

test.describe('toPreview() arguments', () => {
  test.use({ config: CONFIG });

  test.beforeEach(async ({ cms, page }) => {
    // A figure whose preview shows the URL `getAsset` resolves rather than an `<img>`, as the CMS
    // replaces the `src` of an image by itself. The `fields` argument is read the way the built-in
    // image component of Decap CMS does
    await addScripts(page, {
      after: `
        CMS.registerEditorComponent({
          id: 'figure',
          label: 'Figure',
          fields: [
            { name: 'src', label: 'Image', widget: 'image' },
            { name: 'caption', label: 'Caption', required: false },
          ],
          pattern: /^{{< figure src="(?<src>.*?)" >}}$/m,
          toBlock: ({ src = '' }) => '{{< figure src="' + src + '" >}}',
          toPreview: ({ src = '' }, getAsset, fields) => {
            const imageField = fields?.find((field) => field.get('widget') === 'image');
            const element = document.createElement('figure');

            element.dataset.src = src;
            element.dataset.url = getAsset(src, imageField)?.url ?? '';
            element.dataset.field = imageField?.get('name') ?? '';

            return element;
          },
        });
      `,
    });
    await cms.open();
  });

  /**
   * Get the figure preview for the given path.
   * @param {Page} page Page.
   * @param {string} src Path in the Markdown.
   * @returns {Locator} Figure.
   */
  const getFigure = (page, src) =>
    page.getByRole('document', { name: 'Content Preview' }).locator(`figure[data-src="${src}"]`);

  test('resolves a file in the repository, and passes the fields', async ({ cms, page }) => {
    await cms.seed({
      'static/images/photo.png': createPNG({ color: [40, 120, 200] }),
      'content/posts/gallery.md':
        '---\ntitle: Gallery\n---\n\n{{< figure src="/images/photo.png" >}}\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Gallery/ }).click();

    const figure = getFigure(page, '/images/photo.png');

    // The asset has the public path until the file is read from the repository, which doesn’t point
    // to a file that hasn’t been published; the preview is computed again with the blob URL
    await expect(figure).toHaveAttribute('data-url', /^blob:/);
    await expect(figure).toHaveAttribute('data-field', 'src');
  });

  test('resolves a file picked in the component but not saved yet', async ({ cms, page }) => {
    await cms.signIn();

    const editor = await createPost(page, 'Gallery');
    const field = editor.getByRole('group', { name: /Body.*Field/ });

    await cms.chooseMenuItem(
      field.getByRole('button', { name: 'Insert' }),
      page.getByRole('menuitem', { name: 'Figure' }),
    );
    await field
      .getByRole('group', { name: 'Figure', exact: true })
      .getByRole('group', { name: /Image/ })
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: 'dome.png',
        mimeType: 'image/png',
        buffer: createPNG({ color: [200, 180, 40] }),
      });

    const figure = page
      .getByRole('document', { name: 'Content Preview' })
      .locator('figure[data-src]:not([data-src=""])');

    await expect(figure).toHaveAttribute('data-url', /^blob:/);
  });

  test('returns an external URL as is, and nothing for a missing file', async ({ cms, page }) => {
    await cms.seed({
      'content/posts/gallery.md':
        '---\ntitle: Gallery\n---\n\n{{< figure src="https://example.com/photo.png" >}}\n\n' +
        '{{< figure src="/images/missing.png" >}}\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Gallery/ }).click();

    await expect(getFigure(page, 'https://example.com/photo.png')).toHaveAttribute(
      'data-url',
      'https://example.com/photo.png',
    );
    await expect(getFigure(page, '/images/missing.png')).toHaveAttribute('data-url', '');
  });
});

test.describe('media in an element preview', () => {
  test.use({ config: CONFIG });

  test('resolves the URLs of a video rendered after the fact', async ({ cms, page }) => {
    // A component rendered by another library, like Comark, which fills the element in later
    await addScripts(page, {
      after: `
        CMS.registerEditorComponent({
          id: 'clip',
          label: 'Clip',
          fields: [{ name: 'src', label: 'Video', widget: 'file' }],
          pattern: /^{{< clip src="(?<src>.*?)" >}}$/m,
          toBlock: ({ src = '' }) => '{{< clip src="' + src + '" >}}',
          toPreview: ({ src = '' }) => {
            const element = document.createElement('div');

            setTimeout(() => {
              element.innerHTML =
                '<video poster="/images/poster.png"><source src="' + src + '"></video>';
            }, 100);

            return element;
          },
        });
      `,
    });
    await cms.open();
    await cms.seed({
      'static/images/clip.mp4': Buffer.from('clip'),
      'static/images/poster.png': createPNG({ color: [10, 20, 30] }),
      'content/posts/clips.md': '---\ntitle: Clips\n---\n\n{{< clip src="/images/clip.mp4" >}}\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Clips/ }).click();

    const video = page.getByRole('document', { name: 'Content Preview' }).locator('video');

    await expect(video).toHaveAttribute('poster', /^blob:/);
    await expect(video.locator('source')).toHaveAttribute('src', /^blob:/);
  });
});

test.describe('html', () => {
  test.use({
    config: {
      ...CONFIG,
      collections: [
        {
          ...CONFIG.collections[0],
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'body', label: 'Body', widget: 'markdown', required: false },
            { name: 'tagline', label: 'Tagline', widget: 'shout', required: false },
          ],
        },
      ],
    },
  });

  test.beforeEach(async ({ page }) => {
    // Components written with the HTM tagged template rather than `h()`, as a page would without a
    // build step. The preview template is only registered when asked for, as it replaces the
    // previews of the fields
    await addScripts(page, {
      after: `
        const { useState } = CMS.React;

        const Badge = ({ label, children }) => html\`
          <span
            class="badge"
            style="--gap: 4px; padding: var(--gap); color: red; font-weight: bold !important"
          >
            \${label}: \${children}
          </span>
        \`;

        const PostPreview = ({ entry }) => {
          const [count, setCount] = useState(0);

          return html\`
            <h1 class="title">\${entry.getIn(['data', 'title'])}</h1>
            <\${Badge} label="Likes">\${count}<//>
            <button onClick=\${() => setCount(count + 1)}>Like</button>
          \`;
        };

        if (window.usePreviewTemplate) {
          CMS.registerPreviewTemplate('posts', PostPreview);
        }

        CMS.registerFieldType(
          'shout',
          ({ value, onChange, forID, classNameWrapper }) => html\`
            <input
              id=\${forID}
              class=\${classNameWrapper}
              value=\${value ?? ''}
              onInput=\${(event) => onChange(event.target.value)}
            />
          \`,
          ({ value }) => html\`<strong class="shout">\${value?.toUpperCase()}</strong>\`,
        );

        CMS.registerEditorComponent({
          id: 'youtube',
          label: 'YouTube',
          fields: [{ name: 'id', label: 'Video ID' }],
          pattern: /^{{< youtube (\\S+) >}}$/,
          fromBlock: (match) => ({ id: match[1] }),
          toBlock: ({ id }) => '{{< youtube ' + id + ' >}}',
          toPreview: ({ id }) => html\`
            <p class="video" style="font-style: italic">Video \${id}</p>
          \`,
        });
      `,
    });
  });

  test('renders a preview template with hooks, attributes and inline styles', async ({
    cms,
    page,
  }) => {
    await page.addInitScript(() => {
      /** @type {any} */ (window).usePreviewTemplate = true;
    });
    await cms.open();
    await cms.seed({ 'content/posts/launch-day.md': '---\ntitle: Launch Day\n---\n\nHello.\n' });
    await cms.signIn();
    await page.getByRole('row', { name: /Launch Day/ }).click();

    const preview = page.frameLocator('iframe').first();
    const badge = preview.locator('.badge');

    await expect(preview.locator('h1.title')).toHaveText('Launch Day');
    await expect(badge).toHaveText('Likes: 0');
    // A `style` string, which React alone rejects, is converted to an object
    await expect(badge).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(badge).toHaveCSS('font-weight', '700');
    await expect(badge).toHaveCSS('padding-top', '4px');
    await preview.getByRole('button', { name: 'Like' }).click();
    await expect(badge).toHaveText('Likes: 1');
  });

  test('renders the control and the preview of a field type', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();

    const editor = await createPost(page, 'Launch Day');
    const input = editor.getByRole('group', { name: /Tagline.*Field/ }).getByRole('textbox');

    await input.fill('we have liftoff');
    await expect(
      page.getByRole('document', { name: 'Content Preview' }).locator('.shout'),
    ).toHaveText('WE HAVE LIFTOFF');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/launch-day.md'])
      .toBe('---\ntitle: Launch Day\ntagline: we have liftoff\n---\n');
  });

  test('renders the preview of an editor component', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({
      'content/posts/launch-day.md': '---\ntitle: Launch Day\n---\n\n{{< youtube dQw4w9WgXcQ >}}\n',
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Launch Day/ }).click();

    const video = page.getByRole('document', { name: 'Content Preview' }).locator('.video');

    await expect(video).toHaveText('Video dQw4w9WgXcQ');
    await expect(video).toHaveCSS('font-style', 'italic');
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
