import { randomBytes } from 'node:crypto';

import { createPNG } from '../fixtures/files.js';
import { getBlobSHA } from '../fixtures/git.js';
import { expect, GITLAB_CONFIG, test } from '../fixtures/test.js';
import { getEditor, getEntryRows, openFirstPost } from '../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

test.use({ config: GITLAB_CONFIG });

test.beforeEach(async ({ gitlab }) => {
  gitlab.commit({ [POST_PATH]: FIRST_POST }, { message: 'Add the first post' });
});

test('signs in with the stored session and lists the entries', async ({ cms, page }) => {
  await cms.open();
  await expect(page.getByRole('row', { name: 'First Post' })).toBeVisible();

  const editor = await openFirstPost(page);

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Post');
});

test('lists the entries of a project with more files than a page of the file list', async ({
  cms,
  gitlab,
  page,
}) => {
  gitlab.commit({
    'content/posts/second-post.md': '---\ntitle: Second Post\n---\n',
    'content/posts/third-post.md': '---\ntitle: Third Post\n---\n',
  });
  gitlab.treePageSize = 2;
  await cms.open();

  await expect(getEntryRows(page)).toHaveCount(3);
});

test('refuses a user who can’t push code to the project', async ({ cms, gitlab, page }) => {
  gitlab.canWrite = false;

  await cms.open();
  await expect(page.getByRole('alert')).toContainText(
    /You don’t have write access to the .*e2e-site.* repository/,
  );
});

test('makes the content read-only when the user can’t push to the branch', async ({
  cms,
  gitlab,
  page,
}) => {
  gitlab.canPush = false;

  await cms.open();
  await expect(
    page.getByText(/You don’t have permission to push to the .*main.* branch/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
});

test('tells the user about an incident on GitLab', async ({ cms, gitlab, page }) => {
  gitlab.statusCode = 500;
  await cms.open();

  await expect(page.getByRole('alert').filter({ hasText: /is experiencing/ })).toHaveText(
    /GitLab.* is experiencing a major incident\./,
  );
});

test('commits a change, with the head the file was loaded at', async ({ cms, gitlab, page }) => {
  const { oid: headBefore } = gitlab.head;

  await cms.open();

  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitlab.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  expect(gitlab.received).toEqual([
    {
      branch: 'main',
      commit_message: 'Update Post “first-post”',
      actions: [
        {
          action: 'update',
          file_path: POST_PATH,
          content: '---\ntitle: First Post\n---\n\nHello from Mona!\n',
          encoding: 'text',
          last_commit_id: headBefore,
        },
      ],
    },
  ]);
  expect(gitlab.head.author.login).toBe(gitlab.user.login);
});

test('creates an entry, then deletes it', async ({ cms, gitlab, page }) => {
  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitlab.readFile('content/posts/second-post.md'))
    .toBe('---\ntitle: Second Post\n---\n\nHello!\n');
  // A new file has no last commit to check
  expect(gitlab.received[0].actions).toEqual([
    {
      action: 'create',
      file_path: 'content/posts/second-post.md',
      content: '---\ntitle: Second Post\n---\n\nHello!\n',
      encoding: 'text',
    },
  ]);

  await page.getByRole('row', { name: /Second Post/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect.poll(() => gitlab.readFile('content/posts/second-post.md')).toBeUndefined();
  expect(gitlab.received[1]).toMatchObject({
    commit_message: 'Delete Post “second-post”',
    actions: [
      {
        action: 'delete',
        file_path: 'content/posts/second-post.md',
        last_commit_id: gitlab.head.parents[0],
      },
    ],
  });
  await expect(getEntryRows(page)).toHaveCount(1);
});

test('shows an image from the project', async ({ cms, gitlab, page }) => {
  gitlab.commit({ 'static/images/sunset.png': createPNG({ color: [255, 128, 0] }) });
  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await page.getByRole('button', { name: 'Show Preview' }).click();

  const image = page.getByRole('group', { name: 'Asset Editor' }).getByRole('img', {
    name: 'sunset.png',
  });

  // The image is read from the raw file endpoint and decoded, not a broken one
  await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBe(32);
});

test('uploads an image', async ({ cms, gitlab, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  // The empty asset list has a button of its own
  await page.getByRole('button', { name: 'Upload New Assets' }).first().click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles({ name: 'kite.png', mimeType: 'image/png', buffer: kite });
  await page
    .getByRole('alertdialog', { name: 'Upload New Assets' })
    .getByRole('button', { name: 'Upload' })
    .click();

  await expect.poll(() => gitlab.head.tree.get('static/images/kite.png')).toBe(getBlobSHA(kite));
  expect(gitlab.received[0].actions).toEqual([
    expect.objectContaining({
      action: 'create',
      encoding: 'base64',
      content: kite.toString('base64'),
    }),
  ]);
});

test('splits an upload over the request size limit of the instance into several commits', async ({
  cms,
  gitlab,
  page,
}) => {
  // An image padded with random bytes, which don’t compress, takes 1 MB, or 1.3 MB once encoded
  const files = ['one.png', 'two.png', 'three.png'].map((name) => ({
    name,
    mimeType: 'image/png',
    buffer: Buffer.concat([createPNG({ color: [0, 0, 255] }), randomBytes(1024 * 1024)]),
  }));

  let refusals = 0;

  // An instance that takes 2 MB at most, like NGINX with a low `client_max_body_size`, answers a
  // larger request with 413 Content Too Large, without CORS headers
  await page.route(`${gitlab.apiRoot}/**`, async (route) => {
    const request = route.request();

    if (
      request.method() === 'POST' &&
      request.url().endsWith('/repository/commits') &&
      (request.postDataBuffer()?.length ?? 0) > 2 * 1024 * 1024
    ) {
      refusals += 1;
      await route.fulfill({ status: 413, contentType: 'text/html', body: '413' });
    } else {
      await route.fallback();
    }
  });

  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('button', { name: 'Upload New Assets' }).first().click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles(files);
  await page
    .getByRole('alertdialog', { name: 'Upload New Assets' })
    .getByRole('button', { name: 'Upload' })
    .click();

  await expect
    .poll(() => files.map(({ name }) => gitlab.head.tree.get(`static/images/${name}`)))
    .toEqual(files.map(({ buffer }) => getBlobSHA(buffer)));
  // The three files are sent again in commits of half the size, one file each
  expect(refusals).toBe(1);
  expect(gitlab.received.map(({ actions }) => actions.length)).toEqual([1, 1, 1]);
});

test('renames an image without sending its content again, which keeps it in Git LFS', async ({
  cms,
  gitlab,
  page,
}) => {
  const sunset = createPNG({ color: [255, 128, 0] });

  gitlab.commit({ 'static/images/sunset.png': sunset });

  const loadedHead = gitlab.head.oid;

  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Rename Asset' }),
  );

  const dialog = page.getByRole('dialog', { name: /Rename/ });

  await dialog.getByRole('textbox').fill('dusk.png');
  await dialog.getByRole('button', { name: 'Rename' }).click();

  await expect.poll(() => gitlab.head.tree.get('static/images/dusk.png')).toBe(getBlobSHA(sunset));
  expect(gitlab.head.tree.has('static/images/sunset.png')).toBe(false);
  // GitLab takes the existing blob for a move without content, which for a file tracked with Git
  // LFS is the pointer, while a move with content would commit the bytes as a regular blob
  expect(gitlab.received[0].actions).toEqual([
    {
      action: 'move',
      file_path: 'static/images/dusk.png',
      previous_path: 'static/images/sunset.png',
      last_commit_id: loadedHead,
    },
  ]);
});

test('lists an entry a colleague has added, on the next scheduled check', async ({
  cms,
  gitlab,
  page,
}) => {
  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  gitlab.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  await page.clock.fastForward('01:01');

  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test('warns before saving over a colleague’s change', async ({ cms, gitlab, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  gitlab.commit({ [POST_PATH]: '---\ntitle: First Post\n---\n\nHello from Alex!\n' });
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

  await expect(dialog).toContainText(
    'This entry has been changed in the repository after you opened it.',
  );
  expect(gitlab.received).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Save Anyway' }).click();

  await expect
    .poll(() => gitlab.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
});

test('refuses to save over a colleague’s change made during the commit', async ({
  cms,
  gitlab,
  page,
}) => {
  await cms.open();

  const editor = await openFirstPost(page);

  // A colleague changes the same file between the check before saving and the commit itself, so
  // the file’s last commit is no longer the one as of the head the commit carries
  // eslint-disable-next-line jsdoc/require-jsdoc
  gitlab.beforeCommit = () => {
    gitlab.commit({ [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') });
  };

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Error' });

  await expect(dialog).toContainText('The repository has been updated by someone else');
  // The colleague’s change is kept
  expect(gitlab.readFile(POST_PATH)).toBe('---\ntitle: First Post\n---\n\nHi, world!\n');
});

test('saves a change while a colleague changes another file', async ({ cms, gitlab, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  // GitLab only checks the files being changed, so a commit to another file doesn’t get in the way
  // eslint-disable-next-line jsdoc/require-jsdoc
  gitlab.beforeCommit = () => {
    gitlab.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  };

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitlab.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  expect(gitlab.readFile('content/posts/second-post.md')).toBe('---\ntitle: Second Post\n---\n');
  // The commit has landed on top of the colleague’s, which is fetched rather than skipped over
  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test.describe('with `prompt_commit_messages` on', () => {
  test.use({
    config: {
      ...GITLAB_CONFIG,
      backend: { ...GITLAB_CONFIG.backend, prompt_commit_messages: 'prefix' },
    },
  });

  test('lists the commits of an entry with their messages in the History panel', async ({
    cms,
    gitlab,
    page,
  }) => {
    gitlab.commit(
      { [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') },
      { author: gitlab.user, message: 'Say hi\n\nThe greeting was too formal.' },
    );
    // A commit to another file isn’t listed
    gitlab.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
    await cms.open();
    await page.getByRole('row', { name: /First Post/ }).click();
    await page
      .getByRole('radiogroup', { name: 'Sidebar Panels' })
      .getByRole('radio', { name: 'History' })
      .click();

    const commits = page.getByRole('group', { name: 'History', exact: true }).getByRole('link');

    await expect(commits).toHaveCount(2);
    // Each commit is shown with the headline of its message
    await expect(commits.first()).toContainText('Say hi');
    await expect(commits.first()).not.toContainText('too formal');
    await expect(commits.first()).toContainText(gitlab.user.name);
    await expect(commits.last()).toContainText('Add the first post');
    await expect(commits.last()).toContainText(gitlab.colleague.name);

    // A commit opens on GitLab in a new tab
    await page
      .context()
      .route('https://gitlab.com/sveltia/**', (route) => route.fulfill({ body: '' }));

    const [popup] = await Promise.all([page.waitForEvent('popup'), commits.last().click()]);

    expect(popup.url()).toBe(
      `https://gitlab.com/sveltia/e2e-site/-/commit/${gitlab.commits.at(-3)?.oid}`,
    );
  });
});

test.describe('with a gallery of entry-relative media', () => {
  test.use({
    config: {
      ...GITLAB_CONFIG,
      collections: [
        {
          name: 'galleries',
          label: 'Galleries',
          folder: 'content/gallery',
          path: '{{slug}}/index',
          media_folder: '.',
          public_folder: '.',
          create: true,
          fields: [{ name: 'title', label: 'Title' }],
        },
      ],
    },
  });

  test('lists only the folders a colleague’s commit has changed when loading again', async ({
    cms,
    gitlab,
    page,
  }) => {
    const png = createPNG();

    gitlab.commit({
      'content/gallery/spring/index.md': '---\ntitle: Spring\n---\n',
      'content/gallery/spring/a.png': png,
      'content/gallery/summer/index.md': '---\ntitle: Summer\n---\n',
      'content/gallery/summer/b.png': png,
    });

    /** @type {string[]} */
    const listed = [];

    page.on('request', (request) => {
      const url = new URL(request.url());

      if (url.pathname.endsWith('/repository/tree')) {
        listed.push(url.searchParams.get('path') ?? '');
      }
    });

    await cms.open();
    await expect(page.getByRole('row', { name: 'Summer' })).toBeVisible();
    expect(listed.sort()).toEqual([
      'content/gallery',
      'content/gallery/spring',
      'content/gallery/summer',
    ]);

    gitlab.commit({
      'content/gallery/autumn/index.md': '---\ntitle: Autumn\n---\n',
      'content/gallery/autumn/c.png': png,
    });
    listed.length = 0;
    await page.reload();

    // The albums that haven’t changed come from the cache
    await expect(page.getByRole('row', { name: 'Autumn' })).toBeVisible();
    await expect(page.getByRole('row', { name: 'Spring' })).toBeVisible();
    expect(listed.sort()).toEqual(['content/gallery', 'content/gallery/autumn']);

    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect(page.getByRole('row', { name: /^[abc]\.png$/ })).toHaveCount(3);
  });
});
