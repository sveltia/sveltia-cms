import { _ } from '@sveltia/i18n';
import { describe, expect, it, vi } from 'vitest';

import {
  createLocalizedError,
  getErrorMessage,
  NOT_COLLABORATOR_ERROR_MESSAGE,
  toRepositoryAccessError,
} from '$lib/services/backends/git/shared/errors';

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ values: true }),
);

describe('NOT_COLLABORATOR_ERROR_MESSAGE', () => {
  it('should be the message checked by the sign-in flow', () => {
    expect(NOT_COLLABORATOR_ERROR_MESSAGE).toBe('Not a collaborator of the repository');
  });
});

describe('createLocalizedError', () => {
  it('should create an error with a localized cause including values', () => {
    const error = createLocalizedError('Failed to do something.', 'branch_not_found', {
      repo: 'my-repo',
      branch: 'main',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Failed to do something.');
    expect(error.cause).toBeInstanceOf(Error);
    expect(/** @type {Error} */ (error.cause).message).toBe(
      'branch_not_found:{"repo":"my-repo","branch":"main"}',
    );
    expect(_).toHaveBeenCalledWith('branch_not_found', {
      values: { repo: 'my-repo', branch: 'main' },
    });
  });

  it('should create an error with a localized cause without values', () => {
    const error = createLocalizedError('Cannot do something.', 'open_authoring.fork_declined');

    expect(error.message).toBe('Cannot do something.');
    expect(/** @type {Error} */ (error.cause).message).toBe('open_authoring.fork_declined');
    expect(_).toHaveBeenCalledWith('open_authoring.fork_declined');
  });
});

describe('getErrorMessage', () => {
  it('should return the localized message of an error created with createLocalizedError', () => {
    expect(
      getErrorMessage(
        createLocalizedError('The workflow branch is in use.', 'workflow.branch_in_use', {
          number: '!3',
        }),
        'fallback',
      ),
    ).toBe('workflow.branch_in_use:{"number":"!3"}');
  });

  it('should return the fallback message for any other error', () => {
    expect(
      getErrorMessage(
        new Error('Server responded with an error', {
          cause: { status: 409, message: 'Conflict' },
        }),
        'fallback',
      ),
    ).toBe('fallback');
    expect(
      getErrorMessage(
        new Error('Failed to send the request', { cause: new TypeError() }),
        'fallback',
      ),
    ).toBe('fallback');
    expect(getErrorMessage(new Error('Something failed'), 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});

describe('toRepositoryAccessError', () => {
  const repository = { owner: 'owner', repo: 'repo' };
  /**
   * Get the localized message of the given error.
   * @param {Error} error Error.
   * @returns {string} Message.
   */
  const getCause = (error) => /** @type {Error} */ (error.cause).message;

  it.each([401, 403, 404])('should report a %i as no access', (status) => {
    const error = toRepositoryAccessError(repository, status);

    expect(error.message).toBe(NOT_COLLABORATOR_ERROR_MESSAGE);
    expect(getCause(error)).toBe('repository_no_access:{"repo":"repo"}');
  });

  it('should report a 404 as a missing repository when asked to', () => {
    const error = toRepositoryAccessError(repository, 404, { reportNotFound: true });

    expect(getCause(error)).toBe('repository_not_found:{"repo":"repo"}');
    expect(getCause(toRepositoryAccessError(repository, 403, { reportNotFound: true }))).toBe(
      'repository_no_access:{"repo":"repo"}',
    );
  });

  it.each([undefined, 429, 500])('should report a failed check for %s', (status) => {
    const error = toRepositoryAccessError(repository, status);

    expect(error.message).toBe('Failed to check the repository permission.');
    expect(getCause(error)).toBe('open_authoring.permission_check_failed:{"repo":"owner/repo"}');
  });
});
