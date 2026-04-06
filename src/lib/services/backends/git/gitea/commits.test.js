import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { repository } from '$lib/services/backends/git/gitea/repository';

import { commitChanges, fetchFileCommits, fetchLastCommit } from './commits.js';

/**
 * @import { CommitAction, CommitOptions, CommitType, FileChange } from '$lib/types/private';
 */

// Mock dependencies with vi.hoisted to ensure proper hoisting
const getMock = vi.hoisted(() => vi.fn());
const fetchAPIMock = vi.hoisted(() => vi.fn());
const encodeBase64Mock = vi.hoisted(() => vi.fn());
const createCommitMessageMock = vi.hoisted(() => vi.fn());

vi.mock('svelte/store', () => ({
  get: getMock,
}));

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: fetchAPIMock,
}));

vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: encodeBase64Mock,
}));

vi.mock('$lib/services/backends/git/shared/commits', () => ({
  createCommitMessage: createCommitMessageMock,
}));

vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: {
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
  },
}));

vi.mock('$lib/services/user', () => ({
  user: {}, // Mock user store
}));

describe('Gitea Commits Service', () => {
  const mockOwner = 'test-owner';
  const mockRepo = 'test-repo';
  const mockBranch = 'main';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock _ to return a translation function
    // @ts-ignore
    getMock.mockReturnValue((key, options) => {
      switch (key) {
        case 'branch_not_found':
          return `Branch ${options?.values?.branch || 'unknown'} not found in repository ${options?.values?.repo || 'unknown'}`;
        default:
          return key;
      }
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchLastCommit', () => {
    test('should fetch and return last commit information', async () => {
      const mockBranchResponse = {
        commit: {
          id: 'abc123def456',
          message: 'Update README.md',
        },
      };

      fetchAPIMock.mockResolvedValue(mockBranchResponse);

      const result = await fetchLastCommit();

      expect(result).toEqual({
        hash: 'abc123def456',
        message: 'Update README.md',
      });
      expect(fetchAPIMock).toHaveBeenCalledWith(
        `/repos/${mockOwner}/${mockRepo}/branches/${mockBranch}`,
      );
    });

    test('should handle branch not found error', async () => {
      fetchAPIMock.mockRejectedValue(new Error('Branch not found'));

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });

    test('should handle API fetch error', async () => {
      fetchAPIMock.mockRejectedValue(new Error('Network error'));

      await expect(fetchLastCommit()).rejects.toThrow('Failed to retrieve the last commit hash.');
    });

    test('should handle malformed response', async () => {
      const malformedResponse = {
        commit: {}, // Missing id and message
      };

      fetchAPIMock.mockResolvedValue(malformedResponse);

      const result = await fetchLastCommit();

      expect(result).toEqual({
        hash: undefined,
        message: undefined,
      });
    });
  });

  describe('commitChanges', () => {
    beforeEach(() => {
      // Mock user store to return user information
      getMock.mockImplementation((store) => {
        if (store === undefined) {
          // @ts-ignore
          return (key, options) => {
            switch (key) {
              case 'branch_not_found':
                return `Branch ${options?.values?.branch || 'unknown'} not found in repository ${options?.values?.repo || 'unknown'}`;
              default:
                return key;
            }
          };
        }
        // Mock user store

        return {
          name: 'John Doe',
          email: 'john.doe@example.com',
        };
      });

      encodeBase64Mock.mockResolvedValue('base64encodedcontent');
      createCommitMessageMock.mockReturnValue('Add new file');
    });

    test('should commit changes successfully', async () => {
      /** @type {FileChange[]} */
      const mockChanges = [
        {
          action: /** @type {'create'} */ ('create'),
          path: 'content/posts/new-post.md',
          data: '# New Post\n\nContent here',
        },
        {
          action: /** @type {'update'} */ ('update'),
          path: 'content/posts/existing-post.md',
          previousSha: 'old-sha-123',
          data: '# Updated Post\n\nUpdated content',
        },
      ];

      /** @type {CommitOptions} */
      const mockOptions = {
        commitType: 'create',
      };

      const mockCommitResponse = {
        commit: {
          sha: 'new-commit-sha-456',
          created: '2023-01-15T10:30:00Z',
        },
        files: [
          { path: 'content/posts/new-post.md', sha: 'file-sha-789' },
          { path: 'content/posts/existing-post.md', sha: 'file-sha-abc' },
        ],
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(mockChanges, mockOptions);

      expect(result).toEqual({
        sha: 'new-commit-sha-456',
        date: new Date('2023-01-15T10:30:00Z'),
        files: {
          'content/posts/new-post.md': { sha: 'file-sha-789' },
          'content/posts/existing-post.md': { sha: 'file-sha-abc' },
        },
      });

      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}/contents`, {
        method: 'POST',
        body: {
          branch: mockBranch,
          author: { name: 'John Doe', email: 'john.doe@example.com' },
          committer: { name: 'John Doe', email: 'john.doe@example.com' },
          dates: { author: expect.any(String), committer: expect.any(String) },
          message: 'Add new file',
          files: [
            {
              operation: 'create',
              path: 'content/posts/new-post.md',
              content: 'base64encodedcontent',
              from_path: undefined,
              sha: undefined,
            },
            {
              operation: 'update',
              path: 'content/posts/existing-post.md',
              content: 'base64encodedcontent',
              from_path: undefined,
              sha: 'old-sha-123',
            },
          ],
        },
      });

      expect(createCommitMessageMock).toHaveBeenCalledWith(mockChanges, mockOptions);
      expect(encodeBase64Mock).toHaveBeenCalledTimes(2);
    });

    test('should handle move operation correctly', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('move'),
          path: 'content/posts/renamed-post.md',
          previousPath: 'content/posts/old-post.md',
          previousSha: 'move-sha-123',
          data: '# Renamed Post\n\nMoved content',
        },
      ];

      const mockOptions = {
        summary: 'Rename post',
        commitType: /** @type {CommitType} */ ('update'),
      };

      const mockCommitResponse = {
        commit: {
          sha: 'move-commit-sha',
          created: '2023-01-15T11:00:00Z',
        },
        files: [{ path: 'content/posts/renamed-post.md', sha: 'moved-file-sha' }],
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(mockChanges, mockOptions);

      expect(result).toEqual({
        sha: 'move-commit-sha',
        date: new Date('2023-01-15T11:00:00Z'),
        files: {
          'content/posts/renamed-post.md': { sha: 'moved-file-sha' },
        },
      });

      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}/contents`, {
        method: 'POST',
        body: {
          branch: mockBranch,
          author: { name: 'John Doe', email: 'john.doe@example.com' },
          committer: { name: 'John Doe', email: 'john.doe@example.com' },
          dates: { author: expect.any(String), committer: expect.any(String) },
          message: 'Add new file',
          files: [
            {
              operation: 'update', // move becomes update
              path: 'content/posts/renamed-post.md',
              content: 'base64encodedcontent',
              from_path: 'content/posts/old-post.md',
              sha: 'move-sha-123',
            },
          ],
        },
      });
    });

    test('should handle delete operation', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('delete'),
          path: 'content/posts/deleted-post.md',
          previousSha: 'delete-sha-123',
        },
      ];

      const mockOptions = {
        summary: 'Delete post',
        commitType: /** @type {CommitType} */ ('delete'),
      };

      const mockCommitResponse = {
        commit: {
          sha: 'delete-commit-sha',
          created: '2023-01-15T12:00:00Z',
        },
        files: [],
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(mockChanges, mockOptions);

      expect(result).toEqual({
        sha: 'delete-commit-sha',
        date: new Date('2023-01-15T12:00:00Z'),
        files: {},
      });

      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}/contents`, {
        method: 'POST',
        body: {
          branch: mockBranch,
          author: { name: 'John Doe', email: 'john.doe@example.com' },
          committer: { name: 'John Doe', email: 'john.doe@example.com' },
          dates: { author: expect.any(String), committer: expect.any(String) },
          message: 'Add new file',
          files: [
            {
              operation: 'delete',
              path: 'content/posts/deleted-post.md',
              content: 'base64encodedcontent',
              from_path: undefined,
              sha: 'delete-sha-123',
            },
          ],
        },
      });
    });

    test('should handle empty data gracefully', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'content/posts/empty-post.md',
          // data is undefined, should default to ''
        },
      ];

      const mockOptions = {
        summary: 'Create empty file',
        commitType: /** @type {CommitType} */ ('create'),
      };

      const mockCommitResponse = {
        commit: {
          sha: 'empty-commit-sha',
          created: '2023-01-15T13:00:00Z',
        },
        files: [{ path: 'content/posts/empty-post.md', sha: 'empty-file-sha' }],
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      await commitChanges(mockChanges, mockOptions);

      expect(encodeBase64Mock).toHaveBeenCalledWith('');
    });

    test('should handle API error during commit', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'content/posts/new-post.md',
          data: 'content',
        },
      ];

      const mockOptions = {
        summary: 'Add new file',
        commitType: /** @type {CommitType} */ ('create'),
      };

      fetchAPIMock.mockRejectedValue(new Error('Commit failed'));

      await expect(commitChanges(mockChanges, mockOptions)).rejects.toThrow('Commit failed');
    });

    test('should handle multiple file changes in single commit', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'file1.md',
          data: 'content1',
        },
        {
          action: /** @type {CommitAction} */ ('update'),
          path: 'file2.md',
          previousSha: 'sha2',
          data: 'content2',
        },
        {
          action: /** @type {CommitAction} */ ('delete'),
          path: 'file3.md',
          previousSha: 'sha3',
        },
        {
          action: /** @type {CommitAction} */ ('move'),
          path: 'new-file4.md',
          previousPath: 'old-file4.md',
          previousSha: 'sha4',
          data: 'content4',
        },
      ];

      const mockOptions = {
        summary: 'Multiple changes',
        commitType: /** @type {CommitType} */ ('update'),
      };

      const mockCommitResponse = {
        commit: {
          sha: 'multi-commit-sha',
          created: '2023-01-15T14:00:00Z',
        },
        files: [
          { path: 'file1.md', sha: 'new-sha1' },
          { path: 'file2.md', sha: 'new-sha2' },
          { path: 'new-file4.md', sha: 'new-sha4' },
        ],
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(mockChanges, mockOptions);

      expect(result).toEqual({
        sha: 'multi-commit-sha',
        date: new Date('2023-01-15T14:00:00Z'),
        files: {
          'file1.md': { sha: 'new-sha1' },
          'file2.md': { sha: 'new-sha2' },
          'new-file4.md': { sha: 'new-sha4' },
        },
      });

      expect(encodeBase64Mock).toHaveBeenCalledTimes(4);
      expect(fetchAPIMock).toHaveBeenCalledWith(`/repos/${mockOwner}/${mockRepo}/contents`, {
        method: 'POST',
        body: {
          branch: mockBranch,
          author: { name: 'John Doe', email: 'john.doe@example.com' },
          committer: { name: 'John Doe', email: 'john.doe@example.com' },
          dates: { author: expect.any(String), committer: expect.any(String) },
          message: 'Add new file',
          files: [
            {
              operation: 'create',
              path: 'file1.md',
              content: 'base64encodedcontent',
              from_path: undefined,
              sha: undefined,
            },
            {
              operation: 'update',
              path: 'file2.md',
              content: 'base64encodedcontent',
              from_path: undefined,
              sha: 'sha2',
            },
            {
              operation: 'delete',
              path: 'file3.md',
              content: 'base64encodedcontent',
              from_path: undefined,
              sha: 'sha3',
            },
            {
              operation: 'update',
              path: 'new-file4.md',
              content: 'base64encodedcontent',
              from_path: 'old-file4.md',
              sha: 'sha4',
            },
          ],
        },
      });
    });

    test('should handle null values in savedFiles', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'file1.md',
          data: 'content1',
        },
        {
          action: /** @type {CommitAction} */ ('delete'),
          path: 'file2.md',
          previousSha: 'sha2',
        },
        {
          action: /** @type {CommitAction} */ ('update'),
          path: 'file3.md',
          previousSha: 'sha3',
          data: 'content3',
        },
      ];

      const mockOptions = {
        summary: 'Mixed operations',
        commitType: /** @type {CommitType} */ ('update'),
      };

      const mockCommitResponse = {
        commit: {
          sha: 'null-file-commit-sha',
          created: '2023-01-15T15:00:00Z',
        },
        files: [
          { path: 'file1.md', sha: 'new-sha1' },
          null, // Deleted file returns null
          { path: 'file3.md', sha: 'new-sha3' },
        ],
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(mockChanges, mockOptions);

      expect(result).toEqual({
        sha: 'null-file-commit-sha',
        date: new Date('2023-01-15T15:00:00Z'),
        files: {
          'file1.md': { sha: 'new-sha1' },
          'file2.md': { sha: '' }, // null file uses fallback path and empty sha
          'file3.md': { sha: 'new-sha3' },
        },
      });
    });

    test('should handle all null savedFiles entries', async () => {
      const mockChanges = [
        {
          action: /** @type {CommitAction} */ ('delete'),
          path: 'file1.md',
          previousSha: 'sha1',
        },
        {
          action: /** @type {CommitAction} */ ('delete'),
          path: 'file2.md',
          previousSha: 'sha2',
        },
      ];

      const mockOptions = {
        summary: 'Delete multiple files',
        commitType: /** @type {CommitType} */ ('delete'),
      };

      const mockCommitResponse = {
        commit: {
          sha: 'delete-all-sha',
          created: '2023-01-15T16:00:00Z',
        },
        files: [null, null], // All deleted files return null
      };

      fetchAPIMock.mockResolvedValue(mockCommitResponse);

      const result = await commitChanges(mockChanges, mockOptions);

      expect(result).toEqual({
        sha: 'delete-all-sha',
        date: new Date('2023-01-15T16:00:00Z'),
        files: {
          'file1.md': { sha: '' },
          'file2.md': { sha: '' },
        },
      });
    });
  });

  describe('fetchFileCommits', () => {
    test('fetches and returns commits for a single path', async () => {
      fetchAPIMock.mockResolvedValue([
        {
          sha: 'abc123',
          commit: {
            author: { name: 'Alice', email: 'alice@example.com', date: '2024-06-01T12:00:00Z' },
          },
          author: { avatar_url: 'https://example.com/alice.png', login: 'alice' },
        },
        {
          sha: 'def456',
          commit: {
            author: { name: 'Bob', email: 'bob@example.com', date: '2024-05-01T10:00:00Z' },
          },
          author: { avatar_url: 'https://example.com/bob.png', login: 'bob' },
        },
      ]);

      const result = await fetchFileCommits(['content/en/post.md']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sha: 'abc123',
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        authorAvatarURL: 'https://example.com/alice.png',
        authorLogin: 'alice',
        date: new Date('2024-06-01T12:00:00Z'),
      });
      expect(result[1]).toEqual({
        sha: 'def456',
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        authorAvatarURL: 'https://example.com/bob.png',
        authorLogin: 'bob',
        date: new Date('2024-05-01T10:00:00Z'),
      });
      expect(fetchAPIMock).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/commits?sha=main&path=content%2Fen%2Fpost.md&limit=100',
      );
    });

    test('deduplicates commits across multiple paths', async () => {
      fetchAPIMock
        .mockResolvedValueOnce([
          {
            sha: 'abc123',
            commit: { author: { name: 'Alice', email: 'a@t.com', date: '2024-06-01T12:00:00Z' } },
            author: { avatar_url: '', login: 'alice' },
          },
        ])
        .mockResolvedValueOnce([
          {
            sha: 'abc123',
            commit: { author: { name: 'Alice', email: 'a@t.com', date: '2024-06-01T12:00:00Z' } },
            author: { avatar_url: '', login: 'alice' },
          },
          {
            sha: 'xyz789',
            commit: { author: { name: 'Carol', email: 'c@t.com', date: '2024-04-01T08:00:00Z' } },
            author: { avatar_url: '', login: 'carol' },
          },
        ]);

      const result = await fetchFileCommits(['content/en/post.md', 'content/fr/post.md']);

      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('abc123');
      expect(result[1].sha).toBe('xyz789');
    });

    test('returns sorted commits in descending date order', async () => {
      fetchAPIMock.mockResolvedValue([
        {
          sha: 'oldest',
          commit: { author: { name: 'A', email: 'a@t.com', date: '2024-01-01T00:00:00Z' } },
          author: { avatar_url: '', login: 'a' },
        },
        {
          sha: 'newest',
          commit: { author: { name: 'B', email: 'b@t.com', date: '2024-12-01T00:00:00Z' } },
          author: { avatar_url: '', login: 'b' },
        },
      ]);

      const result = await fetchFileCommits(['file.md']);

      expect(result[0].sha).toBe('newest');
      expect(result[1].sha).toBe('oldest');
    });

    test('handles missing commit author fields gracefully', async () => {
      fetchAPIMock.mockResolvedValue([
        {
          sha: 'no-author',
          commit: { author: null },
          author: null,
          created: '2024-03-01T00:00:00Z',
        },
      ]);

      const result = await fetchFileCommits(['file.md']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sha: 'no-author',
        authorName: '',
        authorEmail: undefined,
        authorAvatarURL: undefined,
        authorLogin: undefined,
        date: new Date('2024-03-01T00:00:00Z'),
      });
    });

    test('handles empty response', async () => {
      fetchAPIMock.mockResolvedValue([]);

      const result = await fetchFileCommits(['file.md']);

      expect(result).toEqual([]);
    });

    test('handles undefined branch (uses empty string fallback)', async () => {
      repository.branch = undefined;
      fetchAPIMock.mockResolvedValue([]);

      await fetchFileCommits(['file.md']);

      expect(fetchAPIMock).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/commits?sha=&path=file.md&limit=100',
      );

      repository.branch = 'main';
    });
  });
});
