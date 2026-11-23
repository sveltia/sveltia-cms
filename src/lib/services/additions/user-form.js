import { _ } from '@sveltia/i18n';

import { encodeMagicLinkData } from '$lib/services/user/magic-link';

/**
 * @import { AdditionsUser } from '$lib/services/additions/users.svelte';
 */

/*
 * Helpers of the user form and list on the Users page, which only work with what they’re given.
 */

/**
 * Roles, from the most to the least privileged.
 */
export const ROLES = /** @type {const} */ (['admin', 'editor', 'viewer']);

/**
 * Roles a sign-up rule can give: anyone but an admin, who is always added by another admin.
 */
export const SIGN_UP_ROLES = /** @type {const} */ (['editor', 'viewer']);

/**
 * Characters of a generated password, without the ones that are easy to mix up, such as `0` and
 * `o`, or `1` and `l`, since an admin passes the password on by hand.
 */
// cspell:disable-next-line
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Generate a temporary password: four groups of four characters, about 80 bits of randomness, easy
 * to read out or type. The user has to change it at the first sign-in.
 * @returns {string} Password, e.g. `kq7m-x2pd-9vbt-h4wn`.
 */
export const generatePassword = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length])
    .join('')
    .replace(/(.{4})(?=.)/g, '$1-');

/**
 * Changes to a user made in the Edit User dialog.
 * @typedef {object} UserChanges
 * @property {string} [name] Name.
 * @property {string | null} [email] Email, or `null` to remove it.
 * @property {string} [role] Role.
 * @property {string | null} [github] GitHub username, or `null` to stop signing in with GitHub.
 */

/**
 * Values of the user form.
 * @typedef {object} UserFormValues
 * @property {string} name Name.
 * @property {string} username Username.
 * @property {string} email Email.
 * @property {string} role Role.
 * @property {string} github GitHub username.
 */

/**
 * A temporary password to show once, with the user it belongs to.
 * @typedef {object} IssuedPassword
 * @property {string} username Username.
 * @property {string} name Name.
 * @property {string} email Email, or an empty string without one.
 * @property {string} password Temporary password.
 * @property {boolean} reset Whether the password has been reset, rather than the user added.
 */

/**
 * Get the values of an empty user form, to add a user.
 * @returns {UserFormValues} Values.
 */
export const getEmptyUserFormValues = () => ({
  name: '',
  username: '',
  email: '',
  role: 'editor',
  github: '',
});

/**
 * Check whether the Add User form has what a new user needs: a username and a name.
 * @param {UserFormValues} values Form values.
 * @returns {boolean} Whether the user can be added.
 */
export const isNewUserReady = (values) => !!values.username.trim() && !!values.name.trim();

/**
 * Get the details of a new user from the Add User form, as the service takes them: usernames are
 * lower case, and a GitHub username, if any, replaces the password.
 * @param {UserFormValues} values Form values.
 * @returns {{ username: string, name: string, email: string, role: 'admin' | 'editor' | 'viewer',
 * github?: string }} New user.
 */
export const getNewUser = ({ username, name, email, role, github }) => ({
  username: username.trim().toLowerCase(),
  name: name.trim(),
  email: email.trim(),
  role: /** @type {'admin' | 'editor' | 'viewer'} */ (role),
  github: github.trim() || undefined,
});

/**
 * Get the values of the user form for an existing user, to edit them.
 * @param {AdditionsUser} target User.
 * @returns {UserFormValues} Values.
 */
export const getUserFormValues = (target) => ({
  name: target.name,
  username: target.username,
  email: target.email ?? '',
  role: target.role,
  github: target.github?.login ?? '',
});

/**
 * Check whether a user can only sign in with GitHub, so their GitHub account can’t be removed
 * without locking them out. Resetting their password gives them another way in.
 * @param {AdditionsUser} target User.
 * @returns {boolean} Result.
 */
export const isGitHubOnly = (target) =>
  !!target.github && !target.sign_in_methods?.includes('password');

/**
 * Work out what has been changed in the Edit User dialog, so only that is sent. Emails and GitHub
 * usernames are compared case-insensitively, as the service treats them.
 * @param {AdditionsUser} target User being edited.
 * @param {UserFormValues} values Form values.
 * @param {object} options Options.
 * @param {boolean} options.includeGitHub Whether the form shows the GitHub username.
 * @returns {UserChanges} Changes, empty if there are none.
 */
export const getUserChanges = (target, values, { includeGitHub }) => {
  /** @type {UserChanges} */
  const changes = {};
  const name = values.name.trim();
  const email = values.email.trim() || null;
  const github = values.github.trim() || null;

  if (name !== target.name) {
    changes.name = name;
  }

  if (email?.toLowerCase() !== target.email?.toLowerCase()) {
    changes.email = email;
  }

  if (values.role !== target.role) {
    changes.role = values.role;
  }

  if (includeGitHub && github?.toLowerCase() !== target.github?.login.toLowerCase()) {
    changes.github = github;
  }

  return changes;
};

/**
 * Check whether the Edit User form can be saved: it has changes and a name, and doesn’t take the
 * GitHub account away from a user who can only sign in with it, who would be locked out.
 * @param {AdditionsUser} target User being edited.
 * @param {UserFormValues} values Form values.
 * @param {UserChanges} changes Changes, from {@link getUserChanges}.
 * @returns {boolean} Whether the changes can be saved.
 */
export const canSaveUserChanges = (target, values, changes) =>
  !!values.name.trim() &&
  !!Object.keys(changes).length &&
  !(isGitHubOnly(target) && changes.github === null);

/**
 * Get how a user signs in, e.g. “Password, GitHub (mona)”.
 * @param {AdditionsUser} target User.
 * @returns {string} Label.
 */
export const getSignInMethodsLabel = (target) =>
  [
    ...(target.sign_in_methods?.includes('password')
      ? [_('additions.users.methods.password')]
      : []),
    ...(target.github
      ? [_('additions.users.methods.github', { values: { login: target.github.login } })]
      : []),
  ].join(', ');

/**
 * Build a `mailto:` link that opens the admin’s email app with a message giving a user their
 * username and temporary password, and a magic link to the CMS that fills them in on the sign-in
 * form, like the one a QR code sign-in uses, for the admin to review and send:
 * one for a user who has just been added, another for one whose password has been reset.
 * The service itself never sends email. The values are plain text, so the bidi isolates the
 * localized strings wrap them in are removed, or they’d end up in a password copied from the email.
 * @param {object} args Arguments.
 * @param {string} args.email Recipient’s email address.
 * @param {string} args.name Recipient’s name.
 * @param {string} args.username Username.
 * @param {string} args.password Temporary password.
 * @param {string} args.appName Name of the CMS, e.g. its custom title.
 * @param {string} args.signInURL URL of the CMS, where they sign in, without a hash.
 * @param {boolean} [args.reset] Whether the password has been reset, rather than the user added.
 * @returns {string} `mailto:` URL.
 */
export const getCredentialsEmailURL = ({
  email,
  name,
  username,
  password,
  appName,
  signInURL,
  reset = false,
}) => {
  // Opening it fills in the sign-in form, like a QR code sign-in, without signing in
  const url = `${signInURL}#/signin/${encodeMagicLinkData({ username, password })}`;

  /**
   * Localize a line of the message as plain text.
   * @param {string} key Message key, under `additions.users.credentials_email`.
   * @returns {string} Text.
   */
  const text = (key) =>
    _(`additions.users.credentials_email.${key}`, {
      values: { name, username, password, app: appName, url },
    }).replace(/[\u2068\u2069]/g, '');

  const kind = reset ? 'reset' : 'new';

  // Line breaks are CRLF, as `mailto:` bodies take them; the localized strings have none
  const body = [
    text('greeting'),
    '',
    text(`${kind}.message`),
    '',
    text('sign_in_link'),
    text('username'),
    text('password'),
  ].join('\r\n');

  // `@` is kept as is, as some email apps don’t decode it in the address
  const address = encodeURIComponent(email).replace('%40', '@');
  const subject = encodeURIComponent(text(`${kind}.subject`));

  return `mailto:${address}?subject=${subject}&body=${encodeURIComponent(body)}`;
};

/**
 * Parse the allowed domains as an admin types them, one per line or separated by commas.
 * @param {string} text Text.
 * @returns {string[]} Hostnames.
 */
export const parseAllowedDomains = (text) =>
  text
    .split(/[\n,]/)
    .map((domain) => domain.trim())
    .filter(Boolean);

/**
 * Get the status of a user to show on the Users page.
 * @param {AdditionsUser} target User.
 * @returns {'disabled' | 'temporary_password' | 'waiting_for_sign_in' | 'active'} Status.
 */
export const getUserStatus = (target) => {
  if (target.disabled) {
    return 'disabled';
  }

  if (target.must_change_password) {
    return 'temporary_password';
  }

  // Someone who can only sign in with the GitHub account an admin named
  if (target.github?.waiting_for_sign_in && !target.sign_in_methods?.includes('password')) {
    return 'waiting_for_sign_in';
  }

  return 'active';
};
