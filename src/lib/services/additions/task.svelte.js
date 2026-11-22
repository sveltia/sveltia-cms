import { _ } from '@sveltia/i18n';

/**
 * Get the message to show for a failed request to Sveltia CMS Additions: the localized reason the
 * service gave, or a fallback, e.g. when the request didn’t reach it.
 * @param {any} error Error thrown by the request.
 * @param {string} [fallbackMessageKey] Message key of the fallback.
 * @returns {string} Message.
 */
export const getRequestErrorMessage = (error, fallbackMessageKey = 'additions.error.unexpected') =>
  error?.cause?.message ?? _(fallbackMessageKey);

/**
 * Runs requests to Sveltia CMS Additions one at a time, keeping track of whether one is in
 * progress, of the error the last one ended with, and of what it did once it succeeded, for a form
 * to show.
 */
export class TaskRunner {
  /** Whether a request is in progress. */
  busy = $state(false);

  /** Why the last request failed, if it did. */
  error = $state('');

  /**
   * Message key of what the last request did, e.g. that the changes have been saved, until the
   * next one starts or the form is edited.
   */
  doneMessageKey = $state('');

  /** Message key of the error shown when the service gives no reason. */
  #fallbackMessageKey;

  /**
   * Create a runner.
   * @param {object} [options] Options.
   * @param {string} [options.fallbackMessageKey] Message key of the error shown when the service
   * gives no reason, e.g. the request didn’t reach it.
   */
  constructor({ fallbackMessageKey = 'additions.error.unexpected' } = {}) {
    this.#fallbackMessageKey = fallbackMessageKey;
  }

  /**
   * Run a request, showing the error it ends with, if any.
   * @param {() => Promise<void>} task Task.
   * @param {object} [options] Options.
   * @param {string} [options.doneMessageKey] Message key of what the request did, to show once it
   * has succeeded.
   * @returns {Promise<void>}
   */
  run = async (task, { doneMessageKey = '' } = {}) => {
    this.busy = true;
    this.error = '';
    this.doneMessageKey = '';

    try {
      await task();
      this.doneMessageKey = doneMessageKey;
    } catch (ex) {
      this.error = getRequestErrorMessage(ex, this.#fallbackMessageKey);
    }

    this.busy = false;
  };

  /**
   * Stop showing what the last request did, e.g. once the form is edited again.
   */
  clearDone = () => {
    this.doneMessageKey = '';
  };
}
