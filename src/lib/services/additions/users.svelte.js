import { getSiteId } from '$lib/services/additions/auth.svelte';
import { derivePrehash } from '$lib/services/additions/kdf';
import { fetchWithSession } from '$lib/services/additions/session-api';
import { generatePassword } from '$lib/services/additions/user-form';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import { UserChanges } from '$lib/services/additions/user-form';
 */

/**
 * A user as the Sveltia CMS Additions API returns it.
 * @typedef {object} AdditionsUser
 * @property {string} id ID.
 * @property {string} username Username.
 * @property {string} name Display name.
 * @property {string | null} email Email.
 * @property {'admin' | 'editor' | 'viewer'} role Role.
 * @property {boolean} disabled Whether the user is disabled.
 * @property {boolean} must_change_password Whether the user still has a temporary password.
 * @property {string} created_at Creation date.
 * @property {string | null} [last_sign_in_at] Last sign-in date.
 * @property {number} [pending_token_revocations] GitHub tokens still to be revoked.
 * @property {string[]} [sign_in_methods] How the user can sign in: `password`, `github`.
 * @property {{ login: string, waiting_for_sign_in: boolean } | null} [github] GitHub account the
 * user signs in with, and whether they haven’t yet.
 * @property {string | null} [sign_up_rule] ID of the sign-up rule that created the user, until an
 * admin adopts them.
 */

/**
 * A rule that creates an account for a GitHub organization member who signs in without one.
 * @typedef {object} SignUpRule
 * @property {string} [id] ID, given by the service.
 * @property {'github_org'} type Type.
 * @property {string} org Organization.
 * @property {'editor' | 'viewer'} role Role of the accounts it creates.
 */

/**
 * GitHub settings and their state, as the API checks them with GitHub.
 * @typedef {object} AdditionsGitHubStatus
 * @property {'not_registered' | 'key_missing' | 'key_rejected' | 'not_installed' | 'suspended' |
 * 'unreachable' | 'ok'} status Connection state.
 * @property {{ id: number, slug: string, owner: string, html_url: string, settings_url: string }
 * | null} app Registered app.
 * @property {{ owner: string, name: string } | null} installation Repository the app is installed
 * on.
 * @property {{ name: string, protection: 'protected' | 'bypassed' | 'unprotected' } | null}
 * default_branch Default branch and whether rulesets protect it from force pushes and deletion.
 */

/**
 * State of the Users page.
 */
export const additionsUsers = $state({
  /** @type {AdditionsUser[]} */
  users: [],
  /** @type {string[]} */
  allowedDomains: [],
  /**
   * Who appears as the author of the commits: the person, or the app with the person as co-author.
   * @type {'user' | 'bot'}
   */
  commitAuthor: 'user',
  /** Sign-in methods besides the password. */
  signInMethods: { github: false },
  /** @type {SignUpRule[]} */
  signUpRules: [],
  /**
   * Newer release of the service, if there is one.
   * @type {{ current: string, latest: string } | undefined}
   */
  update: undefined,
  /** Whether the settings have been loaded, which are edited from a copy of them. */
  loaded: false,
  /** @type {AdditionsGitHubStatus | undefined} */
  github: undefined,
});

/**
 * Derive the prehash of a password for a user, which is all the service ever sees of it.
 * @param {string} username Username.
 * @param {string} password Password.
 * @returns {Promise<string>} Prehash.
 */
const getPrehash = async (username, password) =>
  derivePrehash({ siteId: await getSiteId(), username, password });

/**
 * Load the site settings: the allowed domains, the commit author, the sign-in methods and the
 * sign-up rules.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request, e.g. because the user isn’t an admin.
 */
export const loadSiteSettings = async () => {
  const settings = await fetchWithSession('/v1/settings');

  // An older release of the service lacks the newer settings; the CMS is updated on its own, and
  // may run ahead of it
  Object.assign(additionsUsers, {
    allowedDomains: settings.allowed_domains ?? [],
    commitAuthor: settings.commit_author ?? 'user',
    signInMethods: settings.sign_in_methods ?? { github: false },
    signUpRules: settings.sign_up_rules ?? [],
    loaded: true,
  });
};

/**
 * Load the users and the site settings, which the Users section needs to add and edit users.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request, e.g. because the user isn’t an admin.
 */
export const loadUsers = async () => {
  const [{ users }] = await Promise.all([fetchWithSession('/v1/users'), loadSiteSettings()]);

  additionsUsers.users = users;
};

/**
 * Load the users again after a change, whether it succeeded or not, so the page shows what the
 * service has, e.g. the previous role after a refused change.
 * @returns {Promise<void>}
 */
const refreshUsers = async () => {
  additionsUsers.users = (await fetchWithSession('/v1/users')).users;
};

/**
 * Run a change, then load the users again, even if the change failed. Whether the change worked is
 * what’s reported: the list failing to load afterwards doesn’t make it fail, nor replace its error.
 * An admin who has just given up the role can’t list the users any more, so it isn’t tried.
 * @param {() => Promise<void>} change Change.
 * @returns {Promise<void>}
 */
const changeUsers = async (change) => {
  try {
    await change();
  } finally {
    if (user.account?.role === 'admin') {
      try {
        await refreshUsers();
      } catch {
        // The list shows what it had; the next change or visit loads it again
      }
    }
  }
};

/**
 * Create a user, who signs in with a generated temporary password, or with the GitHub account the
 * admin names.
 * @param {object} args Arguments.
 * @param {string} args.username Username.
 * @param {string} args.name Display name.
 * @param {string} [args.email] Email.
 * @param {'admin' | 'editor' | 'viewer'} args.role Role.
 * @param {string} [args.github] GitHub username. The user then signs in with that GitHub account
 * instead of a password.
 * @returns {Promise<string>} Temporary password, which the admin passes on to the user, or an empty
 * string for a GitHub user. It’s shown once and never stored.
 * @throws {Error} When the service refuses the request, e.g. because the username is taken.
 */
export const createUser = async ({ username, name, email, role, github }) => {
  const password = github ? '' : generatePassword();

  await changeUsers(async () => {
    await fetchWithSession('/v1/users', {
      method: 'POST',
      body: {
        username,
        name,
        email: email || null,
        role,
        ...(github ? { github } : { prehash: await getPrehash(username, password) }),
      },
    });
  });

  return password;
};

/**
 * Change a user’s name, email, role, GitHub account or status. Changing the role or disabling
 * the user revokes their GitHub tokens on the service.
 * @param {string} id User ID.
 * @param {UserChanges & { disabled?: boolean, adopted?: boolean }} changes Changes. `adopted`
 * stops checking a user created by a sign-up rule against it.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the change, e.g. for the last admin.
 */
export const updateUser = async (id, changes) => {
  const isSelf =
    additionsUsers.users.find((target) => target.id === id)?.username === user.account?.login;

  await changeUsers(async () => {
    await fetchWithSession(`/v1/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: changes,
    });

    // An admin who changes their own details sees the change straight away, e.g. losing this page
    // with another role, or the new name in the account menu and the Account settings panel
    if (isSelf && user.account) {
      const { name, email, role } = changes;

      user.account = {
        ...user.account,
        ...(name ? { name } : {}),
        ...(email !== undefined ? { email: email ?? undefined } : {}),
        ...(role ? { role: /** @type {any} */ (role) } : {}),
      };
    }
  });
};

/**
 * Reset a user’s password to a generated temporary one, which signs them out everywhere.
 * @param {AdditionsUser} target User.
 * @returns {Promise<string>} Temporary password.
 * @throws {Error} When the service refuses the request.
 */
export const resetPassword = async (target) => {
  const password = generatePassword();

  await changeUsers(async () => {
    await fetchWithSession(`/v1/users/${encodeURIComponent(target.id)}/password`, {
      method: 'POST',
      body: { prehash: await getPrehash(target.username, password) },
    });
  });

  return password;
};

/**
 * Sign a user out everywhere, which also revokes their GitHub tokens.
 * @param {string} id User ID.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request.
 */
export const signOutUser = async (id) => {
  await changeUsers(async () => {
    await fetchWithSession(`/v1/users/${encodeURIComponent(id)}/sessions`, { method: 'DELETE' });
  });
};

/**
 * Delete a user.
 * @param {string} id User ID.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request, e.g. for the last admin.
 */
export const deleteUser = async (id) => {
  await changeUsers(async () => {
    await fetchWithSession(`/v1/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  });
};
