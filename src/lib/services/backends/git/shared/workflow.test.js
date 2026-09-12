// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import { isSquashMergeEnabled } from './workflow';

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
