import { afterEach, describe, expect, test, vi } from 'vitest';

import { NOT_COLLABORATOR_ERROR_MESSAGE } from '$lib/services/backends/git/shared/errors';
import {
  readonlyRepository,
  recordRepositoryAccess,
} from '$lib/services/backends/repository-access';

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ values: true }),
);

describe('recordRepositoryAccess', () => {
  afterEach(() => {
    readonlyRepository.current = undefined;
  });

  test('leaves the repository writable for a user who can push to it', () => {
    readonlyRepository.current = 'site';
    recordRepositoryAccess('site', { canRead: true, canPush: true });

    expect(readonlyRepository.current).toBeUndefined();
  });

  test('makes the repository read-only for a user who can only read it', () => {
    recordRepositoryAccess('site', { canRead: true, canPush: false });

    expect(readonlyRepository.current).toBe('site');
  });

  test('refuses a user who can’t read the repository', () => {
    expect(() => recordRepositoryAccess('site', { canRead: false, canPush: false })).toThrow(
      expect.objectContaining({
        message: NOT_COLLABORATOR_ERROR_MESSAGE,
        cause: expect.objectContaining({ message: 'repository_no_access:{"repo":"site"}' }),
      }),
    );
    expect(readonlyRepository.current).toBeUndefined();
  });
});
