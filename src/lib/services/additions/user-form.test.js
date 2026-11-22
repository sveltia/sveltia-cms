import { describe, expect, test, vi } from 'vitest';

import {
  canSaveUserChanges,
  generatePassword,
  getCredentialsEmailURL,
  getEmptyUserFormValues,
  getNewUser,
  getSignInMethodsLabel,
  getUserChanges,
  getUserFormValues,
  getUserStatus,
  isGitHubOnly,
  isNewUserReady,
  parseAllowedDomains,
} from '$lib/services/additions/user-form';
import { decodeMagicLinkData } from '$lib/services/user/magic-link';

// The strings aren’t loaded here, so the email is made of its key and its values, each wrapped in
// bidi isolates as the real strings wrap them
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(
    (key, { values = {} } = {}) =>
      `${key.split('.').slice(-2).join('.')}: ${Object.entries(values)
        .map(([name, value]) => `${name}=\u2068${value}\u2069`)
        .join(' ')}`,
  ),
}));
describe('generatePassword', () => {
  test('makes four groups of four unambiguous characters, different every time', () => {
    const password = generatePassword();

    expect(password).toMatch(/^[a-km-np-z2-9]{4}(?:-[a-km-np-z2-9]{4}){3}$/);
    expect(generatePassword()).not.toBe(password);
  });
});

describe('parseAllowedDomains', () => {
  test('splits lines and commas, dropping blanks', () => {
    expect(parseAllowedDomains(' a.example \n\n*.b.example, c.example,')).toEqual([
      'a.example',
      '*.b.example',
      'c.example',
    ]);
  });
});

describe('getUserStatus', () => {
  test('tells disabled, temporary-password and active users apart', () => {
    expect(getUserStatus(/** @type {any} */ ({ disabled: true, must_change_password: true }))).toBe(
      'disabled',
    );
    expect(
      getUserStatus(/** @type {any} */ ({ disabled: false, must_change_password: true })),
    ).toBe('temporary_password');
    expect(
      getUserStatus(/** @type {any} */ ({ disabled: false, must_change_password: false })),
    ).toBe('active');
  });
});

describe('GitHub users and sign-in settings', () => {
  test('tells a user waiting for their first GitHub sign-in apart', () => {
    const waiting = /** @type {any} */ ({
      disabled: false,
      must_change_password: false,
      sign_in_methods: ['github'],
      github: { login: 'octocat', waiting_for_sign_in: true },
    });

    expect(getUserStatus(waiting)).toBe('waiting_for_sign_in');
    expect(getUserStatus({ ...waiting, sign_in_methods: ['password', 'github'] })).toBe('active');
    expect(
      getUserStatus({ ...waiting, github: { login: 'octocat', waiting_for_sign_in: false } }),
    ).toBe('active');
  });
});

describe('editing a user', () => {
  /** @type {any} */
  const target = {
    id: 'u1',
    username: 'mona',
    name: 'Mona',
    email: 'mona@example.com',
    role: 'editor',
    github: { login: 'Octocat', waiting_for_sign_in: false },
    sign_in_methods: ['github'],
  };

  test('fills the form with the user’s details', () => {
    expect(getUserFormValues(target)).toEqual({
      name: 'Mona',
      username: 'mona',
      email: 'mona@example.com',
      role: 'editor',
      github: 'Octocat',
    });
    expect(getUserFormValues({ ...target, email: null, github: null })).toMatchObject({
      email: '',
      github: '',
    });
  });

  test('finds no changes in an untouched form', () => {
    expect(getUserChanges(target, getUserFormValues(target), { includeGitHub: true })).toEqual({});
    // Case doesn’t count for emails and GitHub usernames, and spaces are trimmed
    expect(
      getUserChanges(
        target,
        {
          ...getUserFormValues(target),
          name: ' Mona ',
          email: 'Mona@Example.com',
          github: 'octocat',
        },
        { includeGitHub: true },
      ),
    ).toEqual({});
  });

  test('sends only what has changed', () => {
    expect(
      getUserChanges(
        target,
        { ...getUserFormValues(target), name: ' Mona Lisa ', role: 'admin' },
        { includeGitHub: true },
      ),
    ).toEqual({ name: 'Mona Lisa', role: 'admin' });
  });

  test('removes an email or a GitHub account left empty', () => {
    expect(
      getUserChanges(
        target,
        { ...getUserFormValues(target), email: ' ', github: '' },
        { includeGitHub: true },
      ),
    ).toEqual({ email: null, github: null });
  });

  test('adds an email or a GitHub account', () => {
    expect(
      getUserChanges(
        { ...target, email: null, github: null },
        { ...getUserFormValues(target), email: ' new@example.com ', github: ' hubot ' },
        { includeGitHub: true },
      ),
    ).toEqual({ email: 'new@example.com', github: 'hubot' });
  });

  test('leaves the GitHub account alone when the form doesn’t show it', () => {
    expect(
      getUserChanges(
        target,
        { ...getUserFormValues(target), github: '' },
        { includeGitHub: false },
      ),
    ).toEqual({});
  });

  test('tells a user who can only sign in with GitHub', () => {
    expect(isGitHubOnly(target)).toBe(true);
    expect(isGitHubOnly({ ...target, sign_in_methods: ['password', 'github'] })).toBe(false);
    expect(isGitHubOnly({ ...target, github: null, sign_in_methods: ['password'] })).toBe(false);
    // Older services don’t list the methods
    expect(isGitHubOnly({ ...target, sign_in_methods: undefined })).toBe(true);
  });
});

describe('getCredentialsEmailURL', () => {
  test('opens a message to the user with their sign-in details, as plain text', () => {
    const url = new URL(
      getCredentialsEmailURL({
        email: 'vi+cms@example.com',
        name: 'Vi Ewer',
        username: 'viewer',
        password: 'kq7m-x2pd-9vbt-h4wn',
        appName: 'Acme CMS',
        signInURL: 'https://example.com/admin/',
      }),
    );

    expect(url.protocol).toBe('mailto:');
    // The address keeps its `@`, and anything else that needs it is encoded
    expect(url.pathname).toBe('vi%2Bcms@example.com');

    const subject = /** @type {string} */ (url.searchParams.get('subject'));
    const body = /** @type {string} */ (url.searchParams.get('body'));

    expect(subject).toMatch(/^new\.subject: .*app=Acme CMS/);
    // One string per line, joined with the CRLF line breaks `mailto:` takes
    expect(body.split('\r\n').map((line) => line.split(':')[0])).toEqual([
      'credentials_email.greeting',
      '',
      'new.message',
      '',
      'credentials_email.sign_in_link',
      'credentials_email.username',
      'credentials_email.password',
    ]);
    expect(body).toContain('username=viewer');
    expect(body).toContain('password=kq7m-x2pd-9vbt-h4wn');

    // A magic link that fills in the sign-in form
    const link = (/url=(\S+)/.exec(body)?.[1] ?? '').replace(/\u2069$/, '');

    expect(link).toMatch(/^https:\/\/example\.com\/admin\/#\/signin\//);
    expect(decodeMagicLinkData(link.split('#/signin/')[1])).toEqual({
      username: 'viewer',
      password: 'kq7m-x2pd-9vbt-h4wn',
    });
    // No invisible characters, which would end up in a copied password
    expect(`${subject}${body}`).not.toMatch(/[\u2068\u2069]/);
  });

  test('uses another message for a password that has been reset', () => {
    const url = new URL(
      getCredentialsEmailURL({
        email: 'vi@example.com',
        name: 'Vi Ewer',
        username: 'viewer',
        password: 'aaaa-bbbb-cccc-dddd',
        appName: 'Acme CMS',
        signInURL: 'https://example.com/admin/',
        reset: true,
      }),
    );

    expect(url.searchParams.get('subject')).toMatch(/^reset\.subject: /);
    expect(url.searchParams.get('body')?.split('\r\n')[2]).toMatch(/^reset\.message: /);
  });
});

describe('the Add User form', () => {
  test('starts empty, for an editor', () => {
    expect(getEmptyUserFormValues()).toEqual({
      name: '',
      username: '',
      email: '',
      role: 'editor',
      github: '',
    });
  });

  test('needs a username and a name', () => {
    const values = { ...getEmptyUserFormValues(), username: 'vi' };

    expect(isNewUserReady(values)).toBe(false);
    expect(isNewUserReady({ ...values, name: ' ' })).toBe(false);
    expect(isNewUserReady({ ...values, name: 'Vi' })).toBe(true);
  });

  test('gives the new user’s details as the service takes them', () => {
    expect(
      getNewUser({
        username: ' Vi ',
        name: ' Vi Ewer ',
        email: ' vi@example.com ',
        role: 'viewer',
        github: ' ',
      }),
    ).toEqual({
      username: 'vi',
      name: 'Vi Ewer',
      email: 'vi@example.com',
      role: 'viewer',
      github: undefined,
    });
    expect(getNewUser({ ...getEmptyUserFormValues(), github: ' octocat ' }).github).toBe('octocat');
  });
});

describe('canSaveUserChanges', () => {
  /** @type {any} */
  const passwordUser = { name: 'Mona', sign_in_methods: ['password'] };
  /** @type {any} */
  const githubOnly = { name: 'Mona', sign_in_methods: ['github'], github: { login: 'octocat' } };
  const values = { ...getEmptyUserFormValues(), name: 'Mona' };

  test('needs changes and a name', () => {
    expect(canSaveUserChanges(passwordUser, values, {})).toBe(false);
    expect(canSaveUserChanges(passwordUser, { ...values, name: ' ' }, { name: '' })).toBe(false);
    expect(canSaveUserChanges(passwordUser, values, { role: 'admin' })).toBe(true);
  });

  test('won’t take the GitHub account away from a user who can only sign in with it', () => {
    expect(canSaveUserChanges(githubOnly, values, { github: null })).toBe(false);
    expect(canSaveUserChanges(passwordUser, values, { github: null })).toBe(true);
  });
});

describe('getSignInMethodsLabel', () => {
  test('lists the password and the GitHub account', () => {
    expect(
      getSignInMethodsLabel(
        /** @type {any} */ ({ sign_in_methods: ['password'], github: { login: 'octocat' } }),
      ),
    ).toBe('methods.password: , methods.github: login=\u2068octocat\u2069');
    expect(getSignInMethodsLabel(/** @type {any} */ ({}))).toBe('');
  });
});
