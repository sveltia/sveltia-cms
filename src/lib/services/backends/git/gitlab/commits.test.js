import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges, fetchLastCommit } from '$lib/services/backends/git/gitlab/commits';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { getGitHash } from '$lib/services/utils/file';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
  readonly: vi.fn(() => ({ subscribe: vi.fn() })),
}));
vi.mock('svelte-i18n', () => ({
  addMessages: vi.fn(),
  init: vi.fn(),
  locale: { subscribe: vi.fn() },
  dictionary: { subscribe: vi.fn() },
  _: vi.fn(),
}));
vi.mock('$lib/services/backends/git/gitlab/repository', () => ({
  repository: {
    repo: 'test-repo',
    branch: 'main',
    owner: 'test-owner',
  },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/commits');
vi.mock('$lib/services/utils/file', () => ({
  getGitHash: vi.fn(),
}));
vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn().mockResolvedValue('base64encodedcontent=='),
}));

describe('GitLab commits service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock translation function
    vi.mocked(get).mockReturnValue((/** @type {any} */ key, /** @type {any} */ options) => {
      if (key === 'repository_not_found') {
        return `Repository ${options?.values?.repo} not found`;
      }

      if (key === 'branch_not_found') {
        return `Branch ${options?.values?.branch} not found in ${options?.values?.repo}`;
      }

      return key;
    });
  });

  describe('fetchLastCommit', () => {
    test('returns last commit hash and message successfully', async () => {
      const mockResponse = {
        project: {
          repository: {
            tree: {
              lastCommit: {
                sha: 'abc123',
                message: 'Test commit message',
              },
            },
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      const result = await fetchLastCommit();

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('query($fullPath: ID!, $branch: String!)'),
      );
      expect(result).toEqual({
        hash: 'abc123',
        message: 'Test commit message',
      });
    });

    test('throws error when project is not found', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ project: null });

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });

    test('throws error when branch is not found', async () => {
      const mockResponse = {
        project: {
          repository: {
            tree: null,
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });

    test('throws error when lastCommit is not found', async () => {
      const mockResponse = {
        project: {
          repository: {
            tree: {},
          },
        },
      };

      vi.mocked(fetchGraphQL).mockResolvedValue(mockResponse);

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });
  });

  describe('commitChanges', () => {
    test('commits text files successfully', async () => {
      const changes = /** @type {any} */ ([
        {
          action: 'create',
          path: 'test.md',
          data: 'Test content',
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'create',
        collection: { name: 'posts' },
      });

      const mockCommitResponse = {
        id: 'commit123',
        committed_date: '2023-01-01T12:00:00Z',
      };

      vi.mocked(createCommitMessage).mockReturnValue('Create new post');
      vi.mocked(fetchAPI).mockResolvedValue(mockCommitResponse);
      vi.mocked(getGitHash).mockResolvedValue('file123');

      const result = await commitChanges(changes, options);

      expect(fetchAPI).toHaveBeenCalledWith('/projects/test-owner%2Ftest-repo/repository/commits', {
        method: 'POST',
        body: {
          branch: 'main',
          commit_message: 'Create new post',
          actions: [
            {
              action: 'create',
              content: 'Test content',
              encoding: 'text',
              file_path: 'test.md',
              previous_path: undefined,
            },
          ],
        },
      });

      expect(result).toEqual({
        sha: 'commit123',
        date: new Date('2023-01-01T12:00:00Z'),
        files: {
          'test.md': { sha: 'file123' },
        },
      });
    });

    test('commits binary files successfully', async () => {
      const mockBinaryData = new Uint8Array([1, 2, 3, 4]);

      const changes = /** @type {any} */ ([
        {
          action: 'create',
          path: 'image.png',
          data: mockBinaryData,
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'uploadMedia',
        collection: { name: 'uploads' },
      });

      const mockCommitResponse = {
        id: 'commit456',
        committed_date: '2023-01-01T13:00:00Z',
      };

      vi.mocked(createCommitMessage).mockReturnValue('Upload image');
      vi.mocked(fetchAPI).mockResolvedValue(mockCommitResponse);
      vi.mocked(getGitHash).mockResolvedValue('image456');

      // Mock base64 encoding
      const mockEncodeBase64 = vi.fn().mockResolvedValue('AQIDBA==');

      vi.doMock('@sveltia/utils/file', () => ({
        encodeBase64: mockEncodeBase64,
      }));

      const result = await commitChanges(changes, options);

      expect(result).toEqual({
        sha: 'commit456',
        date: new Date('2023-01-01T13:00:00Z'),
        files: {
          'image.png': { sha: 'image456' },
        },
      });
    });

    test('handles update actions with previous_path', async () => {
      const changes = /** @type {any} */ ([
        {
          action: 'move',
          path: 'new-file.md',
          previousPath: 'old-file.md',
          data: 'Updated content',
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'update',
        collection: { name: 'posts' },
      });

      const mockCommitResponse = {
        id: 'commit789',
        committed_date: '2023-01-01T14:00:00Z',
      };

      vi.mocked(createCommitMessage).mockReturnValue('Move file');
      vi.mocked(fetchAPI).mockResolvedValue(mockCommitResponse);
      vi.mocked(getGitHash).mockResolvedValue('moved123');

      const result = await commitChanges(changes, options);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/commits',
        expect.objectContaining({
          body: expect.objectContaining({
            actions: [
              expect.objectContaining({
                action: 'move',
                previous_path: 'old-file.md',
                file_path: 'new-file.md',
              }),
            ],
          }),
        }),
      );

      expect(result.files).toEqual({
        'new-file.md': { sha: 'moved123' },
      });
    });

    test('handles delete actions without data', async () => {
      const changes = /** @type {any} */ ([
        {
          action: 'delete',
          path: 'to-delete.md',
        },
      ]);

      const options = /** @type {any} */ ({
        commitType: 'delete',
        collection: { name: 'posts' },
      });

      const mockCommitResponse = {
        id: 'commit999',
        committed_date: '2023-01-01T15:00:00Z',
      };

      vi.mocked(createCommitMessage).mockReturnValue('Delete file');
      vi.mocked(fetchAPI).mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(changes, options);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/commits',
        expect.objectContaining({
          body: expect.objectContaining({
            actions: [
              expect.objectContaining({
                action: 'delete',
                file_path: 'to-delete.md',
                content: '',
                encoding: 'text',
              }),
            ],
          }),
        }),
      );

      expect(result.files).toEqual({});
    });
  });
});
