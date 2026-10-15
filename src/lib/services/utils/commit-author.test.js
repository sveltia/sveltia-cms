import { describe, expect, test } from 'vitest';

import { getCommitAuthorName } from '$lib/services/utils/commit-author';

describe('getCommitAuthorName()', () => {
  test('prefers the name, then the login, then the email', () => {
    expect(getCommitAuthorName({ name: 'Name', login: 'login', email: 'a@b.c' })).toBe('Name');
    expect(getCommitAuthorName({ name: '', login: 'login', email: 'a@b.c' })).toBe('login');
    expect(getCommitAuthorName({ email: 'a@b.c' })).toBe('a@b.c');
  });

  test('returns an empty value without an author or a name', () => {
    expect(getCommitAuthorName(undefined)).toBeUndefined();
    expect(getCommitAuthorName({ name: '', email: '' })).toBe('');
  });
});
