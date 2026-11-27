import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  fetchBranchHeadSHA,
  fetchDeployments,
  triggerDeployment,
} from '$lib/services/backends/git/github/deployment';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { createMockDeployTarget } from '$lib/test/factories';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

// Shared across module reloads, so a test can switch the signed-in token
const mockUser = vi.hoisted(() => ({ account: /** @type {any} */ ({ token: 'token-1' }) }));

vi.mock('$lib/services/user/account.svelte', () => ({ user: mockUser }));

/**
 * Build a `repository` payload with one aliased commit per entry.
 * @param {(Record<string, any> | null)[]} commits Commit objects, in alias order, `null` for a
 * commit the API couldn’t return.
 * @returns {Record<string, any>} GraphQL response.
 */
const createCommitResponse = (commits) => ({
  repository: Object.fromEntries(commits.map((commit, index) => [`commit_${index}`, commit])),
});

describe('GitHub deployment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.account = { token: 'token-1' };
    Object.assign(repository, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
    });
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });
  });

  describe('triggerDeployment', () => {
    test('triggers deployment successfully', async () => {
      const mockResponse = { status: 204, ok: true };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await triggerDeployment();

      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/dispatches', {
        method: 'POST',
        body: { event_type: 'sveltia-cms-publish' },
        responseType: 'raw',
      });
      expect(result).toBe(mockResponse);
    });

    test('handles API errors', async () => {
      const error = new Error('API Error');

      vi.mocked(fetchAPI).mockRejectedValue(error);

      await expect(triggerDeployment()).rejects.toThrow('API Error');
    });
  });

  describe('fetchBranchHeadSHA', () => {
    test('returns the head commit of the configured branch', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: { ref: { target: { oid: 'abc123' } } },
      });

      await expect(fetchBranchHeadSHA()).resolves.toBe('abc123');

      const [query] = vi.mocked(fetchGraphQL).mock.calls[0];

      expect(query).toContain('ref(qualifiedName: $branch)');
    });

    test('returns undefined when the branch is missing', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: { ref: null } });

      await expect(fetchBranchHeadSHA()).resolves.toBeUndefined();
    });

    test('returns undefined when the repository is missing', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({});

      await expect(fetchBranchHeadSHA()).resolves.toBeUndefined();
    });

    test('sends no request before the default branch is known', async () => {
      // The query would otherwise be sent without the `$branch` variable it requires, and fail
      repository.branch = undefined;

      await expect(fetchBranchHeadSHA()).resolves.toBeUndefined();
      expect(fetchGraphQL).not.toHaveBeenCalled();
    });
  });

  describe('fetchDeployments', () => {
    /**
     * Answer every request with one commit carrying whichever sources the test supplies. All three
     * are asked for together, so a single response covers them.
     * @param {Record<string, any>} commit Commit node.
     */
    const respondWith = (commit) => {
      vi.mocked(fetchGraphQL).mockResolvedValue(createCommitResponse([commit]));
    };

    test('sends no request without a target', async () => {
      await expect(fetchDeployments([])).resolves.toEqual({});
      expect(fetchGraphQL).not.toHaveBeenCalled();
    });

    test('skips a target without a commit SHA', async () => {
      await expect(fetchDeployments([createMockDeployTarget({ sha: '' })])).resolves.toEqual({});
      expect(fetchGraphQL).not.toHaveBeenCalled();
    });

    test('asks for every source in a single request', async () => {
      respondWith({});

      await fetchDeployments([createMockDeployTarget()]);

      expect(fetchGraphQL).toHaveBeenCalledTimes(1);

      const [query] = vi.mocked(fetchGraphQL).mock.calls[0];

      expect(query).toContain('status {');
      expect(query).toContain('deployments(');
      expect(query).toContain('checkSuites(');
    });

    test('reads a deploy preview URL from a commit status', async () => {
      respondWith({
        status: {
          contexts: [
            {
              context: 'netlify/site/deploy-preview',
              state: 'SUCCESS',
              targetUrl: 'https://deploy-preview-1--site.netlify.app',
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({
        state: 'ready',
        url: 'https://deploy-preview-1--site.netlify.app',
        context: 'netlify/site/deploy-preview',
        checkedTime: expect.any(Number),
      });
    });

    test('reads a deploy preview URL from a deployment', async () => {
      respondWith({
        deployments: {
          nodes: [
            {
              environment: 'Preview',
              latestStatus: { state: 'SUCCESS', environmentUrl: 'https://preview.vercel.app' },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'ready', url: 'https://preview.vercel.app' }),
      );
    });

    test('ignores a superseded deployment', async () => {
      respondWith({
        deployments: {
          nodes: [
            {
              environment: 'Preview',
              latestStatus: { state: 'INACTIVE', environmentUrl: 'https://old.example.com' },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
    });

    test('tolerates a status and a deployment with missing fields', async () => {
      respondWith({
        status: {
          contexts: [
            // A state the API may add later is skipped rather than guessed at
            { context: 'future', state: 'SOMETHING_NEW', targetUrl: 'https://x.example.com' },
            { context: null, state: 'PENDING', targetUrl: null },
          ],
        },
        // A deployment that hasn’t reported a status yet is skipped
        deployments: { nodes: [{ environment: null, latestStatus: null }] },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({
        state: 'pending',
        url: undefined,
        context: '',
        checkedTime: expect.any(Number),
      });
    });

    test('falls back to an empty environment name', async () => {
      respondWith({
        deployments: { nodes: [{ environment: null, latestStatus: { state: 'QUEUED' } }] },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'pending', url: undefined, context: '' }),
      );
    });

    test('returns unknown when no source reports anything', async () => {
      respondWith({});

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
    });

    test('takes the preview URL a check run publishes in its output', async () => {
      // Cloudflare Pages links its check at the dashboard and puts the address in the summary
      const summary =
        "<tr><td><strong>Preview URL:</strong></td><td><a href='https://deadbeef.site.pages.dev'>" +
        'https://deadbeef.site.pages.dev</a></td></tr>' +
        '[View logs](https://dash.cloudflare.com/?to=/account-id/pages/view/site/deadbeef)';

      respondWith({
        checkSuites: {
          nodes: [
            {
              checkRuns: {
                nodes: [
                  {
                    name: 'Cloudflare Pages',
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    detailsUrl: 'https://dash.cloudflare.com/?to=/account-id/pages/view/site',
                    summary,
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({
          state: 'ready',
          url: 'https://deadbeef.site.pages.dev',
          context: 'Cloudflare Pages',
        }),
      );
    });

    test('takes no URL from a build-page check run with nothing in its output', async () => {
      respondWith({
        checkSuites: {
          nodes: [
            {
              checkRuns: {
                nodes: [
                  {
                    name: 'Cloudflare Pages',
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    detailsUrl: 'https://dash.cloudflare.com/?to=/account-id/pages/view/site',
                    summary: null,
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      // The build state is still worth reporting; a dashboard link is not somewhere to send anyone
      expect(result.abc123).toEqual(expect.objectContaining({ state: 'ready', url: undefined }));
    });

    test('reads a deploy preview URL from a check run named a preview', async () => {
      respondWith({
        checkSuites: {
          nodes: [
            {
              checkRuns: {
                nodes: [
                  {
                    name: 'AWS Amplify Console Web Preview',
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    detailsUrl: 'https://pr-1.example.amplifyapp.com',
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({
          state: 'ready',
          url: 'https://pr-1.example.amplifyapp.com',
          context: 'AWS Amplify Console Web Preview',
        }),
      );
    });

    test('reports a check run that hasn’t finished as pending', async () => {
      respondWith({
        checkSuites: {
          nodes: [
            {
              checkRuns: {
                nodes: [
                  {
                    name: 'Amplify Preview',
                    status: 'IN_PROGRESS',
                    conclusion: null,
                    detailsUrl: null,
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(expect.objectContaining({ state: 'pending', url: undefined }));
    });

    test('drops a canceled check run and takes no URL from a nameless one', async () => {
      respondWith({
        checkSuites: {
          nodes: [
            null,
            {
              checkRuns: {
                nodes: [
                  {
                    name: 'Amplify Preview',
                    status: 'COMPLETED',
                    conclusion: 'CANCELLED',
                    detailsUrl: 'https://gone.example.com',
                  },
                  // A nameless run can’t say it’s a preview, so its link isn’t followed — but
                  // it still reports that something on this commit finished
                  {
                    name: null,
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    detailsUrl: 'https://nameless.example.com',
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'ready', url: undefined, context: '' }),
      );
    });

    test('skips a canceled deploy in favour of the one that ran', async () => {
      // A monorepo posts one status per site; the untouched one reports success but no preview
      // @see https://github.com/decaporg/decap-cms/issues/5107
      respondWith({
        status: {
          contexts: [
            {
              context: 'netlify/site-a/deploy-preview',
              state: 'SUCCESS',
              targetUrl: 'https://canceled.example.com',
              description: 'Deploy preview canceled.',
            },
            {
              context: 'netlify/site-b/deploy-preview',
              state: 'SUCCESS',
              targetUrl: 'https://ready.example.com',
              description: 'Deploy preview ready!',
            },
          ],
        },
      });

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123.url).toBe('https://ready.example.com');
    });

    test('looks a shared head commit up only once, but reports it for every target', async () => {
      respondWith({
        status: {
          contexts: [{ context: 'deploy', state: 'SUCCESS', targetUrl: 'https://a.example.com' }],
        },
      });

      const result = await fetchDeployments([
        createMockDeployTarget({ branch: 'cms/posts/a' }),
        createMockDeployTarget({ branch: 'cms/posts/b' }),
      ]);

      const [query] = vi.mocked(fetchGraphQL).mock.calls[0];

      expect(query).toContain('commit_0:');
      expect(query).not.toContain('commit_1:');
      expect(Object.keys(result)).toEqual(['abc123']);
    });

    test('splits more than 20 commits into separate requests', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: {} });

      const targets = Array.from({ length: 21 }, (_, index) =>
        createMockDeployTarget({ sha: `sha${index}` }),
      );

      await fetchDeployments(targets);

      // Two chunks, one request each
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
    });

    describe('when a field is unavailable', () => {
      /**
       * Load the module afresh, so the fallback remembered by one test doesn’t leak into another.
       * @returns {Promise<any>} The function under test and the request helper it will use.
       */
      const loadFresh = async () => {
        vi.resetModules();

        const api = await import('$lib/services/backends/git/shared/api');
        const module = await import('$lib/services/backends/git/github/deployment');

        return { run: module.fetchDeployments, request: api.fetchGraphQL };
      };

      /**
       * Whether the query asks for more than one source, which is the combined form.
       * @param {string} query GraphQL query.
       * @returns {boolean} Result.
       */
      const isCombined = (query) => query.includes('status {') && query.includes('deployments(');

      test('asks for each source on its own, keeping the ones that answer', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockImplementation(async (/** @type {string} */ query) => {
          // This repository can’t answer for deployments, which fails the combined query outright
          if (isCombined(query) || query.includes('deployments(')) {
            throw new Error('Field unavailable');
          }

          if (query.includes('checkSuites(')) {
            return createCommitResponse([{ checkSuites: { nodes: [] } }]);
          }

          return createCommitResponse([
            {
              status: {
                contexts: [
                  {
                    context: 'netlify/site/deploy-preview',
                    state: 'SUCCESS',
                    targetUrl: 'https://preview.netlify.app',
                  },
                ],
              },
            },
          ]);
        });

        const result = await run([createMockDeployTarget()]);

        expect(result.abc123).toEqual(
          expect.objectContaining({ state: 'ready', url: 'https://preview.netlify.app' }),
        );

        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
      });

      test('remembers the split, so the combined query is tried only once', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockImplementation(async (/** @type {string} */ query) => {
          if (isCombined(query)) {
            throw new Error('Field unavailable');
          }

          return createCommitResponse([{}]);
        });

        await run([createMockDeployTarget()]);

        const firstRound = vi.mocked(request).mock.calls.length;

        vi.mocked(request).mockClear();
        await run([createMockDeployTarget({ sha: 'def456' })]);

        // The first round paid for the failed combined attempt; the next goes straight to three
        expect(firstRound).toBe(4);
        expect(vi.mocked(request).mock.calls.length).toBe(3);

        // Another token tries the combined query again
        mockUser.account = { token: 'another-token' };
        vi.mocked(request).mockClear();
        await run([createMockDeployTarget({ sha: 'ghi789' })]);

        expect(isCombined(vi.mocked(request).mock.calls[0][0])).toBe(true);

        warn.mockRestore();
      });
    });

    describe('when the token can’t read some of the sources', () => {
      /**
       * Load the module afresh, so the sources remembered by one test don’t leak into another.
       * @returns {Promise<any>} The function under test and the request helper it will use.
       */
      const loadFresh = async () => {
        vi.resetModules();

        const api = await import('$lib/services/backends/git/shared/api');
        const module = await import('$lib/services/backends/git/github/deployment');

        return { run: module.fetchDeployments, request: api.fetchGraphQL };
      };

      /**
       * Build the error `fetchGraphQL` throws for a response with partial data, as GitHub gives
       * when a fine-grained token asks for check suites it isn’t allowed to read.
       * @param {Record<string, any>} data Partial data.
       * @param {Record<string, any>[]} errors GraphQL errors.
       * @returns {Error} Error.
       */
      const createPartialError = (data, errors) =>
        new Error('Server responded with an error', {
          cause: { status: 200, message: 'Forbidden', errors, data },
        });

      const forbiddenChecks = {
        type: 'FORBIDDEN',
        path: ['repository', 'commit_0', 'checkSuites', 'nodes', 0],
        message: 'Resource not accessible by personal access token',
      };

      const statusCommit = {
        status: {
          contexts: [
            {
              context: 'Deploy preview',
              state: 'SUCCESS',
              targetUrl: 'https://preview.example.com',
            },
          ],
        },
        deployments: { nodes: [] },
        checkSuites: { nodes: [null] },
      };

      test('keeps the sources that answered from the partial response', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValue(
          createPartialError(createCommitResponse([statusCommit]), [forbiddenChecks]),
        );

        const result = await run([createMockDeployTarget()]);

        expect(result.abc123).toEqual(
          expect.objectContaining({ state: 'ready', url: 'https://preview.example.com' }),
        );

        // No request per source is needed
        expect(request).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('Failed to fetch the deployment info from checks.', [
          { ...forbiddenChecks, index: 0 },
        ]);

        warn.mockRestore();
      });

      test('leaves a forbidden source out of later queries for the same token', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValueOnce(
          createPartialError(createCommitResponse([statusCommit]), [forbiddenChecks]),
        );

        await run([createMockDeployTarget()]);

        vi.mocked(request).mockClear();
        vi.mocked(request).mockResolvedValue(createCommitResponse([statusCommit]));

        const result = await run([createMockDeployTarget({ sha: 'def456' })]);
        const [query] = vi.mocked(request).mock.calls[0];

        expect(request).toHaveBeenCalledTimes(1);
        expect(query).not.toContain('checkSuites(');
        expect(query).toContain('status {');
        expect(query).toContain('deployments(');
        expect(result.def456).toEqual(expect.objectContaining({ state: 'ready' }));

        // Signing in with another token asks for check suites again
        mockUser.account = { token: 'token-2' };
        vi.mocked(request).mockClear();
        await run([createMockDeployTarget({ sha: 'ghi789' })]);

        expect(vi.mocked(request).mock.calls[0][0]).toContain('checkSuites(');

        warn.mockRestore();
      });

      test('keeps the readable nodes next to one that couldn’t be read', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        const checkCommit = {
          checkSuites: {
            nodes: [
              null,
              {
                checkRuns: {
                  nodes: [
                    {
                      name: 'Deploy preview',
                      status: 'COMPLETED',
                      conclusion: 'SUCCESS',
                      detailsUrl: 'https://preview.example.com',
                    },
                  ],
                },
              },
            ],
          },
        };

        vi.mocked(request).mockRejectedValue(
          createPartialError(createCommitResponse([checkCommit]), [forbiddenChecks]),
        );

        const result = await run([createMockDeployTarget()]);

        expect(result.abc123).toEqual(
          expect.objectContaining({ state: 'ready', url: 'https://preview.example.com' }),
        );

        warn.mockRestore();
      });

      test('doesn’t pin a forbidden source on a token signed in during the request', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockImplementationOnce(async () => {
          // Another lookup with a new token starts while this one is waiting for its answer
          mockUser.account = { token: 'token-2' };
          vi.mocked(request).mockResolvedValueOnce(createCommitResponse([{}]));
          await run([createMockDeployTarget({ sha: 'def456' })]);

          throw createPartialError(createCommitResponse([statusCommit]), [forbiddenChecks]);
        });

        await run([createMockDeployTarget()]);

        vi.mocked(request).mockClear();
        vi.mocked(request).mockResolvedValue(createCommitResponse([{}]));
        await run([createMockDeployTarget({ sha: 'ghi789' })]);

        expect(vi.mocked(request).mock.calls[0][0]).toContain('checkSuites(');

        warn.mockRestore();
      });

      test('asks for a source again when its error isn’t a permission one', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValueOnce(
          createPartialError(createCommitResponse([statusCommit]), [
            { ...forbiddenChecks, type: 'SERVICE_UNAVAILABLE' },
          ]),
        );

        await run([createMockDeployTarget()]);

        vi.mocked(request).mockClear();
        vi.mocked(request).mockResolvedValue(createCommitResponse([{}]));
        await run([createMockDeployTarget({ sha: 'def456' })]);

        expect(vi.mocked(request).mock.calls[0][0]).toContain('checkSuites(');

        warn.mockRestore();
      });

      test('falls back to a request per source when an error can’t be pinned to one', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValueOnce(
          createPartialError(createCommitResponse([statusCommit]), [
            forbiddenChecks,
            { type: 'FORBIDDEN', path: ['repository', 'commit_0'], message: 'Forbidden' },
            { message: 'Something went wrong' },
          ]),
        );

        vi.mocked(request).mockResolvedValue(createCommitResponse([statusCommit]));

        const result = await run([createMockDeployTarget()]);

        // The combined query, then one per source
        expect(request).toHaveBeenCalledTimes(4);
        expect(warn).toHaveBeenCalledWith(
          'Falling back to a request per deployment source.',
          expect.any(Error),
        );

        expect(result.abc123).toEqual(expect.objectContaining({ state: 'ready' }));

        warn.mockRestore();
      });

      test('falls back when an error has nulled the whole commit', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValueOnce(
          createPartialError(createCommitResponse([null]), [
            { ...forbiddenChecks, type: 'SERVICE_UNAVAILABLE' },
          ]),
        );

        vi.mocked(request).mockResolvedValue(createCommitResponse([statusCommit]));

        const result = await run([createMockDeployTarget()]);

        // The combined query, then one per source, which recovers the commit status
        expect(request).toHaveBeenCalledTimes(4);
        expect(result.abc123).toEqual(
          expect.objectContaining({ state: 'ready', url: 'https://preview.example.com' }),
        );

        warn.mockRestore();
      });

      test('keeps a partial answer when asking for each source on its own', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        const checkCommit = {
          checkSuites: {
            nodes: [
              null,
              {
                checkRuns: {
                  nodes: [
                    {
                      name: 'Deploy preview',
                      status: 'COMPLETED',
                      conclusion: 'SUCCESS',
                      detailsUrl: 'https://preview.example.com',
                    },
                  ],
                },
              },
            ],
          },
        };

        vi.mocked(request).mockImplementation(async (/** @type {string} */ query) => {
          // The server doesn’t know a field, which fails the combined query with no data
          if (query.includes('status {') && query.includes('checkSuites(')) {
            throw new Error('Field unavailable');
          }

          if (query.includes('checkSuites(')) {
            throw createPartialError(createCommitResponse([checkCommit]), [forbiddenChecks]);
          }

          return createCommitResponse([{}]);
        });

        const result = await run([createMockDeployTarget()]);

        expect(result.abc123).toEqual(
          expect.objectContaining({ state: 'ready', url: 'https://preview.example.com' }),
        );

        warn.mockRestore();
      });

      test('falls back when the partial response has no repository data', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValueOnce(createPartialError({}, [forbiddenChecks]));
        vi.mocked(request).mockResolvedValue(createCommitResponse([{}]));

        await run([createMockDeployTarget()]);

        expect(request).toHaveBeenCalledTimes(4);

        warn.mockRestore();
      });

      test('sends no request once every source is forbidden', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { run, request } = await loadFresh();

        vi.mocked(request).mockRejectedValueOnce(
          createPartialError(
            createCommitResponse([{}]),
            ['status', 'deployments', 'checkSuites'].map((field) => ({
              type: 'FORBIDDEN',
              path: ['repository', 'commit_0', field],
              message: 'Forbidden',
            })),
          ),
        );

        await run([createMockDeployTarget()]);
        vi.mocked(request).mockClear();

        const result = await run([createMockDeployTarget({ sha: 'def456' })]);

        expect(request).not.toHaveBeenCalled();
        expect(result.def456).toEqual(expect.objectContaining({ state: 'unknown' }));

        warn.mockRestore();
      });
    });
  });
});
