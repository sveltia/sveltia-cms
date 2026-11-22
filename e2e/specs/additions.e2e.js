import { ADDITIONS_URL, MockAdditions } from '../fixtures/additions.js';
import { MockS3 } from '../fixtures/cloud/s3.js';
import { expect, GITHUB_CONFIG, test } from '../fixtures/test.js';
import { getEditor, openFirstPost } from '../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 */

const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

// Users sign in to Sveltia CMS Additions, which hands out the GitHub token, so no GitHub session
// is stored beforehand
const ADDITIONS_CONFIG = {
  ...GITHUB_CONFIG,
  backend: { ...GITHUB_CONFIG.backend, auth_type: 'additions', base_url: ADDITIONS_URL },
};

test.use({ signedIn: false, config: ADDITIONS_CONFIG });

/**
 * Requests made once signed in, at about the same time, so in no set order: the shared
 * credentials, the socket ticket and, once the socket is open, the comment counts.
 */
const SIGNED_IN_REQUESTS = [
  'GET /v1/comments/counts',
  'GET /v1/credentials',
  'POST /v1/socket/ticket',
];

/** @type {MockAdditions} */
let additions;

test.beforeEach(async ({ github, page }) => {
  github.commit({ 'content/posts/first-post.md': FIRST_POST });
  additions = new MockAdditions(github);
  await additions.install(page);
});

/**
 * Sign in with the username and password form.
 * @param {Page} page Page.
 * @param {string} username Username.
 * @param {string} password Password.
 */
const signIn = async (page, username, password) => {
  await page.getByRole('textbox', { name: 'Username' }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
};

test('signs in with a username and password instead of GitHub', async ({ cms, page }) => {
  await additions.addUser({ username: 'editor', password: 'correct horse battery staple' });
  await cms.open();

  // The GitHub sign-in options are replaced
  await expect(page.getByRole('button', { name: /^Sign In with/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign In Using Access Token' })).toHaveCount(0);

  await signIn(page, 'Editor', 'correct horse battery staple');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  // The repository was read with the token the service handed out, without asking GitHub who the
  // user is or whether they can write: an installation token can’t tell. Then the shared
  // credentials are loaded and the entry locks shared, and once their socket is open, the comment
  // counts loaded
  await expect.poll(() => additions.requests).toHaveLength(6);
  // The sign-in page asks which sign-in methods there are, which also gives the site ID the
  // password is derived with, so signing in doesn’t ask again
  expect(additions.requests.slice(0, 3)).toEqual([
    'GET /version',
    'POST /v1/auth/sign-in',
    'GET /v1/auth/session',
  ]);
  expect(additions.requests.slice(3).toSorted()).toEqual(SIGNED_IN_REQUESTS);
});

test('loads its own chunk, before offering the sign-in', async ({ cms, page }) => {
  /** @type {string[]} */
  const chunks = [];

  page.on('request', (request) => {
    const { pathname } = new URL(request.url());

    if (pathname.includes('/chunks/')) {
      chunks.push(pathname.split('/').pop() ?? '');
    }
  });

  await cms.open();
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  // Leaving out the modules the build splits off for several chunks to share, whose names start
  // with an underscore
  expect(chunks.filter((name) => !name.startsWith('_'))).toEqual(['additions.js']);
});

test.describe('without Sveltia CMS Additions', () => {
  test.use({ signedIn: true, config: GITHUB_CONFIG });

  test('never loads its chunk', async ({ cms, page }) => {
    /** @type {string[]} */
    const requests = [];

    page.on('request', (request) => {
      requests.push(new URL(request.url()).pathname);
    });

    await cms.open();
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    expect(requests.filter((pathname) => pathname.includes('additions'))).toEqual([]);
  });
});

test('signs in with GitHub in a popup', async ({ cms, page }) => {
  await additions.addUser({ username: 'mona', password: 'unused password' });
  additions.githubSignIn = 'mona';
  await cms.open();

  await page.getByRole('button', { name: /^Sign In with .GitHub/ }).click();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  expect(additions.requests).toContain('POST /v1/auth/token');

  // Someone the service doesn’t know is turned away
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Sign Out' }),
  );
  additions.githubSignIn = 'stranger';
  await page.getByRole('button', { name: /^Sign In with .GitHub/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'You don’t have an account here. Ask your admin to add you.',
  );
});

test('links a GitHub account from the account menu', async ({ cms, page }) => {
  await additions.addUser({ username: 'editor', password: 'editor password' });
  // Signing in with GitHub is on, but not for this person yet
  additions.githubSignIn = 'someone-else';
  await cms.open();
  await signIn(page, 'editor', 'editor password');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Link GitHub Account' }),
  );

  // The CMS carries on with the new session, and the previous one is ended
  await expect.poll(() => additions.requests).toContain('POST /v1/auth/sign-out');
  await page.getByRole('button', { name: 'Show Account Menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Link GitHub Account' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // It’s kept across a reload
  await page.reload();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
});

test('refuses a wrong password', async ({ cms, page }) => {
  await additions.addUser({ username: 'editor', password: 'correct horse battery staple' });
  await cms.open();
  await signIn(page, 'editor', 'wrong password');

  await expect(page.getByRole('alert')).toContainText('The username or password is wrong.');
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toHaveCount(0);
});

test('asks a user with a temporary password to choose a new one first', async ({ cms, page }) => {
  const user = await additions.addUser({
    username: 'editor',
    password: 'temporary password',
    mustChangePassword: true,
  });

  await cms.open();
  await signIn(page, 'editor', 'temporary password');
  await expect(page.getByRole('heading', { name: 'Choose a New Password' })).toBeVisible();

  await page.getByLabel('New password', { exact: true }).fill('a brand new password');
  await page.getByRole('button', { name: 'Change Password' }).click();

  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  expect(user.mustChangePassword).toBe(false);

  // The new password works from now on
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Sign Out' }),
  );
  await signIn(page, 'editor', 'a brand new password');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
});

test('makes everything read-only for a viewer', async ({ cms, page }) => {
  await additions.addUser({ username: 'viewer', password: 'viewer password', role: 'viewer' });
  await cms.open();
  await signIn(page, 'viewer', 'viewer password');

  await expect(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();

  const editor = await openFirstPost(page);

  await expect(editor.getByRole('status')).toHaveText(
    /You have view-only access\. You can view content and assets but cannot make any changes\./,
  );
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveAttribute('readonly');
  await expect(editor.getByRole('button', { name: 'Save' })).toHaveCount(0);

  await editor.getByRole('button', { name: 'Cancel Editing' }).click();
  await page.getByRole('radio', { name: 'Assets' }).click();

  // The media library is read-only too, although asset folders are set up before sign-in
  const library = page.getByRole('group', { name: 'Asset Library' });

  await expect(library.getByRole('status')).toHaveText(/You have view-only access\./);
  await expect(library.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();
});

test('gets a new GitHub token from the service when GitHub refuses the current one', async ({
  cms,
  github,
  page,
}) => {
  await additions.addUser({ username: 'editor', password: 'editor password' });
  await cms.open();
  await signIn(page, 'editor', 'editor password');

  const editor = await openFirstPost(page);

  // The token expires, or is revoked, while the user is editing
  github.token = 'e2e-token-renewed';

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md'))
    .toBe('---\ntitle: First Post\n---\n\nHello again!\n');
  expect(additions.requests).toContain('POST /v1/auth/token');
  await expect(getEditor(page)).toHaveCount(0);
});

test('commits as the person who made the change, not the app', async ({ cms, github, page }) => {
  await additions.addUser({ username: 'editor', password: 'editor password' });
  await cms.open();
  await signIn(page, 'editor', 'editor password');

  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Editor!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md'))
    .toBe('---\ntitle: First Post\n---\n\nHello from Editor!\n');
  expect(github.getHead('main').author).toEqual({
    name: 'Editor',
    email: 'editor@users.noreply.additions.example',
    date: expect.any(String),
  });
  expect(github.received.at(-1)).toMatchObject({ committer: { name: 'Editor' } });
});

test('signs in again on its own with the stored session', async ({ cms, page }) => {
  await additions.addUser({ username: 'editor', password: 'editor password' });
  await cms.open();
  await signIn(page, 'editor', 'editor password');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  additions.requests = [];
  await page.reload();

  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  await expect.poll(() => additions.requests).toHaveLength(5);
  expect(additions.requests.slice(0, 2)).toEqual(['GET /version', 'GET /v1/auth/session']);
  expect(additions.requests.slice(2).toSorted()).toEqual(SIGNED_IN_REQUESTS);
});

test('ends the session on the service when signing out', async ({ cms, page }) => {
  await additions.addUser({ username: 'editor', password: 'editor password' });
  await cms.open();
  await signIn(page, 'editor', 'editor password');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Sign Out' }),
  );

  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  expect(additions.requests).toContain('POST /v1/auth/sign-out');
  expect(additions.sessions.size).toBe(0);
});

test('changes the name and the password in the Account settings and carries on', async ({
  cms,
  page,
}) => {
  await additions.addUser({ username: 'editor', password: 'editor password' });
  await cms.open();
  await signIn(page, 'editor', 'editor password');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  // The password is changed in Settings now, not from the menu
  await page.getByRole('button', { name: 'Show Account Menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Change Password' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  const dialog = page.getByRole('dialog', { name: 'Settings' });

  // It opens on the Account panel
  await expect(dialog.getByRole('tab', { name: 'Account' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // The name is changed, and becomes the commit author at once; the email is left to admins
  await expect(dialog.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
    'aria-readonly',
    'true',
  );
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Ed Itor');
  await dialog.getByRole('button', { name: 'Change Name' }).click();
  await expect(page.getByText('Your name has been changed.')).toBeVisible();
  expect(additions.users.get('editor')).toMatchObject({ name: 'Ed Itor' });
  // The account is read again, which brings the new commit author
  expect(additions.requests.slice(additions.requests.indexOf('PATCH /v1/auth/profile'))).toContain(
    'GET /v1/auth/session',
  );

  await dialog.getByLabel('Current password').fill('wrong password');
  await dialog.getByLabel('New password', { exact: true }).fill('new editor password');
  await dialog.getByRole('button', { name: 'Change Password' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('The current password is wrong.');

  await dialog.getByLabel('Current password').fill('editor password');
  await dialog.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByText('Your password has been changed.')).toBeVisible();
  await expect(dialog.getByLabel('Current password')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // The CMS carries on with the new session, and signs in again on its own with it
  await page.reload();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  expect(additions.sessions.size).toBe(1);

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Sign Out' }),
  );
  await signIn(page, 'editor', 'editor password');
  await expect(page.getByRole('alert')).toContainText('The username or password is wrong.');
  await signIn(page, 'editor', 'new editor password');
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
});

test.describe('entry locks', () => {
  const KEY = 'posts/first-post@main';

  test('show who is editing an entry, which the user can take over', async ({ cms, page }) => {
    await additions.addUser({ username: 'editor', password: 'editor password' });
    await cms.open();
    await signIn(page, 'editor', 'editor password');
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect.poll(() => additions.lockSockets.size).toBe(1);

    additions.setLock(KEY, 'Bob');
    await expect(page.getByRole('img', { name: /Being edited by .Bob/ })).toBeVisible();

    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);

    await expect(editor.getByText(/Bob. has been editing this entry since/)).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    await expect(editor.getByRole('button', { name: 'Save' })).toHaveCount(0);

    await editor.getByRole('button', { name: 'Take Over' }).click();
    await expect(editor.getByText(/has been editing this entry/)).toHaveCount(0);
    await expect(editor.getByRole('textbox', { name: 'Body' })).not.toHaveAttribute(
      'aria-readonly',
      'true',
    );
    expect(additions.locks.get(KEY)).toMatchObject({ name: 'Editor' });

    // Closing the editor releases the lock
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect.poll(() => additions.locks.has(KEY)).toBe(false);
  });

  test('show who else has an entry open, in the list and in the editor', async ({ cms, page }) => {
    await additions.addUser({ username: 'editor', password: 'editor password' });
    await cms.open();
    await signIn(page, 'editor', 'editor password');
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect.poll(() => additions.lockSockets.size).toBe(1);

    // Bob is editing it, and Carol and Dan are looking at it
    additions.setLock(KEY, 'Bob');
    ['Bob', 'Carol', 'Dan'].forEach((name) => additions.setViewer(KEY, name));
    await expect(page.getByRole('img', { name: /Being edited by .Bob/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Open by .Carol and Dan.$/ })).toBeVisible();

    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);

    // The user is one of them now, but sees only the others
    await expect
      .poll(() => additions.viewers.get(KEY)?.map(({ name }) => name))
      .toEqual(['Bob', 'Carol', 'Dan', 'Editor']);
    await expect(
      editor.getByRole('img', { name: /^Also open by .Bob, Carol, and Dan.$/ }),
    ).toBeVisible();

    additions.setViewer(KEY, 'Dan', false);
    await expect(editor.getByRole('img', { name: /^Also open by .Bob and Carol.$/ })).toBeVisible();

    // Closing the editor says so
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect
      .poll(() => additions.viewers.get(KEY)?.map(({ name }) => name))
      .toEqual(['Bob', 'Carol']);
  });

  test('pass to the user waiting in the editor once whoever was editing is done', async ({
    cms,
    page,
  }) => {
    await additions.addUser({ username: 'editor', password: 'editor password' });
    await cms.open();
    await signIn(page, 'editor', 'editor password');
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect.poll(() => additions.lockSockets.size).toBe(1);

    additions.setLock(KEY, 'Bob');
    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);

    await expect(editor.getByText(/Bob. has been editing this entry since/)).toBeVisible();

    // Bob closes the entry without anyone taking over: the user gets the lock before editing, so
    // others see them as the one editing it rather than a viewer
    additions.setLock(KEY, null);
    await expect.poll(() => additions.locks.get(KEY)?.name).toBe('Editor');
    await expect(editor.getByText(/has been editing this entry/)).toHaveCount(0);
    await expect(editor.getByRole('textbox', { name: 'Body' })).not.toHaveAttribute(
      'aria-readonly',
      'true',
    );
  });

  test('make the editor read-only when someone takes over', async ({ cms, page }) => {
    await additions.addUser({ username: 'editor', password: 'editor password' });
    await cms.open();
    await signIn(page, 'editor', 'editor password');

    const editor = await openFirstPost(page);

    await expect.poll(() => additions.locks.get(KEY)?.name).toBe('Editor');

    additions.setLock(KEY, 'Bob');
    await expect(editor.getByText(/Bob. took over this entry/)).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveAttribute(
      'aria-readonly',
      'true',
    );

    // Bob is done: the editor gets the lock back
    additions.setLock(KEY, null);
    await expect(editor.getByText(/took over this entry/)).toHaveCount(0);
    await expect.poll(() => additions.locks.get(KEY)?.name).toBe('Editor');
  });
});

test.describe('shared credentials', () => {
  // A bucket whose requests have to be signed with its secret access key
  test.use({
    config: {
      ...ADDITIONS_CONFIG,
      media_libraries: {
        aws_s3: {
          access_key_id: 'AKIAE2ETESTKEY000000',
          bucket: 'e2e-bucket',
          region: 'eu-west-3',
          prefix: 'uploads/',
        },
      },
    },
  });

  test('lets an admin share an API key, which everyone uses unless they enter their own', async ({
    cms,
    page,
  }) => {
    const s3 = new MockS3({
      bucket: 'e2e-bucket',
      region: 'eu-west-3',
      baseURL: 'https://e2e-bucket.s3.eu-west-3.amazonaws.com',
    });

    s3.put({ 'uploads/sunset.png': 'png' });
    await s3.install(page);
    await additions.addUser({ username: 'kohei', password: 'admin password', role: 'admin' });
    await additions.addUser({ username: 'editor', password: 'editor password' });
    await cms.open();
    await signIn(page, 'kohei', 'admin password');

    await page.getByRole('radio', { name: 'Administration' }).click();
    await page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('option', { name: 'Credentials' })
      .click();

    const services = page.getByRole('main', { name: 'Credentials' });

    await services.getByRole('textbox', { name: /Amazon S3. API Key/ }).fill(s3.secretAccessKey);
    await services.getByRole('button', { name: 'Save Credentials' }).click();
    await expect(services.getByRole('status')).toHaveText('The credentials have been saved.');
    expect(additions.credentials.api_keys).toEqual({ aws_s3: s3.secretAccessKey });

    // The editor browses the bucket without entering the key
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Account Menu' }),
      page.getByRole('menuitem', { name: 'Sign Out' }),
    );
    await signIn(page, 'editor', 'editor password');
    await page.getByRole('radio', { name: 'Assets' }).click();
    await page.getByRole('option', { name: /^Amazon S3/ }).click();
    await expect(page.getByRole('row', { name: 'sunset.png' })).toBeVisible();
    expect(s3.refused).toEqual([]);

    // Their own field says the admin’s key is used
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Account Menu' }),
      page.getByRole('menuitem', { name: 'Settings' }),
    );

    const settings = page.getByRole('dialog', { name: 'Settings' });

    await settings.getByRole('tab', { name: 'Media' }).click();
    await expect(settings.getByRole('textbox', { name: /Amazon S3. API Key/ })).toHaveAttribute(
      'placeholder',
      'Provided by your administrator',
    );
  });
});

test.describe('conversation', () => {
  const KEY = 'posts/first-post';

  test('shares comments on an entry between the CMS’s users as they write them', async ({
    cms,
    page,
  }) => {
    await additions.addUser({ username: 'editor', password: 'editor password' });
    additions.addComment(KEY, 'Bob', 'Can you check the **intro**?');
    await cms.open();
    await signIn(page, 'editor', 'editor password');

    const editor = await openFirstPost(page);
    const tabs = editor.getByRole('radiogroup', { name: 'Sidebar Panels' });

    // The tab shows how many comments there are
    await tabs.getByRole('radio', { name: /^.Conversation. \(1\)$/ }).click();

    const panel = editor.getByRole('group', { name: 'Conversation' });
    const timeline = panel.getByRole('log', { name: 'Comments' });

    await expect(timeline.getByRole('article')).toHaveCount(1);
    await expect(timeline.getByRole('article').first()).toContainText('Bob');
    await expect(timeline.locator('strong')).toHaveText('intro');

    // The comment is sent without saving the entry
    const textbox = panel.getByRole('textbox', { name: 'Comment' });

    await textbox.fill('Done, thanks!');
    await textbox.press('ControlOrMeta+Enter');
    await expect(timeline.getByRole('article')).toHaveCount(2);
    await expect(textbox).toHaveValue('');
    expect(additions.comments.map(({ body }) => body)).toEqual([
      'Can you check the **intro**?',
      'Done, thanks!',
    ]);
    await expect(tabs.getByRole('radio', { name: /^.Conversation. \(2\)$/ })).toBeVisible();

    // A comment written elsewhere shows up on its own
    additions.addComment(KEY, 'Bob', 'Great');
    await expect(timeline.getByRole('article')).toHaveCount(3);
    await expect(timeline.getByRole('article').last()).toContainText('Great');

    // The user’s own comment can be edited and deleted; Bob’s can’t
    const own = timeline.getByRole('article').nth(1);

    await expect(own).toContainText('You');
    await expect(
      timeline.getByRole('article').first().getByRole('button', { name: 'Comment Options' }),
    ).toHaveCount(0);
    await own.getByRole('button', { name: 'Comment Options' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await own.getByRole('textbox', { name: 'Comment' }).fill('Done, thank you!');
    await own.getByRole('button', { name: 'Save' }).click();
    await expect(own).toContainText('Done, thank you!');
    expect(additions.comments[1].body).toBe('Done, thank you!');

    await own.getByRole('button', { name: 'Comment Options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page
      .getByRole('alertdialog', { name: 'Delete' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(timeline.getByRole('article')).toHaveCount(2);
    expect(additions.comments.map(({ body }) => body)).toEqual([
      'Can you check the **intro**?',
      'Great',
    ]);
  });
});

test.describe('setup wizard', () => {
  test('creates the first admin and connects the service to GitHub', async ({ cms, page }) => {
    // GitHub creates and installs the app, then the service sends the browser back to the CMS
    /** @type {string | undefined} */
    let manifest;

    // The wizard looks up the repository owner from the browser, then the service doesn’t have to
    await page.route('https://api.github.com/users/*', (route) =>
      route.fulfill({ json: { login: 'sveltia', type: 'User' } }),
    );
    await page.route('https://github.com/settings/apps/new?*', (route) => {
      manifest = new URLSearchParams(route.request().postData() ?? '').get('manifest') ?? '';

      const returnURL = new URL(/** @type {string} */ (additions.setupReturnURL));

      returnURL.searchParams.set('additions_setup', 'ok');
      additions.githubApp = {
        slug: 'sveltia-cms-e2e-site',
        owner: 'sveltia',
        html_url: 'https://github.com/apps/sveltia-cms-e2e-site',
      };

      return route.fulfill({ status: 303, headers: { Location: returnURL.toString() } });
    });

    await cms.open();
    await page.getByRole('button', { name: 'Use Admin Secret' }).click();

    const wizard = page.getByRole('region', { name: 'Set Up Sveltia CMS Additions' });

    await wizard.getByLabel('Admin secret').fill('wrong secret');
    await wizard.getByRole('button', { name: 'Continue' }).click();
    await expect(wizard.getByRole('alert')).toHaveText('The admin secret is wrong.');

    await wizard.getByLabel('Admin secret').fill(additions.adminSecret);
    await wizard.getByRole('button', { name: 'Continue' }).click();

    await wizard.getByRole('textbox', { name: 'Username' }).fill('kohei');
    await wizard.getByLabel('New password', { exact: true }).fill('admin password 2026');
    await wizard.getByRole('button', { name: 'Create Admin' }).click();
    await expect(wizard.getByRole('status')).toContainText('The admin account is ready.');
    // The site the admin was created from may now use the service
    expect(additions.allowedDomains).toEqual([new URL(page.url()).hostname]);

    await wizard.getByRole('button', { name: 'Connect to GitHub' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'GitHub is connected. You can now sign in.' }),
    ).toBeVisible();
    expect(JSON.parse(/** @type {string} */ (manifest))).toEqual({ name: 'Sveltia CMS e2e-site' });
    expect(additions.setupOwnerType).toBe('User');
    // The outcome is taken out of the URL, so a reload doesn’t show it again
    expect(new URL(page.url()).searchParams.has('additions_setup')).toBe(false);

    await signIn(page, 'kohei', 'admin password 2026');
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  });

  test('resets the password of an admin who can’t sign in', async ({ cms, page }) => {
    await additions.addUser({ username: 'kohei', password: 'forgotten', role: 'admin' });
    await cms.open();
    await page.getByRole('button', { name: 'Use Admin Secret' }).click();

    const wizard = page.getByRole('region', { name: 'Set Up Sveltia CMS Additions' });

    await wizard.getByLabel('Admin secret').fill(additions.adminSecret);
    await wizard.getByRole('button', { name: 'Continue' }).click();
    await expect(wizard.getByText('An admin account exists.')).toBeVisible();
    await wizard.getByRole('button', { name: 'Reset Admin Password' }).click();
    await expect(wizard.getByText(/An admin account already exists/)).toBeVisible();

    await wizard.getByRole('textbox', { name: 'Username' }).fill('kohei');
    await wizard.getByLabel('New password', { exact: true }).fill('a new admin password');
    await wizard.getByRole('button', { name: 'Save Admin' }).click();
    await expect(wizard.getByRole('status')).toContainText('The admin account is ready.');

    await wizard.getByRole('button', { name: 'Back to Sign In' }).click();
    await signIn(page, 'kohei', 'a new admin password');
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  });

  test('adds and deletes the other sites the service serves', async ({ cms, page }) => {
    additions.tenants = [];
    await cms.open();
    await page.getByRole('button', { name: 'Use Admin Secret' }).click();

    const wizard = page.getByRole('region', { name: 'Set Up Sveltia CMS Additions' });

    await wizard.getByLabel('Admin secret').fill(additions.adminSecret);
    await wizard.getByRole('button', { name: 'Continue' }).click();

    await wizard.getByRole('button', { name: 'Manage Other Sites' }).click();

    const sites = wizard.getByRole('group', { name: 'Other Sites' });

    await expect(sites.getByText('There are no other sites yet.')).toBeVisible();
    await sites.getByRole('textbox', { name: 'Site ID' }).fill('acme');
    await sites.getByRole('textbox', { name: 'Name (optional)' }).fill('Acme Inc.');
    await sites.getByRole('button', { name: 'Add Site' }).click();
    // The copy buttons have a status of their own, announcing a copy
    await expect(sites.getByRole('status').filter({ hasText: 'has been added' })).toBeVisible();
    await expect(sites.getByRole('listitem')).toContainText('/t/acme');

    // An ID that’s taken is refused with the service’s reason
    await sites.getByRole('textbox', { name: 'Site ID' }).fill('acme');
    await sites.getByRole('button', { name: 'Add Site' }).click();
    await expect(wizard.getByRole('alert')).toHaveText('A site with this ID already exists.');

    await sites.getByRole('button', { name: /Delete .*Acme Inc\./ }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Site' });

    await dialog.getByRole('textbox', { name: 'Site ID to confirm' }).fill('acme');
    await dialog.getByRole('button', { name: 'Delete Site' }).click();
    await expect(sites.getByText('There are no other sites yet.')).toBeVisible();
    expect(additions.tenants).toEqual([]);
  });

  test('offers no sites where the service doesn’t serve others', async ({ cms, page }) => {
    await cms.open();
    await page.getByRole('button', { name: 'Use Admin Secret' }).click();

    const wizard = page.getByRole('region', { name: 'Set Up Sveltia CMS Additions' });

    await wizard.getByLabel('Admin secret').fill(additions.adminSecret);

    // The steps show once unlocked, before the sites are listed, so wait for the service’s answer
    // and the frame drawn after it, or the button could still be on its way
    const listed = page.waitForResponse(`${ADDITIONS_URL}/v1/tenants`);

    await wizard.getByRole('button', { name: 'Continue' }).click();
    expect((await listed).status()).toBe(404);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(resolve);
        }),
    );
    await expect(wizard.getByRole('heading', { name: 'Admin Account' })).toBeVisible();
    await expect(wizard.getByRole('button', { name: 'Manage Other Sites' })).toHaveCount(0);
    await expect(wizard.getByRole('alert')).toHaveCount(0);
  });
});

test('fills in the sign-in form from the magic link emailed with a temporary password', async ({
  cms,
  page,
}) => {
  await additions.addUser({
    username: 'editor',
    password: 'kq7m-x2pd-9vbt-h4wn',
    mustChangePassword: true,
  });
  await cms.open();

  // The link the Temporary Password dialog puts in the email, read when the CMS starts
  const encoded = Buffer.from(
    JSON.stringify({ username: 'editor', password: 'kq7m-x2pd-9vbt-h4wn' }),
  ).toString('base64url');

  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, `#/signin/${encoded}`);
  await page.reload();

  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('editor');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('kq7m-x2pd-9vbt-h4wn');
  // The details are taken out of the address
  expect(new URL(page.url()).hash).not.toContain('signin');

  // The user still signs in, then chooses their own password
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose a New Password' })).toBeVisible();
});

test.describe('Administration', () => {
  test('lets an admin add a user, who then signs in with the temporary password', async ({
    cms,
    page,
  }) => {
    await additions.addUser({ username: 'kohei', password: 'admin password', role: 'admin' });
    await cms.open();
    await signIn(page, 'kohei', 'admin password');
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

    // The page opens on its first section
    await page.getByRole('radio', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/#\/admin\/users$/);
    await expect(page.getByRole('table', { name: 'Users' }).getByRole('row')).toHaveCount(2);

    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('editor');
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Ed Itor');
    await dialog.getByRole('button', { name: 'Add' }).click();

    const passwordDialog = page.getByRole('alertdialog', { name: 'Temporary Password' });

    // The username comes first, then the password, each in a row of its own
    await expect(passwordDialog.locator('dd code').first()).toHaveText('editor');

    const password = /** @type {string} */ (
      await passwordDialog.locator('dd code').nth(1).textContent()
    );

    expect(password).toMatch(/^[a-z2-9]{4}(?:-[a-z2-9]{4}){3}$/);
    await passwordDialog.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('table', { name: 'Users' }).getByRole('row')).toHaveCount(3);

    // The new user signs in with the password they were given, and has to change it
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Account Menu' }),
      page.getByRole('menuitem', { name: 'Sign Out' }),
    );
    await signIn(page, 'editor', password);
    await expect(page.getByRole('heading', { name: 'Choose a New Password' })).toBeVisible();
  });

  test('replaces the private key of the GitHub App lost with the data key', async ({
    cms,
    page,
  }) => {
    await additions.addUser({ username: 'kohei', password: 'admin password', role: 'admin' });
    await cms.open();
    await signIn(page, 'kohei', 'admin password');
    await page.getByRole('radio', { name: 'Administration' }).click();
    await page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('option', { name: 'GitHub' })
      .click();

    const panel = page.getByRole('main', { name: 'GitHub' });

    await expect(panel.getByText(/private key was lost/)).toBeVisible();

    const chooser = page.waitForEvent('filechooser');

    await panel.getByRole('button', { name: 'Upload Private Key' }).click();
    await (
      await chooser
    ).setFiles({
      name: 'app.private-key.pem',
      mimeType: 'application/x-pem-file',
      buffer: Buffer.from('-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----\n'),
    });

    await expect(panel.getByRole('status')).toHaveText('The private key has been replaced.');
    await expect(panel.getByText('The app works.')).toBeVisible();
    await expect(panel.getByText(/No ruleset protects the .+main.+ branch/)).toBeVisible();
    expect(additions.githubPrivateKey).toMatch(/^-----BEGIN RSA PRIVATE KEY-----/);
  });

  test('lets an admin make the app the author, with the person as co-author', async ({
    cms,
    github,
    page,
  }) => {
    await additions.addUser({ username: 'kohei', password: 'admin password', role: 'admin' });
    await cms.open();
    await signIn(page, 'kohei', 'admin password');
    await page.getByRole('radio', { name: 'Administration' }).click();
    await page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('option', { name: 'GitHub' })
      .click();

    const panel = page.getByRole('main', { name: 'GitHub' });

    await panel
      .getByRole('radio', { name: 'The GitHub App, with the person as co-author' })
      .click();
    await expect(panel.getByRole('status')).toHaveText('The commit author has been saved.');
    expect(additions.commitAuthor).toBe('bot');

    await page.goto(`${new URL(page.url()).pathname}#/collections/posts`);

    const editor = await openFirstPost(page);

    await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Kohei!');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(() => github.readFile('content/posts/first-post.md'))
      .toBe('---\ntitle: First Post\n---\n\nHello from Kohei!\n');
    expect(github.received.at(-1)?.message).toEqual({
      headline: expect.any(String),
      body: 'Co-authored-by: Kohei <kohei@users.noreply.additions.example>',
    });
  });

  test('aren’t offered to an editor', async ({ cms, page }) => {
    await additions.addUser({ username: 'editor', password: 'editor password' });
    await cms.open();
    await signIn(page, 'editor', 'editor password');

    await expect(page.getByRole('radio', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Administration' })).toHaveCount(0);

    // Nor is the page there for a link
    await page.goto(`${new URL(page.url()).pathname}#/admin/users`);
    await expect(page.getByRole('group', { name: 'Page not found.' })).toBeVisible();
  });
});
