import { _ } from '@sveltia/i18n';

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
