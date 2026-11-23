import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  additionsUsers,
  createUser,
  deleteUser,
  loadUsers,
  resetPassword,
  signOutUser,
  updateUser,
} from '$lib/services/additions/users.svelte';
import { user } from '$lib/services/user/account.svelte';

import UsersPanel from './users-panel.svelte';

// The page talks to Sveltia CMS Additions; the state and the helpers are real, the requests aren’t
vi.mock('$lib/services/additions/users.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  loadUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  resetPassword: vi.fn(),
  signOutUser: vi.fn(),
  deleteUser: vi.fn(),
}));

const USERS = [
  {
    id: 'u1',
    username: 'admin',
    name: 'Ada Admin',
    email: null,
    role: 'admin',
    disabled: false,
    must_change_password: false,
    created_at: '2026-10-01T00:00:00Z',
    last_sign_in_at: '2026-10-12T09:30:00Z',
  },
  {
    id: 'u2',
    username: 'editor',
    name: 'Ed Itor',
    email: null,
    role: 'editor',
    disabled: false,
    must_change_password: true,
    created_at: '2026-10-02T00:00:00Z',
    last_sign_in_at: null,
  },
];

/**
 * Open the options menu of a user.
 * @param {string} name User’s name.
 * @returns {Promise<import('vitest/browser').Locator>} Menu.
 */
const openOptions = async (name) => {
  await page.getByRole('button', { name: `Show Options for \u2068${name}\u2069` }).click();

  const menu = page.getByRole('menu', { name: 'User Options' });

  await expect.element(menu).toBeVisible();

  return menu;
};

describe('UsersPanel', () => {
  // The table is wider than a phone screen; scrolling to an item in a menu would close the menu
  beforeAll(async () => {
    await page.viewport(1024, 768);
  });

  afterAll(async () => {
    await page.viewport(414, 896);
  });

  beforeEach(() => {
    user.account = { backendName: 'github', login: 'admin', role: 'admin' };
    vi.mocked(loadUsers).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        users: structuredClone(USERS),
        allowedDomains: ['cms.example', '*.example.org'],
        loaded: true,
      });
    });
    Object.assign(additionsUsers, {
      users: [],
      allowedDomains: [],
      signInMethods: { github: false },
      signUpRules: [],
      update: undefined,
      loaded: false,
    });
  });

  test('lists the users with their role, status and last sign-in', async () => {
    await render(UsersPanel, { title: 'Users' });

    const rows = page.getByRole('table', { name: 'Users' }).getByRole('row');

    await expect.element(rows.nth(1)).toMatchTextContent(/admin\s*Ada Admin\s*\(you\)/);
    await expect.element(rows.nth(1)).toMatchTextContent(/Active/);
    await expect.element(rows.nth(2)).toMatchTextContent(/editor\s*Ed Itor/);
    await expect.element(rows.nth(2)).toMatchTextContent(/Temporary password\s*Never/);
    // The role is shown as text, and changed in the Edit User dialog
    await expect.element(rows.nth(2)).toMatchTextContent(/Ed Itor\s*Editor/);
    expect(page.getByRole('table').getByRole('combobox').elements()).toHaveLength(0);
  });

  test('shows why the users couldn’t be loaded', async () => {
    vi.mocked(loadUsers).mockRejectedValue(
      new Error('Forbidden', { cause: { message: 'Only admins can do this.' } }),
    );

    await render(UsersPanel, { title: 'Users' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Only admins can do this.');
    await expect
      .element(page.getByRole('button', { name: 'Add User' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('adds a user and shows the temporary password once', async () => {
    vi.mocked(createUser).mockResolvedValue('kq7m-x2pd-9vbt-h4wn');

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await expect
      .element(dialog.getByRole('button', { name: 'Add' }))
      .toHaveAttribute('aria-disabled', 'true');
    // In the order of the table’s columns
    expect(
      dialog
        .getByRole('textbox')
        .elements()
        .map((input) => input.getAttribute('aria-label')),
    ).toEqual(['Username', 'Name', 'Email (optional)']);
    // The email says what it’s for
    await expect
      .element(dialog.getByRole('textbox', { name: 'Email (optional)' }))
      .toHaveAccessibleDescription(/used in the commits this person makes/);
    await dialog.getByRole('textbox', { name: 'Username' }).fill(' Viewer ');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Vi Ewer');
    await dialog.getByRole('textbox', { name: 'Email (optional)' }).fill(' vi@example.com ');
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Viewer' }).click();
    await dialog.getByRole('button', { name: 'Add' }).click();

    await vi.waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        username: 'viewer',
        name: 'Vi Ewer',
        email: 'vi@example.com',
        role: 'viewer',
      }),
    );

    const passwordDialog = page.getByRole('alertdialog', { name: 'Temporary Password' });

    await expect.element(passwordDialog).toMatchTextContent(/kq7m-x2pd-9vbt-h4wn/);
    await expect
      .element(passwordDialog)
      .toMatchTextContent(/Give this username and temporary password to \u2068Vi Ewer\u2069/);

    // The username to give along with the password, in a row of its own
    /**
     * Get the text of the given parts of the credential rows.
     * @param {string} selector Selector.
     * @returns {(string | null | undefined)[]} Texts.
     */
    const getCredentialTexts = (selector) =>
      [...passwordDialog.element().querySelectorAll(`.credentials ${selector}`)].map((element) =>
        element.textContent?.trim(),
      );

    expect(getCredentialTexts('dt')).toEqual(['Username', 'Password']);
    expect(getCredentialTexts('dd code')).toEqual(['viewer', 'kq7m-x2pd-9vbt-h4wn']);
    await passwordDialog.getByRole('button', { name: 'OK' }).click();
    await expect.element(passwordDialog).not.toBeInTheDocument();
  });

  test('changes a user’s role in the Edit User dialog', async () => {
    await render(UsersPanel, { title: 'Users' });
    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Edit User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit User' });

    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Viewer' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { role: 'viewer' }));
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test('keeps the Add User dialog open with what was entered when the service refuses it', async () => {
    vi.mocked(createUser)
      .mockRejectedValueOnce(
        new Error('Conflict', { cause: { message: 'That username is already taken.' } }),
      )
      .mockResolvedValueOnce('kq7m-x2pd-9vbt-h4wn');

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('editor');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Vi Ewer');
    await dialog.getByRole('button', { name: 'Add' }).click();

    // Shown in the dialog, not behind it
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent('That username is already taken.');
    await expect.element(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Vi Ewer');
    expect(page.getByRole('alertdialog', { name: 'Temporary Password' }).elements()).toHaveLength(
      0,
    );

    // Corrected, it goes through, and the password is shown once the dialog has closed
    await dialog.getByRole('textbox', { name: 'Username' }).fill('viewer');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect
      .element(page.getByRole('alertdialog', { name: 'Temporary Password' }))
      .toMatchTextContent(/kq7m-x2pd-9vbt-h4wn/);
    await expect.element(dialog).not.toBeInTheDocument();

    // The error is gone the next time
    await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
    await page.getByRole('button', { name: 'Add User' }).click();
    await expect.element(dialog).toBeVisible();
    expect(dialog.getByRole('alert').elements()).toHaveLength(0);
  });

  test('shows the temporary password even if the Add User dialog is closed while saving', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(createUser).mockReturnValue(/** @type {Promise<string>} */ (promise));

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('viewer');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Vi Ewer');
    await dialog.getByRole('button', { name: 'Add' }).click();
    // Cancel waits for the save, but Escape doesn’t
    await expect
      .element(dialog.getByRole('button', { name: 'Cancel' }))
      .toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();

    resolve('kq7m-x2pd-9vbt-h4wn');
    await expect
      .element(page.getByRole('alertdialog', { name: 'Temporary Password' }))
      .toMatchTextContent(/kq7m-x2pd-9vbt-h4wn/);
  });

  test('leaves the page once the admin has given up the role', async () => {
    vi.mocked(updateUser).mockImplementation(async () => {
      user.account = { .../** @type {any} */ (user.account), role: 'editor' };
    });
    window.location.hash = '#/admin/users';

    await render(UsersPanel, { title: 'Users' });
    await (await openOptions('Ada Admin')).getByRole('menuitem', { name: 'Edit User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit User' });

    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Editor' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections');
    window.location.hash = '';
  });

  test('keeps the Edit User dialog open with the changes when the service refuses them', async () => {
    vi.mocked(updateUser).mockRejectedValueOnce(
      new Error('Conflict', { cause: { message: 'Keep at least one admin.' } }),
    );

    await render(UsersPanel, { title: 'Users' });
    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Edit User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit User' });

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Ed Iting');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect.element(dialog.getByRole('alert')).toHaveTextContent('Keep at least one admin.');
    await expect.element(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Ed Iting');
    expect(updateUser).toHaveBeenCalledWith('u2', { name: 'Ed Iting' });
  });

  test('resets a password after asking, and shows the new one', async () => {
    vi.mocked(resetPassword).mockResolvedValue('aaaa-bbbb-cccc-dddd');

    await render(UsersPanel, { title: 'Users' });

    const menu = await openOptions('Ed Itor');

    await menu.getByRole('menuitem', { name: 'Reset Password' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Reset Password' });

    await expect.element(dialog).toMatchTextContent(/new temporary password/);
    await dialog.getByRole('button', { name: 'Reset Password' }).click();

    await vi.waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith(expect.objectContaining({ id: 'u2' })),
    );
    await expect
      .element(page.getByRole('alertdialog', { name: 'Temporary Password' }))
      .toMatchTextContent(/aaaa-bbbb-cccc-dddd/);
    await expect
      .element(page.getByRole('alertdialog', { name: 'Temporary Password' }))
      .toMatchTextContent(/to \u2068Ed Itor\u2069/);
  });

  test('signs a user out, disables and deletes them', async () => {
    await render(UsersPanel, { title: 'Users' });

    await (
      await openOptions('Ed Itor')
    )
      .getByRole('menuitem', { name: 'Sign Out Everywhere' })
      .click();
    await vi.waitFor(() => expect(signOutUser).toHaveBeenCalledWith('u2'));

    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Disable User' }).click();
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { disabled: true }));

    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Delete User' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete User' });

    await expect.element(dialog).toMatchTextContent(/Delete \u2068Ed Itor\u2069\?/);
    await dialog.getByRole('button', { name: 'Delete User' }).click();
    await vi.waitFor(() => expect(deleteUser).toHaveBeenCalledWith('u2'));
  });

  test('enables a disabled user, and keeps the admin from disabling or deleting themselves', async () => {
    vi.mocked(loadUsers).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        users: [USERS[0], { ...USERS[1], disabled: true }],
        allowedDomains: [],
        loaded: true,
      });
    });

    await render(UsersPanel, { title: 'Users' });

    await expect
      .element(page.getByRole('table', { name: 'Users' }).getByRole('row').nth(2))
      .toMatchTextContent(/Disabled/);
    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Enable User' }).click();
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { disabled: false }));

    const menu = await openOptions('Ada Admin');

    // The admin’s own account is changed elsewhere: the password in the account menu, the
    // sessions with Sign Out
    await expect.element(menu.getByRole('menuitem', { name: 'Reset Password' })).toBeDisabled();
    await expect
      .element(menu.getByRole('menuitem', { name: 'Sign Out Everywhere' }))
      .toBeDisabled();
    await expect.element(menu.getByRole('menuitem', { name: 'Disable User' })).toBeDisabled();
    await expect.element(menu.getByRole('menuitem', { name: 'Delete User' })).toBeDisabled();
  });

  test('shows a generic message for an error without one', async () => {
    vi.mocked(loadUsers).mockRejectedValue(new Error('Network'));

    await render(UsersPanel, { title: 'Users' });

    await expect.element(page.getByRole('alert')).toMatchTextContent(/unexpected error/);
  });

  test('marks nobody as the current user when signed out', async () => {
    user.account = undefined;

    await render(UsersPanel, { title: 'Users' });

    await expect
      .element(page.getByRole('table', { name: 'Users' }).getByRole('row').nth(1))
      .toMatchTextContent(/Ada Admin/);
    expect(page.getByText('(you)').elements()).toHaveLength(0);
  });

  test('copies the temporary password', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    vi.mocked(createUser).mockResolvedValue('kq7m-x2pd-9vbt-h4wn');

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('viewer');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Vi Ewer');
    await dialog.getByRole('button', { name: 'Add' }).click();

    const passwordDialog = page.getByRole('alertdialog', { name: 'Temporary Password' });

    await passwordDialog.getByRole('button', { name: 'Copy Username' }).click();
    expect(writeText).toHaveBeenLastCalledWith('viewer');
    await passwordDialog.getByRole('button', { name: 'Copy Password' }).click();
    expect(writeText).toHaveBeenLastCalledWith('kq7m-x2pd-9vbt-h4wn');
    expect(passwordDialog.getByRole('alert').elements()).toHaveLength(0);
    writeText.mockRestore();
  });

  test('says when the clipboard refuses the temporary password', async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new Error('Denied'))
      .mockResolvedValue();

    vi.mocked(createUser).mockResolvedValue('kq7m-x2pd-9vbt-h4wn');

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('viewer');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Vi Ewer');
    await dialog.getByRole('button', { name: 'Add' }).click();

    const passwordDialog = page.getByRole('alertdialog', { name: 'Temporary Password' });

    await passwordDialog.getByRole('button', { name: 'Copy Password' }).click();
    await expect
      .element(passwordDialog.getByRole('alert'))
      .toHaveTextContent('Couldn’t copy to clipboard.');
    // A copy that works clears the message
    await passwordDialog.getByRole('button', { name: 'Copy Password' }).click();
    await expect.element(passwordDialog.getByRole('alert')).not.toBeInTheDocument();
    // Closing the dialog forgets it too
    await passwordDialog.getByRole('button', { name: 'OK' }).click();
    writeText.mockRestore();
  });

  test('adds a user who signs in with GitHub, without a temporary password', async () => {
    vi.mocked(createUser).mockResolvedValue('');
    vi.mocked(loadUsers).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        users: structuredClone(USERS),
        signInMethods: { github: true },
        loaded: true,
      });
    });

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('mona');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Mona');
    await expect
      .element(dialog.getByRole('textbox', { name: 'GitHub username (optional)' }))
      .toHaveAccessibleDescription(/signs in with that GitHub account/);
    await dialog.getByRole('textbox', { name: 'GitHub username (optional)' }).fill(' octocat ');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await vi.waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ github: 'octocat' })),
    );
    expect(page.getByRole('alertdialog', { name: 'Temporary Password' }).elements()).toHaveLength(
      0,
    );
  });

  test('shows a user waiting for their first GitHub sign-in, and adopts a rule member', async () => {
    vi.mocked(loadUsers).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        users: [
          { ...USERS[0], sign_in_methods: ['password'], github: null },
          {
            ...USERS[1],
            must_change_password: false,
            sign_in_methods: ['github'],
            github: { login: 'octocat', waiting_for_sign_in: true },
            sign_up_rule: 'rule-1',
          },
        ],
        loaded: true,
      });
    });

    await render(UsersPanel, { title: 'Users' });

    await expect
      .element(page.getByRole('table', { name: 'Users' }).getByRole('row').nth(2))
      .toMatchTextContent(/GitHub \(.octocat.\)\s*Waiting for first sign-in/);
    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Adopt Account' }).click();
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { adopted: true }));
    await expect
      .element(page.getByRole('table', { name: 'Users' }).getByRole('row').nth(1))
      .toMatchTextContent(/Password\s*Active/);
    // Only a rule member can be adopted
    expect(
      (await openOptions('Ada Admin')).getByRole('menuitem', { name: 'Adopt Account' }).elements(),
    ).toHaveLength(0);
  });

  test('edits a user, sending only what has changed', async () => {
    await render(UsersPanel, { title: 'Users' });

    const menu = await openOptions('Ed Itor');

    await menu.getByRole('menuitem', { name: 'Edit User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit User' });
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    const username = dialog.getByRole('textbox', { name: 'Username' });

    // Filled in, with the username read-only
    await expect.element(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Ed Itor');
    await expect.element(username).toHaveValue('editor');
    await expect.element(username).toHaveAttribute('aria-readonly', 'true');
    await expect.element(username).toHaveAccessibleDescription(/can’t be changed/);
    // GitHub sign-in is off and the user has no GitHub account, so it isn’t offered
    expect(
      dialog.getByRole('textbox', { name: 'GitHub username (optional)' }).elements(),
    ).toHaveLength(0);
    // Nothing to save yet
    await expect.element(saveButton).toHaveAttribute('aria-disabled', 'true');

    await dialog.getByRole('textbox', { name: 'Name' }).fill(' Edwina Itor ');
    await dialog.getByRole('textbox', { name: 'Email (optional)' }).fill('ed@example.com');
    await saveButton.click();

    await vi.waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('u2', {
        name: 'Edwina Itor',
        email: 'ed@example.com',
      }),
    );
  });

  test('doesn’t save a user without a name', async () => {
    await render(UsersPanel, { title: 'Users' });
    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Edit User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit User' });

    await dialog.getByRole('textbox', { name: 'Name' }).fill(' ');
    await expect
      .element(dialog.getByRole('button', { name: 'Save' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('keeps a user who can only sign in with GitHub from losing their GitHub account', async () => {
    vi.mocked(loadUsers).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        users: [
          ...structuredClone(USERS),
          {
            ...structuredClone(USERS[1]),
            id: 'u3',
            username: 'mona',
            name: 'Mona',
            must_change_password: false,
            sign_in_methods: ['github'],
            github: { login: 'octocat', waiting_for_sign_in: false },
          },
        ],
        loaded: true,
      });
    });

    await render(UsersPanel, { title: 'Users' });
    await (await openOptions('Mona')).getByRole('menuitem', { name: 'Edit User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit User' });
    // Offered although GitHub sign-in is off, as the user has an account to remove
    const github = dialog.getByRole('textbox', { name: 'GitHub username (optional)' });
    const saveButton = dialog.getByRole('button', { name: 'Save' });

    await expect.element(github).toHaveValue('octocat');
    await github.fill('');
    await expect.element(github).toHaveAttribute('aria-invalid', 'true');
    await expect.element(github).toHaveAccessibleDescription(/can only sign in with GitHub/);
    await expect.element(saveButton).toHaveAttribute('aria-disabled', 'true');

    // Another GitHub account is fine
    await github.fill('hubot');
    await expect.element(github).toHaveAccessibleDescription(/signs in with that GitHub account/);
    await saveButton.click();
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith('u3', { github: 'hubot' }));
  });

  test('opens an email with the sign-in details for a user with an email', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    vi.mocked(createUser).mockResolvedValue('kq7m-x2pd-9vbt-h4wn');

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('viewer');
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Vi Ewer');
    await dialog.getByRole('textbox', { name: 'Email (optional)' }).fill('vi@example.com');
    await dialog.getByRole('button', { name: 'Add' }).click();

    const passwordDialog = page.getByRole('alertdialog', { name: 'Temporary Password' });

    await passwordDialog.getByRole('button', { name: 'Email to \u2068Vi Ewer\u2069' }).click();

    expect(open).toHaveBeenCalledOnce();

    const [href, target] = open.mock.calls[0];
    const url = new URL(/** @type {string} */ (href));
    const body = /** @type {string} */ (url.searchParams.get('body'));

    expect(target).toBe('_self');
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('vi@example.com');
    expect(url.searchParams.get('subject')).toBe('Your sign-in details for Sveltia CMS');
    // Line by line, as the email app shows it
    expect(body.split('\r\n')).toEqual([
      'Hello Vi Ewer,',
      '',
      'You can now sign in to Sveltia CMS. Open the link below, which fills in your username and ' +
        'temporary password, and choose your own password when you sign in.',
      '',
      expect.stringMatching(
        new RegExp(`^Sign-in link: ${window.location.origin}${window.location.pathname}#/signin/`),
      ),
      'Username: viewer',
      'Temporary password: kq7m-x2pd-9vbt-h4wn',
    ]);
    open.mockRestore();
  });

  test('offers no email for a user without an email', async () => {
    vi.mocked(createUser).mockResolvedValue('kq7m-x2pd-9vbt-h4wn');

    await render(UsersPanel, { title: 'Users' });
    await page.getByRole('button', { name: 'Add User' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add User' });

    await dialog.getByRole('textbox', { name: 'Username' }).fill('viewer');
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Vi Ewer');
    await dialog.getByRole('button', { name: 'Add' }).click();

    const passwordDialog = page.getByRole('alertdialog', { name: 'Temporary Password' });

    await expect.element(passwordDialog).toBeVisible();
    expect(passwordDialog.getByRole('button', { name: /^Email to/ }).elements()).toHaveLength(0);
  });

  test('opens another email after resetting a password', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    vi.mocked(loadUsers).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        users: structuredClone(USERS).map((target) =>
          target.id === 'u2' ? { ...target, email: 'ed@example.com' } : target,
        ),
        loaded: true,
      });
    });
    vi.mocked(resetPassword).mockResolvedValue('aaaa-bbbb-cccc-dddd');

    await render(UsersPanel, { title: 'Users' });
    await (await openOptions('Ed Itor')).getByRole('menuitem', { name: 'Reset Password' }).click();
    await page
      .getByRole('alertdialog', { name: 'Reset Password' })
      .getByRole('button', { name: 'Reset Password' })
      .click();
    await page
      .getByRole('alertdialog', { name: 'Temporary Password' })
      .getByRole('button', { name: 'Email to \u2068Ed Itor\u2069' })
      .click();

    const url = new URL(/** @type {string} */ (open.mock.calls[0][0]));

    expect(url.pathname).toBe('ed@example.com');
    expect(url.searchParams.get('subject')).toBe('Your password for Sveltia CMS has been reset');
    expect(url.searchParams.get('body')?.split('\r\n')[2]).toMatch(
      /^Your password for Sveltia CMS has been reset, and/,
    );
    expect(url.searchParams.get('body')).toContain('\r\nTemporary password: aaaa-bbbb-cccc-dddd');
    open.mockRestore();
  });
});
