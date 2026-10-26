import { describe, expect, test } from 'vitest';

import {
  BACKEND_LABEL,
  BACKEND_NAME,
  BACKEND_NAMES,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
  FORGEJO_BACKEND_LABEL,
  FORGEJO_BACKEND_NAME,
  MIN_FORGEJO_VERSION,
  MIN_GITEA_VERSION,
} from '$lib/services/backends/git/gitea/constants';

describe('Gitea constants', () => {
  test('exports correct backend name', () => {
    expect(BACKEND_NAME).toBe('gitea');
  });

  test('exports correct backend label', () => {
    expect(BACKEND_LABEL).toBe('Gitea / Forgejo');
  });

  test('exports correct Forgejo backend name and label', () => {
    expect(FORGEJO_BACKEND_NAME).toBe('forgejo');
    expect(FORGEJO_BACKEND_LABEL).toBe('Forgejo');
  });

  test('exports both backend names', () => {
    expect(BACKEND_NAMES).toEqual(['gitea', 'forgejo']);
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
