import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/gitlab/commits';
import { repository } from '$lib/services/backends/git/gitlab/repository';
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
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
  locale: { current: 'en', set: vi.fn() },
  dictionary: {},
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

  describe('fetchFileCommits', () => {
    test('fetches and returns commits with resolved avatars', async () => {
      vi.mocked(fetchAPI)
        // Commit list request
        .mockResolvedValueOnce([
          {
            id: 'abc123',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            committed_date: '2024-06-01T12:00:00Z',
          },
          {
            id: 'def456',
            author_name: 'Bob',
            author_email: 'bob@example.com',
            committed_date: '2024-05-01T10:00:00Z',
          },
        ])
        // Avatar requests (one per unique email)
        .mockResolvedValueOnce({ avatar_url: 'https://example.com/alice.png' })
        .mockResolvedValueOnce({ avatar_url: 'https://example.com/bob.png' });

      const result = await fetchFileCommits(['content/en/post.md']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sha: 'abc123',
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        authorAvatarURL: 'https://example.com/alice.png',
        date: new Date('2024-06-01T12:00:00Z'),
      });
      expect(result[1]).toEqual({
        sha: 'def456',
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        authorAvatarURL: 'https://example.com/bob.png',
        date: new Date('2024-05-01T10:00:00Z'),
      });
      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/commits' +
          '?ref_name=main&path=content%2Fen%2Fpost.md&per_page=100',
      );
      expect(fetchAPI).toHaveBeenCalledWith('/avatar?email=alice%40example.com&size=48');
      expect(fetchAPI).toHaveBeenCalledWith('/avatar?email=bob%40example.com&size=48');
    });

    test('deduplicates commits across multiple paths', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce([
          {
            id: 'abc123',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            committed_date: '2024-06-01T12:00:00Z',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'abc123',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            committed_date: '2024-06-01T12:00:00Z',
          },
          {
            id: 'xyz789',
            author_name: 'Carol',
            author_email: 'carol@example.com',
            committed_date: '2024-04-01T08:00:00Z',
          },
        ])
        // Avatar requests
        .mockResolvedValueOnce({ avatar_url: 'https://example.com/alice.png' })
        .mockResolvedValueOnce({ avatar_url: 'https://example.com/carol.png' });

      const result = await fetchFileCommits(['content/en/post.md', 'content/fr/post.md']);

      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('abc123');
      expect(result[1].sha).toBe('xyz789');
    });

    test('returns sorted commits in descending date order', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce([
          {
            id: 'oldest',
            author_name: 'A',
            author_email: 'a@test.com',
            committed_date: '2024-01-01T00:00:00Z',
          },
          {
            id: 'newest',
            author_name: 'B',
            author_email: 'b@test.com',
            committed_date: '2024-12-01T00:00:00Z',
          },
        ])
        .mockResolvedValueOnce({ avatar_url: '' })
        .mockResolvedValueOnce({ avatar_url: '' });

      const result = await fetchFileCommits(['file.md']);

      expect(result[0].sha).toBe('newest');
      expect(result[1].sha).toBe('oldest');
    });

    test('handles empty response', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([]);

      const result = await fetchFileCommits(['file.md']);

      expect(result).toEqual([]);
    });

    test('handles avatar fetch failure gracefully', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce([
          {
            id: 'abc123',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            committed_date: '2024-06-01T12:00:00Z',
          },
        ])
        // Avatar request fails
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchFileCommits(['file.md']);

      expect(result).toHaveLength(1);
      expect(result[0].authorAvatarURL).toBeUndefined();
    });

    test('handles undefined branch (uses empty string fallback)', async () => {
      repository.branch = undefined;
      vi.mocked(fetchAPI).mockResolvedValue([]);

      await fetchFileCommits(['file.md']);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/commits' +
          '?ref_name=&path=file.md&per_page=100',
      );

      repository.branch = 'main';
    });
  });
});
