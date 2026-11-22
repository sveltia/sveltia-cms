import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { saveSignInSettings } from '$lib/services/additions/site-settings';
import { TaskRunner } from '$lib/services/additions/task.svelte';
import { additionsUsers } from '$lib/services/additions/users.svelte';

import SignInForm from './sign-in-form.svelte';

// The settings are saved to Sveltia CMS Additions; the state is real, the request isn’t
vi.mock('$lib/services/additions/site-settings', async (importOriginal) => ({
  ...(await importOriginal()),
  saveSignInSettings: vi.fn(),
}));

describe('SignInForm', () => {
  beforeEach(() => {
    Object.assign(additionsUsers, {
      signInMethods: { github: false },
      signUpRules: [{ id: 'r1', type: 'github_org', org: 'acme', role: 'editor' }],
    });
    vi.mocked(saveSignInSettings).mockImplementation(async ({ signInMethods, signUpRules }) => {
      Object.assign(additionsUsers, {
        signInMethods,
        signUpRules: signUpRules.map((rule, index) => ({ id: `r${index + 1}`, ...rule })),
      });
    });
  });

  test('warns that turning GitHub sign-in off locks out users without a password', async () => {
    Object.assign(additionsUsers, {
      signInMethods: { github: true },
      users: [
        { id: 'u1', disabled: false, github: { login: 'a' }, sign_in_methods: ['github'] },
        { id: 'u2', disabled: false, github: { login: 'b' }, sign_in_methods: ['github'] },
        // Can still sign in, or can’t anyway
        {
          id: 'u3',
          disabled: false,
          github: { login: 'c' },
          sign_in_methods: ['github', 'password'],
        },
        { id: 'u4', disabled: true, github: { login: 'd' }, sign_in_methods: ['github'] },
      ],
    });

    await render(SignInForm, { runner: new TaskRunner() });

    expect(page.getByRole('alert').elements()).toHaveLength(0);
    await page.getByRole('switch', { name: 'Allow signing in with GitHub' }).click();
    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(/2\u2069? users can only sign in with GitHub/);
    additionsUsers.users = [];
  });

  test('turns on signing in with GitHub and edits the sign-up rules', async () => {
    await render(SignInForm, { runner: new TaskRunner() });

    await page.getByRole('switch', { name: 'Allow signing in with GitHub' }).click();

    // Add a rule, then remove the first one
    await page.getByRole('button', { name: 'Add Rule' }).click();

    const newRule = page.getByRole('group', { name: 'GitHub organization' });

    // Named for its organization once it has one
    await expect
      .element(newRule.getByRole('button', { name: 'Remove Rule', exact: true }))
      .toBeVisible();
    await newRule.getByRole('textbox', { name: 'GitHub organization' }).fill(' sveltia ');
    await expect
      .element(page.getByRole('button', { name: 'Remove Rule for \u2068sveltia\u2069' }))
      .toBeVisible();
    await page.getByRole('button', { name: 'Remove Rule for \u2068acme\u2069' }).click();
    await page.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Editor' }).click();
    await page.getByRole('button', { name: 'Save Sign-In Settings' }).click();

    await vi.waitFor(() =>
      expect(saveSignInSettings).toHaveBeenCalledWith({
        signInMethods: { github: true },
        signUpRules: [{ type: 'github_org', org: 'sveltia', role: 'editor' }],
      }),
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('The sign-in settings have been saved.');

    // Editing again hides the message, as does turning GitHub sign-in off
    await page.getByRole('textbox', { name: 'GitHub organization' }).fill('sveltia-2');
    expect(page.getByRole('status').elements()).toHaveLength(0);
    await page.getByRole('button', { name: 'Save Sign-In Settings' }).click();
    await expect.element(page.getByRole('status')).toBeVisible();
    await page.getByRole('switch', { name: 'Allow signing in with GitHub' }).click();
    expect(page.getByRole('status').elements()).toHaveLength(0);
  });

  test('can’t save while busy', async () => {
    const runner = new TaskRunner();

    runner.busy = true;
    await render(SignInForm, { runner });

    await expect
      .element(page.getByRole('button', { name: 'Save Sign-In Settings' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
