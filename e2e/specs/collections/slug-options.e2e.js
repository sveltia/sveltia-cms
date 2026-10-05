import { expect, test } from '../../fixtures/test.js';

import { getEntryList, openCollection } from './helpers.js';

/**
 * @import { Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * A blog with the given global `slug` options, and optionally more collection options, e.g. a
 * `slug` template or the deprecated `slug_length`.
 * @param {Record<string, any>} [slug] Global slug options.
 * @param {Record<string, any>} [collection] More collection options.
 * @returns {Record<string, any>} Config.
 */
const makeConfig = (slug, collection = {}) => ({
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  ...(slug ? { slug } : {}),
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      fields: [{ name: 'title', label: 'Title' }],
      ...collection,
    },
  ],
});

/**
 * Create a post with the given title and save it, which takes us back to the entry list.
 * @param {Page} page Page.
 * @param {string} title Title.
 */
const createPost = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
};

/**
 * Wait for the post files in the repository to be the given ones.
 * @param {CMS} cms CMS fixture.
 * @param {string[]} paths File paths under `content/posts/`, sorted.
 */
const expectPosts = async (cms, paths) => {
  await expect
    .poll(async () =>
      Object.keys(await cms.readRepo())
        .filter((path) => path.startsWith('content/posts/'))
        .map((path) => path.replace('content/posts/', ''))
        .sort(),
    )
    .toEqual(paths);
};

/**
 * Open an entry from the list by its title, and check that the editor shows it.
 * @param {Page} page Page.
 * @param {string} title Title.
 */
const reopenPost = async (page, title) => {
  await getEntryList(page).getByRole('row', { name: title, exact: true }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
};

/**
 * A title with accents, Japanese, an emoji, punctuation and repeated separators.
 */
const MIXED_TITLE = '  Café: 日本語のタイトル 🎉 -- Hello, World!  ';

/**
 * Open the CMS, seed the repository with the given files and sign in.
 * @param {CMS} cms CMS fixture.
 * @param {Record<string, string>} [files] Files to seed.
 */
const start = async (cms, files) => {
  await cms.open();

  if (files) {
    await cms.seed(files);
  }

  await cms.signIn();
};

test.describe('default options', () => {
  test.use({ config: makeConfig() });

  test('keeps Unicode letters and emoji, and collapses and trims separators', async ({
    cms,
    page,
  }) => {
    await start(cms);
    await createPost(page, MIXED_TITLE);
    await expectPosts(cms, ['café-日本語のタイトル-🎉-hello-world.md']);
    await reopenPost(page, MIXED_TITLE.trim());
  });

  test('adds a number to the slug of a post with the same title', async ({ cms, page }) => {
    await start(cms, { 'content/posts/hello-world.md': '---\ntitle: Hello World\n---\n' });
    await createPost(page, 'Hello World');
    await expectPosts(cms, ['hello-world-1.md', 'hello-world.md']);
    await createPost(page, 'Hello, World!');
    await expectPosts(cms, ['hello-world-1.md', 'hello-world-2.md', 'hello-world.md']);
    // A title differing only in case is lowercased to the same slug
    await createPost(page, 'HELLO WORLD');
    await expectPosts(cms, [
      'hello-world-1.md',
      'hello-world-2.md',
      'hello-world-3.md',
      'hello-world.md',
    ]);
    await expect(getEntryList(page).getByRole('row')).toHaveCount(4);
    await reopenPost(page, 'Hello, World!');
  });

  test('adds a number to the end of a duplicate slug containing a dot', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, 'Node.js Tips');
    await expectPosts(cms, ['node.js-tips.md']);
    await createPost(page, 'Node.js Tips');
    // The part after the dot isn’t a file extension
    await expectPosts(cms, ['node.js-tips-1.md', 'node.js-tips.md']);
  });
});

test.describe('`encoding: ascii`', () => {
  test.use({ config: makeConfig({ encoding: 'ascii' }) });

  test('drops non-ASCII characters and punctuation', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, MIXED_TITLE);
    // The hyphens are safe characters, which are collapsed with the replacements around them
    await expectPosts(cms, ['caf-hello-world.md']);
    await reopenPost(page, MIXED_TITLE.trim());
  });

  test('keeps underscores and tildes, and drops dots', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, 'snake_case ~tilde~ v1.2');
    await expectPosts(cms, ['snake_case-~tilde~-v1-2.md']);
  });
});

test.describe('`clean_accents: true`', () => {
  test.use({ config: makeConfig({ clean_accents: true }) });

  test('transliterates accented letters and punctuation, and keeps other Unicode characters', async ({
    cms,
    page,
  }) => {
    await start(cms);
    // The umlaut is spelled out as in German, and the em dash becomes a hyphen
    await createPost(page, 'Crème brûlée à Zürich — 日本語');
    await expectPosts(cms, ['creme-brulee-a-zuerich-日本語.md']);
    await reopenPost(page, 'Crème brûlée à Zürich — 日本語');
  });
});

test.describe('`clean_accents: true` with `encoding: ascii`', () => {
  test.use({ config: makeConfig({ encoding: 'ascii', clean_accents: true }) });

  test('transliterates accented letters before dropping non-ASCII characters', async ({
    cms,
    page,
  }) => {
    await start(cms);
    await createPost(page, MIXED_TITLE);
    await expectPosts(cms, ['cafe-hello-world.md']);
    await reopenPost(page, MIXED_TITLE.trim());
  });
});

test.describe('`sanitize_replacement`', () => {
  test.use({ config: makeConfig({ sanitize_replacement: '_' }) });

  test('joins the words with the replacement, collapsed and trimmed', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, '_ Hello, World! _ Again _');
    await expectPosts(cms, ['hello_world_again.md']);
    await reopenPost(page, '_ Hello, World! _ Again _');
  });

  test('adds a number to a duplicate slug with a hyphen', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, 'Hello World');
    await createPost(page, 'Hello World');
    await expectPosts(cms, ['hello_world-1.md', 'hello_world.md']);
  });
});

test.describe('`trim: false`', () => {
  test.use({ config: makeConfig({ trim: false }) });

  test('keeps the replacement at either end, collapsed', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, '--Hello World--');
    await expectPosts(cms, ['-hello-world-.md']);
    await reopenPost(page, '--Hello World--');
  });

  test('still trims the spaces that punctuation at either end turns into', async ({
    cms,
    page,
  }) => {
    await start(cms);
    await createPost(page, '!Hello World?');
    await expectPosts(cms, ['hello-world.md']);
  });
});

test.describe('`trim: false` with `maxlength`', () => {
  test.use({ config: makeConfig({ trim: false, maxlength: 50 }) });

  test('keeps the replacement at either end of a slug that isn’t cut', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, '--Hello World--');
    await expectPosts(cms, ['-hello-world-.md']);
  });
});

test.describe('`maxlength`', () => {
  test.use({ config: makeConfig({ maxlength: 20 }) });

  test('cuts a long slug and the replacement left at the end', async ({ cms, page }) => {
    const title = `The quick brown fox jumps over the lazy dog ${'again and '.repeat(20)}`.trim();

    await start(cms);
    // The 20th character is a hyphen
    await createPost(page, title);
    await expectPosts(cms, ['the-quick-brown-fox.md']);
    await reopenPost(page, title);
  });

  test('counts characters, not bytes, in a non-Latin slug', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, '日本語のとても長いタイトルです。最後まで読んでください 🎉🎉🎉');
    await expectPosts(cms, ['日本語のとても長いタイトルです。最後まで.md']);
  });

  test('cuts the slug before a number is added to a duplicate', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, 'The quick brown fox jumps over the lazy dog');
    await createPost(page, 'The quick brown fox jumps over the lazy cat');
    await expectPosts(cms, ['the-quick-brown-fox-1.md', 'the-quick-brown-fox.md']);
  });
});

test.describe('collection `slug_length`', () => {
  test.use({
    config: {
      ...makeConfig({ maxlength: 20 }),
      collections: [
        makeConfig(undefined, { slug_length: 9 }).collections[0],
        {
          ...makeConfig().collections[0],
          name: 'notes',
          label: 'Notes',
          label_singular: 'Note',
          folder: 'content/notes',
        },
      ],
    },
  });

  test('takes precedence over the global `maxlength`', async ({ cms, page }) => {
    await start(cms);
    await createPost(page, 'The quick brown fox jumps over the lazy dog');
    await expectPosts(cms, ['the-quick.md']);

    // The other collection uses the global option
    await openCollection(page, 'Notes');
    await createPost(page, 'The quick brown fox jumps over the lazy dog');
    await expect
      .poll(async () =>
        Object.keys(await cms.readRepo()).filter((p) => p.startsWith('content/notes/')),
      )
      .toEqual(['content/notes/the-quick-brown-fox.md']);
    await reopenPost(page, 'The quick brown fox jumps over the lazy dog');
  });
});

test.describe('`lowercase: false`', () => {
  test.use({
    config: makeConfig(
      { lowercase: false },
      {
        slug: '{{fields.category | upper}}-{{title}}',
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'category', label: 'Category', widget: 'select', options: ['news', 'tips'] },
        ],
      },
    ),
  });

  test('keeps the case of the title and of a transformed field', async ({ cms, page }) => {
    await start(cms);
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Hello World');
    await editor.getByRole('radio', { name: 'tips' }).click();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expectPosts(cms, ['TIPS-Hello-World.md']);
    await reopenPost(page, 'Hello World');
  });
});

test.describe('slug template', () => {
  test.use({
    config: makeConfig(undefined, {
      slug: "{{year}}{{month}}{{day}}-{{hour}}{{minute}}-{{fields.category}}-{{title}}-{{subtitle | default('draft')}}",
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'subtitle', label: 'Subtitle', required: false },
        { name: 'category', label: 'Category', widget: 'select', options: ['News Flash', 'Tips'] },
      ],
    }),
  });

  test('fills the date, field and transformation tags, and slugifies each value', async ({
    cms,
    page,
  }) => {
    // The date tags come from the time of saving, in UTC by default
    await page.clock.install({ time: new Date('2026-05-10T07:08:00Z') });
    await start(cms);

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Café Ölé!');
    await editor.getByRole('radio', { name: 'News Flash' }).click();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expectPosts(cms, ['20260510-0708-news-flash-café-ölé-draft.md']);

    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Second');
    await editor.getByRole('textbox', { name: 'Subtitle' }).fill('With: Subtitle');
    await editor.getByRole('radio', { name: 'Tips' }).click();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expectPosts(cms, [
      '20260510-0708-news-flash-café-ölé-draft.md',
      '20260510-0708-tips-second-with-subtitle.md',
    ]);
    await reopenPost(page, 'Café Ölé!');
  });
});

test.describe('`timezone: local`', () => {
  test.use({
    config: makeConfig({ timezone: 'local' }, { slug: '{{year}}-{{month}}-{{day}}-{{title}}' }),
    timezoneId: 'Asia/Tokyo',
  });

  test('fills the date tags with the local date', async ({ cms, page }) => {
    // It’s already the next day in Tokyo
    await page.clock.install({ time: new Date('2026-05-10T20:00:00Z') });
    await start(cms);
    await createPost(page, 'Late Night');
    await expectPosts(cms, ['2026-05-11-late-night.md']);
  });
});
