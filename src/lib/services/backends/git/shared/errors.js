import { _ } from '@sveltia/i18n';

/**
 * @import { RepositoryPath } from '$lib/types/private';
 */

/**
 * Message of the error thrown when the signed-in user doesn’t have access to the repository. The
 * sign-in flow checks for it to clear the cached credentials, so it has to stay the same across all
 * backends.
 */
export const NOT_COLLABORATOR_ERROR_MESSAGE = 'Not a collaborator of the repository';

/**
 * Error whose message is localized, to be shown to the user as is. It’s the `cause` of an error
 * created with {@link createLocalizedError}, which tells it apart from the `cause` of an API error:
 * a plain object with the response status and the server’s own message, in English.
 */
class LocalizedError extends Error {}

/**
 * Create an error whose message is meant for developers and whose cause carries a localized message
 * to be shown to the user.
 * @param {string} message Error message in English.
 * @param {string} key Localized string key for the cause.
 * @param {Record<string, any>} [values] Values to be interpolated into the localized string.
 * @returns {Error} Error.
 */
export const createLocalizedError = (message, key, values) =>
  new Error(message, { cause: new LocalizedError(values ? _(key, { values }) : _(key)) });

/**
 * Get the message to show the user when something has failed. An error created with
 * {@link createLocalizedError} says what went wrong, which may be something trying again wouldn’t
 * change. An API error’s own message isn’t meant for the user, so any other error gets the generic
 * message given.
 * @param {any} ex Error.
 * @param {string} fallback I18n key of the message for any other error.
 * @returns {string} Localized message.
 */
export const getErrorMessage = (ex, fallback) =>
  (ex?.cause instanceof LocalizedError && ex.cause.message) || _(fallback);

/**
 * Create the error to throw when the configured repository couldn’t be read while checking the
 * signed-in user’s access to it. A refusal means the user has no access, and the shared message is
 * what the sign-in flow looks for to drop the cached credentials, so the user gets the sign-in form
 * rather than the same error on every reload. Anything else, like a rate limit, an outage or a
 * network error, leaves the question unanswered. Reading that as “no access” would clear the
 * credentials and sign the user out over something passing, so it’s reported as a failed check.
 * @param {RepositoryPath} repository Configured repository.
 * @param {number | undefined} status HTTP status the request was refused with. `undefined` for a
 * request that wasn’t answered, or one whose status doesn’t tell, like a rate limit answered with a
 * 403.
 * @param {object} [options] Options.
 * @param {boolean} [options.reportNotFound] Whether to report a 404 as a missing repository rather
 * than as a refusal. A private repository answers a request from someone without access with a 404
 * as well, so its existence isn’t leaked.
 * @returns {Error} Error.
 */
export const toRepositoryAccessError = (
  { owner, repo },
  status,
  { reportNotFound = false } = {},
) => {
  if (status === 404 && reportNotFound) {
    return createLocalizedError('Failed to check repository access', 'repository_not_found', {
      repo,
    });
  }

  // A 401 means the token has expired or been revoked, and a 403 that it lacks the scope
  if (status === 401 || status === 403 || status === 404) {
    return createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', { repo });
  }

  return createLocalizedError(
    'Failed to check the repository permission.',
    'open_authoring.permission_check_failed',
    { repo: `${owner}/${repo}` },
  );
};
