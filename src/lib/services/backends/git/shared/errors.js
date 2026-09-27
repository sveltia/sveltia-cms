import { _ } from '@sveltia/i18n';

/**
 * Message of the error thrown when the signed-in user doesn’t have access to the repository. The
 * sign-in flow checks for it to clear the cached credentials, so it has to stay the same across all
 * backends.
 */
export const NOT_COLLABORATOR_ERROR_MESSAGE = 'Not a collaborator of the repository';

/**
 * Create an error whose message is meant for developers and whose cause carries a localized message
 * to be shown to the user.
 * @param {string} message Error message in English.
 * @param {string} key Localized string key for the cause.
 * @param {Record<string, any>} [values] Values to be interpolated into the localized string.
 * @returns {Error} Error.
 */
export const createLocalizedError = (message, key, values) =>
  new Error(message, { cause: new Error(values ? _(key, { values }) : _(key)) });
