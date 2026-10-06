import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  _resetAvatarURLCache,
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/gitlab/commits';
import { repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { getGitHash } from '$lib/services/utils/file';
import { forkedRepository, openAuthoring } from '$lib/services/workflow/open-authoring';

// Mock dependencies
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
  locale: { current: 'en', set: vi.fn() },
  dictionary: {},
}));
vi.mock('$lib/services/backends/git/gitlab/fork', () => ({ projectIds: { base: 42 } }));
vi.mock('$lib/services/backends/git/gitlab/repository', () => {
  const mockRepository = { repo: 'test-repo', branch: 'main', owner: 'test-owner' };

  return {
    repository: mockRepository,
    /**
     * Get the project ID the same way the real module does.
     * @param {any} [repoPath] Project to address. Default: the configured project.
     * @returns {string} URL-encoded project path.
     */
    getProjectId: ({ owner, repo } = mockRepository) => encodeURIComponent(`${owner}/${repo}`),
  };
});
vi.mock('$lib/services/workflow/open-authoring', () => ({
  forkedRepository: { current: undefined },
  openAuthoring: { current: false },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/commits', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  createCommitMessage: vi.fn(),
}));
vi.mock('$lib/services/backends/git/shared/fetch', () => ({
  repositoryHead: { current: '' },
}));
vi.mock('$lib/services/utils/file', () => ({
  getGitHash: vi.fn(),
}));
vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn().mockResolvedValue('base64encodedcontent=='),
}));

describe('GitLab commits service', () => {
  beforeEach(() => {
    forkedRepository.current = undefined;
    /** @type {any} */ (openAuthoring).current = false;
    vi.clearAllMocks();
    _resetAvatarURLCache();
    repositoryHead.current = '';
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
    /**
     * Create minimal change and option objects for the `start_branch` tests.
     * @returns {any[]} Changes and options.
     */
    const createStartBranchArgs = () => [
      /** @type {any} */ ([{ action: 'create', path: 'test.md', data: 'x' }]),
      /** @type {any} */ ({ commitType: 'create', branch: 'cms/posts/hello', startBranch: 'main' }),
    ];

    describe('Open Authoring', () => {
      /**
       * Pretend the signed-in user is contributing through the given fork.
       * @param {any} fork Fork, or `undefined` to sign in as a maintainer.
       */
      const signInAs = (fork) => {
        forkedRepository.current = fork;
        /** @type {any} */ (openAuthoring).current = !!fork;
      };

      test('refuses to commit straight to the configured branch', async () => {
        signInAs({ owner: 'contributor', repo: 'test-repo' });

        const changes = /** @type {any} */ ([{ action: 'create', path: 'test.md', data: 'x' }]);

        await expect(
          commitChanges(changes, /** @type {any} */ ({ commitType: 'create' })),
        ).rejects.toThrow('Cannot commit directly to the configured repository');

        expect(fetchAPI).not.toHaveBeenCalled();
      });

      test('commits to the fork, branching off the configured project', async () => {
        signInAs({ owner: 'contributor', repo: 'test-repo' });

        const [changes, options] = createStartBranchArgs();

        vi.mocked(createCommitMessage).mockReturnValue('Create new post');
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01T12:00:00Z' });
        vi.mocked(getGitHash).mockResolvedValue('file123');

        await commitChanges(changes, options);

        expect(fetchAPI).toHaveBeenCalledWith(
          '/projects/contributor%2Ftest-repo/repository/commits',
          expect.objectContaining({
            body: expect.objectContaining({
              branch: 'cms/posts/hello',
              start_branch: 'main',
              // The branch starts from the configured project rather than the fork’s copy of it,
              // named by its ID: an encoded path in the body would name no project
              start_project: 42,
            }),
          }),
        );
      });

      test('leaves the start project out for a maintainer', async () => {
        signInAs(undefined);

        const [changes, options] = createStartBranchArgs();

        vi.mocked(createCommitMessage).mockReturnValue('Create new post');
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01T12:00:00Z' });
        vi.mocked(getGitHash).mockResolvedValue('file123');

        await commitChanges(changes, options);

        expect(fetchAPI).toHaveBeenCalledWith(
          '/projects/test-owner%2Ftest-repo/repository/commits',
          expect.objectContaining({
            body: expect.not.objectContaining({ start_project: expect.anything() }),
          }),
        );
      });
    });

    test('creates the branch along with the commit when a start branch is given', async () => {
      const [changes, options] = createStartBranchArgs();

      vi.mocked(createCommitMessage).mockReturnValue('Create new post');
      vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01T12:00:00Z' });
      vi.mocked(getGitHash).mockResolvedValue('file123');

      const result = await commitChanges(changes, options);

      expect(fetchAPI).toHaveBeenCalledTimes(1);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/commits',
        expect.objectContaining({
          body: expect.objectContaining({ branch: 'cms/posts/hello', start_branch: 'main' }),
        }),
      );

      expect(result.sha).toBe('c1');
    });

    test('rethrows a rejected start branch, which is the caller’s to sort out', async () => {
      const [changes, options] = createStartBranchArgs();

      vi.mocked(createCommitMessage).mockReturnValue('Create new post');
      // GitLab rejects `start_branch` outright once the branch is there. Only the Editorial
      // Workflow service can tell whether the branch is a leftover or someone’s work in progress
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('A branch called “cms/posts/hello” already exists', { cause: { status: 400 } }),
      );

      await expect(commitChanges(changes, options)).rejects.toThrow('already exists');
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('rethrows a failure when no start branch was requested', async () => {
      const changes = /** @type {any} */ ([{ action: 'create', path: 'test.md', data: 'x' }]);
      const options = /** @type {any} */ ({ commitType: 'create', branch: 'cms/posts/hello' });

      vi.mocked(createCommitMessage).mockReturnValue('Create new post');
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Bad Request', { cause: { status: 400 } }));

      await expect(commitChanges(changes, options)).rejects.toThrow('Bad Request');
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

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

    describe('guard against a concurrent push', () => {
      const changes = /** @type {any} */ ([
        { action: 'create', path: 'new.md', data: 'x' },
        { action: 'update', path: 'updated.md', data: 'x' },
        { action: 'move', path: 'moved.md', previousPath: 'old.md', data: 'x' },
        { action: 'delete', path: 'deleted.md' },
      ]);

      /**
       * Mock the response of the last commit lookup.
       * @param {string} sha Commit SHA.
       * @returns {any} Response.
       */
      const lastCommitResponse = (sha) => ({
        project: { repository: { tree: { lastCommit: { sha, message: '' } } } },
      });

      const changedFileError = new Error('Server responded with an error', {
        cause: { status: 400, message: 'The file has changed since you started editing it' },
      });

      beforeEach(() => {
        repositoryHead.current = 'loaded-head-sha';
        vi.mocked(createCommitMessage).mockReturnValue('Update');
        vi.mocked(getGitHash).mockResolvedValue('file123');
      });

      test('sends the loaded head as the last commit of each existing file', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01' });

        await commitChanges(changes, /** @type {any} */ ({ commitType: 'update' }));

        const { body } = /** @type {any} */ (vi.mocked(fetchAPI).mock.calls[0][1]);

        expect(body.actions.map((/** @type {any} */ a) => a.last_commit_id)).toEqual([
          undefined,
          'loaded-head-sha',
          'loaded-head-sha',
          'loaded-head-sha',
        ]);
        expect(body.actions[0]).not.toHaveProperty('last_commit_id');
      });

      test('sends no last commit to a workflow branch', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01' });

        await commitChanges(
          changes,
          /** @type {any} */ ({ commitType: 'update', branch: 'cms/posts/a' }),
        );

        const { body } = /** @type {any} */ (vi.mocked(fetchAPI).mock.calls[0][1]);

        body.actions.forEach((/** @type {any} */ a) => {
          expect(a).not.toHaveProperty('last_commit_id');
        });
      });

      test('sends no last commit before the site data is loaded', async () => {
        repositoryHead.current = '';
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01' });

        await commitChanges(changes, /** @type {any} */ ({ commitType: 'update' }));

        const { body } = /** @type {any} */ (vi.mocked(fetchAPI).mock.calls[0][1]);

        body.actions.forEach((/** @type {any} */ a) => {
          expect(a).not.toHaveProperty('last_commit_id');
        });
      });

      test('reports a commit refused because the branch has moved', async () => {
        vi.mocked(fetchAPI).mockRejectedValue(changedFileError);
        vi.mocked(fetchGraphQL).mockResolvedValue(lastCommitResponse('someone-elses-sha'));

        await expect(
          commitChanges(changes, /** @type {any} */ ({ commitType: 'update' })),
        ).rejects.toThrow('The branch has moved since the site data was loaded.');
      });

      test('passes the failure on when the head is where it was expected', async () => {
        vi.mocked(fetchAPI).mockRejectedValue(changedFileError);
        vi.mocked(fetchGraphQL).mockResolvedValue(lastCommitResponse('loaded-head-sha'));

        await expect(
          commitChanges(changes, /** @type {any} */ ({ commitType: 'update' })),
        ).rejects.toBe(changedFileError);
      });

      test('passes the failure on when the head can’t be looked up afterwards', async () => {
        vi.mocked(fetchAPI).mockRejectedValue(changedFileError);
        vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Failed to send the request'));

        await expect(
          commitChanges(changes, /** @type {any} */ ({ commitType: 'update' })),
        ).rejects.toBe(changedFileError);
      });

      test('passes any other failure on without a head lookup', async () => {
        const serverError = new Error('Server responded with an error', { cause: { status: 500 } });

        vi.mocked(fetchAPI).mockRejectedValue(serverError);

        await expect(
          commitChanges(changes, /** @type {any} */ ({ commitType: 'update' })),
        ).rejects.toBe(serverError);
        expect(fetchGraphQL).not.toHaveBeenCalled();
      });
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

    test('looks each avatar up only once, unless the lookup failed', async () => {
      const commits = [
        {
          id: 'abc123',
          author_name: 'Alice',
          author_email: 'alice@example.com',
          committed_date: '2024-06-01T12:00:00Z',
        },
      ];

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(commits)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(commits)
        .mockResolvedValueOnce({ avatar_url: 'https://example.com/alice.png' })
        .mockResolvedValueOnce(commits);

      expect((await fetchFileCommits(['file.md']))[0].authorAvatarURL).toBeUndefined();
      // The failed lookup is made again
      expect((await fetchFileCommits(['file.md']))[0].authorAvatarURL).toBe(
        'https://example.com/alice.png',
      );
      // A successful one isn’t
      expect((await fetchFileCommits(['file.md']))[0].authorAvatarURL).toBe(
        'https://example.com/alice.png',
      );
      expect(fetchAPI).toHaveBeenCalledTimes(5);
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
