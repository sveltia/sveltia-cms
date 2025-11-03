import { describe, expect, test } from 'vitest';

import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
  DEFAULT_PKCE_AUTH_PATH,
  DEFAULT_PKCE_AUTH_ROOT,
} from '$lib/services/backends/git/github/constants';

describe('GitHub constants', () => {
  test('exports correct backend name', () => {
    expect(BACKEND_NAME).toBe('github');
  });

  test('exports correct backend label', () => {
    expect(BACKEND_LABEL).toBe('GitHub');
  });

  test('exports correct default API root', () => {
    expect(DEFAULT_API_ROOT).toBe('https://api.github.com');
  });

  test('exports correct default auth root', () => {
    expect(DEFAULT_AUTH_ROOT).toBe('https://api.netlify.com');
  });

  test('exports correct default auth path', () => {
    expect(DEFAULT_AUTH_PATH).toBe('auth');
  });

  test('exports correct default PKCE auth root', () => {
    expect(DEFAULT_PKCE_AUTH_ROOT).toBe('https://github.com');
  });

  test('exports correct default PKCE auth path', () => {
    expect(DEFAULT_PKCE_AUTH_PATH).toBe('login/oauth/authorize');
  });
});
