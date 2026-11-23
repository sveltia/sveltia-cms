import { getServiceInfo } from '$lib/services/additions/auth.svelte';
import { fetchWithSession } from '$lib/services/additions/session-api';
import { additionsUsers } from '$lib/services/additions/users.svelte';
import { compareVersions, getLatestVersion } from '$lib/services/app/update';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import { SignUpRule } from '$lib/services/additions/users.svelte';
 */

/*
 * Settings of the site on Sveltia CMS Additions, which an admin changes on the Administration page,
 * and the check for a newer release of the service. They’re kept with the users in
 * `additionsUsers`, as they’re loaded together.
 */

/**
 * Replace the allowed domains.
 * @param {string[]} allowedDomains Hostnames, possibly with a `*` wildcard.
 * @returns {Promise<void>}
 * @throws {Error} When the list is invalid, or would no longer allow this site.
 */
export const saveAllowedDomains = async (allowedDomains) => {
  const { allowed_domains: saved } = await fetchWithSession('/v1/settings', {
    method: 'PATCH',
    body: { allowed_domains: allowedDomains },
  });

  additionsUsers.allowedDomains = saved;
};

/**
 * Choose who appears as the author of the commits. Other users get the change with their next
 * GitHub token, within an hour; the admin who makes it sees it straight away.
 * @param {'user' | 'bot'} mode `user` for the person, `bot` for the app, with the person as
 * co-author.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the change.
 */
export const saveCommitAuthor = async (mode) => {
  const { commit_author: saved } = await fetchWithSession('/v1/settings', {
    method: 'PATCH',
    body: { commit_author: mode },
  });

  additionsUsers.commitAuthor = saved;

  if (user.account?.commitAuthor) {
    user.account = { ...user.account, commitAuthor: { ...user.account.commitAuthor, mode: saved } };
  }
};

/**
 * Save the sign-in methods and the sign-up rules.
 * @param {object} args Arguments.
 * @param {{ github: boolean }} args.signInMethods Sign-in methods besides the password.
 * @param {SignUpRule[]} args.signUpRules Sign-up rules.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses them, e.g. for an organization the app isn’t installed
 * on.
 */
export const saveSignInSettings = async ({ signInMethods, signUpRules }) => {
  const { sign_in_methods: methods, sign_up_rules: rules } = await fetchWithSession(
    '/v1/settings',
    {
      method: 'PATCH',
      body: { sign_in_methods: signInMethods, sign_up_rules: signUpRules },
    },
  );

  Object.assign(additionsUsers, { signInMethods: methods, signUpRules: rules });
};

/**
 * Check the GitHub App with GitHub.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request.
 */
export const loadGitHubStatus = async () => {
  additionsUsers.github = await fetchWithSession('/v1/settings/github');
};

/**
 * Replace the GitHub App’s private key with a new one generated on GitHub.
 * @param {File} file `.pem` file GitHub downloaded.
 * @returns {Promise<void>}
 * @throws {Error} When the file isn’t a private key, or GitHub doesn’t accept it for the app.
 */
export const replacePrivateKey = async (file) => {
  additionsUsers.github = await fetchWithSession('/v1/settings/github/private-key', {
    method: 'PUT',
    body: { private_key: await file.text() },
  });
};

/**
 * Where releases of Sveltia CMS Additions are listed, with how to update.
 */
export const RELEASES_URL = 'https://github.com/sveltia/sveltia-cms-additions/releases';

/**
 * Check whether a newer release of the service is out, so admins know to update it. The latest
 * version is looked up the way the CMS looks up its own, on UNPKG. Nothing is reported if the
 * service or UNPKG can’t be reached.
 * @returns {Promise<void>}
 */
export const checkForUpdate = async () => {
  try {
    const { package: packageName, version: current } = await getServiceInfo();
    // Without a name, the lookup would fall back to the CMS’s own package
    const latest = packageName ? await getLatestVersion({ packageName }) : undefined;

    additionsUsers.update =
      latest && compareVersions(latest, current) > 0 ? { current, latest } : undefined;
  } catch {
    additionsUsers.update = undefined;
  }
};
