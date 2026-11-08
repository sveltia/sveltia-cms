import { encodeBase64 } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { saveProgress } from '$lib/services/backends/commit-progress';
import {
  _resetAvatarURLCache,
  _resetLandedPaths,
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/gitlab/commits';
import { repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { fetchAPIOrUndefined } from '$lib/services/backends/git/shared/api-optional';
import {
  createCommitMessage,
  signOffCommitMessage,
} from '$lib/services/backends/git/shared/commits';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { getGitHash } from '$lib/services/utils/file';
import { forkedRepository, openAuthoring } from '$lib/services/workflow/open-authoring';

// Mock dependencies
vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ locale: 'en', exports: { dictionary: {} } }),
);
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
    /**
     * Get the branch path the same way the real module does.
     * @param {string} branch Branch name.
     * @param {any} [repoPath] Project holding the branch. Default: the configured project.
     * @returns {string} Path.
     */
    getBranchPath: (branch, { owner, repo } = mockRepository) =>
      `/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/branches/${branch}`,
    /**
     * Fetch the branch head the same way the real module does.
     * @param {string} branch Branch name.
     * @param {any} [repoPath] Project holding the branch. Default: the configured project.
     * @returns {Promise<string | undefined>} Commit SHA.
     */
    fetchProjectBranchHead: async (branch, { owner, repo } = mockRepository) => {
      const { fetchAPIOrUndefined: fetchOptional } =
        await import('$lib/services/backends/git/shared/api-optional');

      return /** @type {any} */ (
        await fetchOptional(
          `/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/branches/${branch}`,
        )
      )?.commit?.id;
    },
  };
});
vi.mock('$lib/services/workflow/open-authoring', () => ({
  forkedRepository: { current: undefined },
  openAuthoring: { current: false },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/api-optional');
vi.mock('$lib/services/backends/git/shared/commits', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  createCommitMessage: vi.fn(),
  signOffCommitMessage: vi.fn((message) => message),
}));
vi.mock('$lib/services/backends/git/shared/head', () => ({
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

      test('sends the signed-off commit message', async () => {
        signInAs(undefined);

        const [changes, options] = createStartBranchArgs();
        const signedOff = 'Create new post\n\nSigned-off-by: Test User <test@example.com>';

        vi.mocked(createCommitMessage).mockReturnValue('Create new post');
        vi.mocked(signOffCommitMessage).mockReturnValueOnce(signedOff);
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01T12:00:00Z' });
        vi.mocked(getGitHash).mockResolvedValue('file123');

        await commitChanges(changes, options);

        expect(signOffCommitMessage).toHaveBeenCalledWith('Create new post');
        expect(fetchAPI).toHaveBeenCalledWith(
          '/projects/test-owner%2Ftest-repo/repository/commits',
          expect.objectContaining({
            body: expect.objectContaining({ commit_message: signedOff }),
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
        retryable: true,
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

    test('deletes and creates a replaced binary file, and moves one without content, to keep it in LFS', async () => {
      repositoryHead.current = 'loaded-head-sha';

      const changes = /** @type {any} */ ([
        { action: 'update', path: 'images/a.jpg', data: new Blob(['a']) },
        {
          action: 'move',
          path: 'images/c.jpg',
          previousPath: 'images/b.jpg',
          data: new Blob(['b']),
        },
        { action: 'update', path: 'posts/d.md', data: 'text' },
      ]);

      vi.mocked(createCommitMessage).mockReturnValue('Update');
      vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01' });
      vi.mocked(getGitHash).mockResolvedValue('file123');

      const result = await commitChanges(changes, /** @type {any} */ ({ commitType: 'update' }));
      const { body } = /** @type {any} */ (vi.mocked(fetchAPI).mock.calls[0][1]);

      // The moved image keeps its content, which GitLab takes from the existing blob, so the
      // move has none, and it goes last, after the entries
      expect(body.actions).toEqual([
        { action: 'delete', file_path: 'images/a.jpg', last_commit_id: 'loaded-head-sha' },
        {
          action: 'create',
          content: 'base64encodedcontent==',
          encoding: 'base64',
          file_path: 'images/a.jpg',
        },
        {
          action: 'update',
          content: 'text',
          encoding: 'text',
          file_path: 'posts/d.md',
          last_commit_id: 'loaded-head-sha',
        },
        {
          action: 'move',
          file_path: 'images/c.jpg',
          previous_path: 'images/b.jpg',
          last_commit_id: 'loaded-head-sha',
        },
      ]);
      expect(Object.keys(result.files)).toEqual(['images/a.jpg', 'images/c.jpg', 'posts/d.md']);
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
            actions: [{ action: 'delete', file_path: 'to-delete.md' }],
          }),
        }),
      );

      expect(result.files).toEqual({});
    });

    test('moves a file without content when the change carries none', async () => {
      // A nested collection moves an entry’s files without rewriting them
      vi.mocked(createCommitMessage).mockReturnValue('Move');
      vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01' });

      await commitChanges(
        /** @type {any} */ ([{ action: 'move', path: 'b/index.md', previousPath: 'a/index.md' }]),
        /** @type {any} */ ({ commitType: 'update' }),
      );

      const { body } = /** @type {any} */ (vi.mocked(fetchAPI).mock.calls[0][1]);

      expect(body.actions).toEqual([
        { action: 'move', file_path: 'b/index.md', previous_path: 'a/index.md' },
      ]);
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

      test('reports the parent the commit has been made on top of', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({
          id: 'c1',
          committed_date: '2023-01-01',
          parent_ids: ['colleague-sha'],
        });

        const result = await commitChanges(changes, /** @type {any} */ ({ commitType: 'update' }));

        // Someone else’s commit to another file doesn’t stop this one, which lands on top of it
        expect(result.parentSha).toBe('colleague-sha');
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

      test('sends the merge request head as the last commit to a workflow branch', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({ id: 'c1', committed_date: '2023-01-01' });

        await commitChanges(
          changes,
          /** @type {any} */ ({ commitType: 'update', branch: 'cms/posts/a', headOid: 'mr-head' }),
        );

        const { body } = /** @type {any} */ (vi.mocked(fetchAPI).mock.calls[0][1]);

        expect(body.branch).toBe('cms/posts/a');
        expect(body.actions.map((/** @type {any} */ a) => a.last_commit_id)).toEqual([
          undefined,
          'mr-head',
          'mr-head',
          'mr-head',
        ]);
      });

      test('leaves a refused workflow commit to the workflow service', async () => {
        vi.mocked(fetchAPI).mockRejectedValue(changedFileError);

        await expect(
          commitChanges(
            changes,
            /** @type {any} */ ({
              commitType: 'update',
              branch: 'cms/posts/a',
              headOid: 'mr-head',
            }),
          ),
        ).rejects.toBe(changedFileError);
        expect(fetchGraphQL).not.toHaveBeenCalled();
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

  describe('commitChanges with a large changeset', () => {
    const MB = 1024 * 1024;
    /**
     * Make an image change of the given size.
     * @param {string} path File path.
     * @param {number} size Size in bytes.
     * @returns {any} Change.
     */
    const image = (path, size) => ({ action: 'create', path, data: { size } });

    /**
     * Get the bodies of the commit requests made.
     * @returns {any[]} Request bodies.
     */
    const getBodies = () =>
      vi.mocked(fetchAPI).mock.calls.map(([, init]) => /** @type {any} */ (init).body);

    /**
     * Get the actions of each commit request made, as action and path pairs.
     * @returns {string[][][]} Actions.
     */
    const getActions = () =>
      getBodies().map(({ actions }) =>
        actions.map((/** @type {any} */ { action, file_path: path }) => [action, path]),
      );

    /**
     * Answer each commit request with a new commit on top of the previous one.
     * @param {Record<number, string>} [parents] Parent of the commit at the given index, if it’s
     * not the previous commit.
     */
    const mockCommits = (parents = {}) => {
      let index = 0;

      vi.mocked(fetchAPI).mockImplementation(async () => {
        index += 1;

        return {
          id: `c${index}`,
          committed_date: '2026-11-01T12:00:00Z',
          parent_ids: [parents[index] ?? (index === 1 ? 'head0' : `c${index - 1}`)],
        };
      });
    };

    const uploadFailure = new Error('Failed to send the request');

    beforeEach(() => {
      // The encoded size follows the file size, so the commits can be sized
      vi.mocked(encodeBase64).mockImplementation(async (blob) =>
        'x'.repeat(/** @type {any} */ (blob).size),
      );
      vi.mocked(createCommitMessage).mockReturnValue('Create gallery');
      vi.mocked(getGitHash).mockResolvedValue('hash');
      repositoryHead.current = 'head0';
      _resetLandedPaths();
    });

    test('splits the changes into several commits, with the entry and deletions last', async () => {
      mockCommits();

      const result = await commitChanges(
        /** @type {any} */ ([
          { action: 'update', path: 'gallery/x/index.md', data: '+++\n+++' },
          image('gallery/x/001.jpg', 40 * MB),
          image('gallery/x/002.jpg', 40 * MB),
          { action: 'delete', path: 'gallery/x/old.jpg' },
        ]),
        /** @type {any} */ ({ commitType: 'update' }),
      );

      // Two images don’t fit in a single commit
      expect(getActions()).toEqual([
        [['create', 'gallery/x/001.jpg']],
        [
          ['create', 'gallery/x/002.jpg'],
          ['update', 'gallery/x/index.md'],
          ['delete', 'gallery/x/old.jpg'],
        ],
      ]);
      // The files are checked against the head the site data was loaded at, not the previous
      // commit, which would be on top of a colleague’s change made in the meantime
      expect(getBodies()[1].actions[1].last_commit_id).toBe('head0');
      expect(getBodies()[1].actions[2].last_commit_id).toBe('head0');
      expect(result.sha).toBe('c2');
      expect(result.parentSha).toBe('head0');
      expect(Object.keys(result.files)).toHaveLength(3);
      expect(saveProgress.current).toBeUndefined();
    });

    test('reports a colleague’s commit that came in between two commits', async () => {
      mockCommits({ 2: 'colleague' });

      const result = await commitChanges(
        /** @type {any} */ ([image('a.jpg', 40 * MB), image('b.jpg', 40 * MB)]),
        /** @type {any} */ ({ commitType: 'uploadMedia' }),
      );

      expect(result.parentSha).toBe('colleague');
    });

    test('only creates the branch with the first commit', async () => {
      mockCommits();

      await commitChanges(
        /** @type {any} */ ([image('a.jpg', 40 * MB), image('b.jpg', 40 * MB)]),
        /** @type {any} */ ({ commitType: 'create', branch: 'cms/x', startBranch: 'main' }),
      );

      expect(getBodies().map(({ start_branch: startBranch }) => startBranch)).toEqual([
        'main',
        undefined,
      ]);
    });

    test('moves an image in the last commit, before a file created at the path it frees', async () => {
      mockCommits();

      await commitChanges(
        /** @type {any} */ ([
          { ...image('b.jpg', 40 * MB), action: 'move', previousPath: 'a.jpg' },
          image('c.jpg', 40 * MB),
          image('d.jpg', 40 * MB),
          image('a.jpg', 1),
        ]),
        /** @type {any} */ ({ commitType: 'update' }),
      );

      // The move takes no room, as the content isn’t sent again
      expect(getActions()).toEqual([
        [['create', 'c.jpg']],
        [
          ['create', 'd.jpg'],
          ['move', 'b.jpg'],
          ['create', 'a.jpg'],
        ],
      ]);
      expect(getBodies()[1].actions[1]).not.toHaveProperty('content');
    });

    test('commits a changeset of a usual size at once', async () => {
      mockCommits();

      await commitChanges(
        /** @type {any} */ ([
          { action: 'create', path: 'gallery/x/index.md', data: '+++\n+++' },
          image('gallery/x/001.jpg', 30 * MB),
          image('gallery/x/002.jpg', 30 * MB),
        ]),
        /** @type {any} */ ({ commitType: 'create' }),
      );

      expect(fetchAPI).toHaveBeenCalledOnce();
    });

    test('retries a commit that is too large with half of the files, and stays at that size', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(uploadFailure)
        .mockResolvedValueOnce({ id: 'c1', committed_date: '2026-11-01T12:00:00Z' })
        .mockResolvedValueOnce({ id: 'c2', committed_date: '2026-11-01T12:00:00Z' })
        .mockResolvedValueOnce({ id: 'c3', committed_date: '2026-11-01T12:00:00Z' });
      // The failed commit hasn’t landed
      vi.mocked(fetchAPIOrUndefined).mockResolvedValue({ commit: { id: 'head0' } });

      const result = await commitChanges(
        /** @type {any} */ ([
          image('a.jpg', 20 * MB),
          image('b.jpg', 20 * MB),
          image('c.jpg', 20 * MB),
        ]),
        /** @type {any} */ ({ commitType: 'uploadMedia' }),
      );

      expect(fetchAPIOrUndefined).toHaveBeenCalledWith(
        '/projects/test-owner%2Ftest-repo/repository/branches/main',
      );
      // The instance takes 30 MB at most, so the following commits aren’t made any larger
      expect(getActions()).toEqual([
        [
          ['create', 'a.jpg'],
          ['create', 'b.jpg'],
          ['create', 'c.jpg'],
        ],
        [['create', 'a.jpg']],
        [['create', 'b.jpg']],
        [['create', 'c.jpg']],
      ]);
      expect(result.sha).toBe('c3');
    });

    test('retries the first commit on a workflow branch it was to create', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(uploadFailure)
        .mockResolvedValue({ id: 'c1', committed_date: '2026-11-01T12:00:00Z' });
      // The branch doesn’t exist yet, so the commit hasn’t landed
      vi.mocked(fetchAPIOrUndefined).mockResolvedValue(undefined);

      await commitChanges(
        /** @type {any} */ ([image('a.jpg', 0.5 * MB), image('b.jpg', 0.5 * MB)]),
        /** @type {any} */ ({ commitType: 'create', branch: 'cms/x', startBranch: 'main' }),
      );

      expect(getActions()).toEqual([
        [
          ['create', 'a.jpg'],
          ['create', 'b.jpg'],
        ],
        [['create', 'a.jpg']],
        [['create', 'b.jpg']],
      ]);
      expect(getBodies().map(({ start_branch: startBranch }) => startBranch)).toEqual([
        'main',
        'main',
        undefined,
      ]);
    });

    test('gives up on a failed commit when the branch has moved or can’t be looked up', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(uploadFailure);
      vi.mocked(fetchAPIOrUndefined).mockResolvedValueOnce({ commit: { id: 'colleague' } });

      const changes = /** @type {any} */ ([image('a.jpg', 0.5 * MB), image('b.jpg', 0.5 * MB)]);
      const options = /** @type {any} */ ({ commitType: 'uploadMedia' });

      await expect(commitChanges(changes, options)).rejects.toThrow(uploadFailure);
      vi.mocked(fetchAPIOrUndefined).mockRejectedValueOnce(new Error('offline'));
      await expect(commitChanges(changes, options)).rejects.toThrow(uploadFailure);
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('replaces the files that landed when a split save is retried', async () => {
      const changes = /** @type {any} */ ([
        { action: 'create', path: 'gallery/x/index.md', data: '+++\n+++' },
        image('gallery/x/001.jpg', 40 * MB),
        image('gallery/x/002.jpg', 40 * MB),
      ]);

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({
          id: 'c1',
          committed_date: '2026-11-01T12:00:00Z',
          parent_ids: ['head0'],
        })
        .mockRejectedValueOnce(new Error('Server error', { cause: { status: 500 } }));

      await expect(
        commitChanges(changes, /** @type {any} */ ({ commitType: 'create' })),
      ).rejects.toThrow('Server error');
      // The known head moves on to the commit that landed, so the retry isn’t taken for a remote
      // change, which would save the images again under new names
      expect(repositoryHead.current).toBe('c1');

      vi.mocked(fetchAPI).mockReset();
      mockCommits();
      await commitChanges(changes, /** @type {any} */ ({ commitType: 'create' }));

      // GitLab refuses to create a file that exists, and the file didn’t exist as of the head
      expect(getBodies()[0].actions.slice(0, 2)).toEqual([
        { action: 'delete', file_path: 'gallery/x/001.jpg' },
        expect.objectContaining({ action: 'create', file_path: 'gallery/x/001.jpg' }),
      ]);

      // Once the save has gone through, the files are created as usual
      vi.mocked(fetchAPI).mockReset();
      mockCommits();
      await commitChanges(changes, /** @type {any} */ ({ commitType: 'create' }));
      expect(getActions()[0]).toEqual([['create', 'gallery/x/001.jpg']]);
    });

    test('keeps the head when a commit landed on top of a colleague’s before a failure', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({
          id: 'c1',
          committed_date: '2026-11-01T12:00:00Z',
          parent_ids: ['colleague'],
        })
        .mockRejectedValueOnce(new Error('Server error', { cause: { status: 400 } }));
      // The branch points at the commit that landed, which isn’t where the save started from
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { repository: { tree: { lastCommit: { sha: 'c1', message: '' } } } },
      });

      await expect(
        commitChanges(
          /** @type {any} */ ([
            { action: 'update', path: 'gallery/x/index.md', data: '+++\n+++' },
            image('gallery/x/001.jpg', 40 * MB),
            image('gallery/x/002.jpg', 40 * MB),
          ]),
          /** @type {any} */ ({ commitType: 'update' }),
        ),
      ).rejects.toThrow('The branch has moved since the site data was loaded.');
      // Taking the commit as the head would mean the colleague’s commit is never fetched
      expect(repositoryHead.current).toBe('head0');
    });

    test('doesn’t keep track of the files that landed on a workflow branch', async () => {
      const changes = /** @type {any} */ ([image('a.jpg', 40 * MB), image('b.jpg', 40 * MB)]);
      const options = /** @type {any} */ ({ commitType: 'create', branch: 'cms/x' });

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ id: 'c1', committed_date: '2026-11-01T12:00:00Z' })
        .mockRejectedValueOnce(new Error('Server error', { cause: { status: 500 } }));

      await expect(commitChanges(changes, options)).rejects.toThrow('Server error');
      expect(repositoryHead.current).toBe('head0');

      vi.mocked(fetchAPI).mockReset();
      mockCommits();
      await commitChanges(/** @type {any} */ ([changes[0]]), /** @type {any} */ ({}));
      expect(getActions()).toEqual([[['create', 'a.jpg']]]);
    });
  });

  describe('fetchFileCommits', () => {
    test('fetches and returns commits with resolved avatars', async () => {
      vi.mocked(fetchAPI)
        // Commit list request
        .mockResolvedValueOnce([
          {
            id: 'abc123',
            title: 'Update Post “hello”',
            message: 'Update Post “hello”\n\nWith a body',
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
        message: 'Update Post “hello”',
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        authorAvatarURL: 'https://example.com/alice.png',
        date: new Date('2024-06-01T12:00:00Z'),
      });
      expect(result[1]).toEqual({
        sha: 'def456',
        message: '',
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
