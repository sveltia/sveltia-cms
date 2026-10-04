// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';

import { deleteRemoteBranch, isSquashMergeEnabled } from './workflow';

vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

describe('isSquashMergeEnabled()', () => {
  beforeEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns false without a config', () => {
    expect(isSquashMergeEnabled()).toBe(false);
  });

  test('returns false when the option is not set', () => {
    cmsConfig.current = { backend: { name: 'github' } };
    expect(isSquashMergeEnabled()).toBe(false);
  });

  test('returns the option value', () => {
    cmsConfig.current = { backend: { name: 'github', squash_merges: true } };
    expect(isSquashMergeEnabled()).toBe(true);

    cmsConfig.current = { backend: { name: 'gitlab', squash_merges: false } };
    expect(isSquashMergeEnabled()).toBe(false);
  });
});

describe('deleteRemoteBranch()', () => {
  const args = {
    branch: 'cms/posts/hello',
    path: '/branches/cms%2Fposts%2Fhello',
    goneStatuses: [404],
  };

  test('sends a DELETE request to the given path', async () => {
    vi.mocked(fetchAPI).mockResolvedValue('');
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(fetchAPI).toHaveBeenCalledWith('/branches/cms%2Fposts%2Fhello', {
      method: 'DELETE',
      responseType: 'text',
    });
  });

  test('ignores a branch that is already gone without logging it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(fetchAPI).mockRejectedValue(new Error('Error', { cause: { status: 404 } }));
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('ignores any other failure, but logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('Error', { cause: { status: 422 } });

    vi.mocked(fetchAPI).mockRejectedValue(error);
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Failed to delete the cms/posts/hello branch.', error);
    warn.mockRestore();
  });

  test('ignores an error without a status, but logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(fetchAPI).mockRejectedValue(new Error('Network error'));
    await expect(deleteRemoteBranch(args)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
