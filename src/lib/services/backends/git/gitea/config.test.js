import { describe, expect, test } from 'vitest';

import { getAuthRoot } from '$lib/services/backends/git/gitea/config';

describe('getAuthRoot()', () => {
  test('falls back to Gitea.com with the Gitea backend', () => {
    expect(getAuthRoot({ name: 'gitea', repo: 'owner/repo' })).toBe('https://gitea.com');
    expect(
      getAuthRoot({ name: 'gitea', repo: 'owner/repo', api_root: 'https://codeberg.org/api/v1' }),
    ).toBe('https://gitea.com');
  });

  test('derives the URL from the API root with the Forgejo backend', () => {
    expect(
      getAuthRoot({ name: 'forgejo', repo: 'owner/repo', api_root: 'https://codeberg.org/api/v1' }),
    ).toBe('https://codeberg.org');
    expect(
      getAuthRoot({
        name: 'forgejo',
        repo: 'owner/repo',
        api_root: 'https://example.com/forgejo/api/v1/',
      }),
    ).toBe('https://example.com/forgejo');
  });

  test('falls back to Gitea.com without an API root, which is reported as a config error', () => {
    expect(getAuthRoot(/** @type {any} */ ({ name: 'forgejo', repo: 'owner/repo' }))).toBe(
      'https://gitea.com',
    );
  });

  test('prefers the `base_url` option', () => {
    expect(
      getAuthRoot({ name: 'gitea', repo: 'owner/repo', base_url: 'https://codeberg.org' }),
    ).toBe('https://codeberg.org');
    expect(
      getAuthRoot({
        name: 'forgejo',
        repo: 'owner/repo',
        api_root: 'https://codeberg.org/api/v1',
        base_url: 'https://auth.example.com',
      }),
    ).toBe('https://auth.example.com');
  });
});
