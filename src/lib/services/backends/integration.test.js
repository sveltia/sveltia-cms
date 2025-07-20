import { get } from 'svelte/store';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { getAssetFoldersByPath } from '$lib/services/assets/folders';
import { getEntryFoldersByPath } from '$lib/services/contents';
import { createFileList } from './process.js';
import { saveChanges } from './save.js';

/**
 * @import {
 * CommitAction,
 * CommitOptions,
 * CommitType,
 * FileChange,
 * } from '$lib/types/private.js'
 */

// Mock all dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(() => ({
    delete: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { update: vi.fn() },
}));

vi.mock('$lib/services/backends', () => ({
  backend: {},
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { update: vi.fn() },
  getEntryFoldersByPath: vi.fn(),
}));

vi.mock('$lib/services/user', () => ({
  user: {},
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {},
}));

vi.mock('$lib/services/utils/file', () => ({
  getBlob: vi.fn(() => ({ size: 1024 })),
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/config', () => ({
  GIT_CONFIG_FILE_REGEX: /^\.git(attributes|keep)$/,
}));

vi.mock('$lib/services/contents/file/process', () => ({
  isIndexFile: vi.fn(),
}));

describe('Backend Services Integration', () => {
  const mockCommitChanges = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    vi.mocked(get).mockImplementation(() => ({
      commitChanges: mockCommitChanges,
      repository: { databaseName: 'test-db' },
      name: 'Test User',
      email: 'test@example.com',
      devModeEnabled: false,
    }));

    mockCommitChanges.mockResolvedValue({
      sha: 'abc123',
      date: new Date('2023-01-01'),
      files: { 'test.md': { sha: 'file123' } },
    });
  });

  describe('createFileList', () => {
    test('should process files correctly', () => {
      vi.mocked(getEntryFoldersByPath).mockReturnValue([]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const files = [
        { path: 'test.md', name: 'test.md', size: 100, sha: 'hash1' },
        { path: '.gitkeep', name: '.gitkeep', size: 0, sha: 'hash2' },
      ];

      const result = createFileList(files);

      expect(result.configFiles).toHaveLength(1);
      expect(result.allFiles).toHaveLength(1);
    });
  });

  describe('saveChanges', () => {
    test('should save changes successfully', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'test.md',
          slug: 'test',
          data: 'content',
        },
      ];

      /** @type {CommitOptions} */
      const options = {
        commitType: /** @type {CommitType} */ ('create'),
      };

      // @ts-ignore - Type issues in test
      const result = await saveChanges({
        changes,
        savingEntries: [],
        savingAssets: [],
        options,
      });

      expect(mockCommitChanges).toHaveBeenCalledWith(changes, options);
      expect(result.commit).toBeDefined();
    });
  });
});
