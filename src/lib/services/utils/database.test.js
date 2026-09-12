import { IndexedDB } from '@sveltia/utils/storage';
import { describe, expect, test, vi } from 'vitest';

import { getRepositoryDatabase } from '$lib/services/utils/database';

vi.mock('@sveltia/utils/storage', () => ({ IndexedDB: vi.fn() }));

describe('getRepositoryDatabase()', () => {
  test('opens the store in the repository’s database', () => {
    const db = getRepositoryDatabase({ databaseName: 'github:owner/repo' }, 'file-cache');

    expect(IndexedDB).toHaveBeenCalledWith('github:owner/repo', 'file-cache');
    expect(db).toBeInstanceOf(IndexedDB);
  });

  test('returns undefined without a database name', () => {
    expect(getRepositoryDatabase({ databaseName: '' }, 'file-cache')).toBeUndefined();
    expect(getRepositoryDatabase({}, 'file-cache')).toBeUndefined();
    expect(getRepositoryDatabase(undefined, 'file-cache')).toBeUndefined();
    expect(IndexedDB).not.toHaveBeenCalled();
  });
});
