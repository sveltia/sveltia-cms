import { _ } from '@sveltia/i18n';
import { describe, expect, it, vi } from 'vitest';

import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
} from '$lib/services/backends/git/shared/errors';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, options) => `${key}${options ? `:${JSON.stringify(options.values)}` : ''}`),
}));

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
