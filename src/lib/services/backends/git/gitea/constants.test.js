import { describe, expect, test } from 'vitest';
import {
  BACKEND_NAME,
  BACKEND_LABEL,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_ROOT,
  DEFAULT_AUTH_PATH,
  MIN_GITEA_VERSION,
  MIN_FORGEJO_VERSION,
} from '$lib/services/backends/git/gitea/constants';

describe('Gitea constants', () => {
  test('exports correct backend name', () => {
    expect(BACKEND_NAME).toBe('gitea');
  });

  test('exports correct backend label', () => {
    expect(BACKEND_LABEL).toBe('Gitea / Forgejo');
  });

  test('exports correct default API root', () => {
    expect(DEFAULT_API_ROOT).toBe('https://gitea.com/api/v1');
  });

  test('exports correct default auth root', () => {
    expect(DEFAULT_AUTH_ROOT).toBe('https://gitea.com');
  });

  test('exports correct default auth path', () => {
    expect(DEFAULT_AUTH_PATH).toBe('login/oauth/authorize');
  });

  test('exports correct minimum Gitea version', () => {
    expect(MIN_GITEA_VERSION).toBe(1.24);
  });

  test('exports correct minimum Forgejo version', () => {
    expect(MIN_FORGEJO_VERSION).toBe(12);
  });
});
