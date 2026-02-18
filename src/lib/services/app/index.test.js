import { describe, expect, test } from 'vitest';

import { dependencies, version } from './index.js';

describe('services/app re-exports', () => {
  test('exports a version string', () => {
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  test('exports a dependencies object', () => {
    expect(typeof dependencies).toBe('object');
    expect(dependencies).not.toBeNull();
  });
});
