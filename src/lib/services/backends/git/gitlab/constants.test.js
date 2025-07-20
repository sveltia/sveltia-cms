import { describe, expect, test } from 'vitest';
import {
  BACKEND_NAME,
  BACKEND_LABEL,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_ROOT,
  DEFAULT_AUTH_PATH,
} from '$lib/services/backends/git/gitlab/constants';

describe('GitLab constants', () => {
  test('exports correct backend name', () => {
    expect(BACKEND_NAME).toBe('gitlab');
  });

  test('exports correct backend label', () => {
    expect(BACKEND_LABEL).toBe('GitLab');
  });

  test('exports correct default API root', () => {
    expect(DEFAULT_API_ROOT).toBe('https://gitlab.com/api/v4');
  });

  test('exports correct default auth root', () => {
    expect(DEFAULT_AUTH_ROOT).toBe('https://gitlab.com');
  });

  test('exports correct default auth path', () => {
    expect(DEFAULT_AUTH_PATH).toBe('oauth/authorize');
  });
});
