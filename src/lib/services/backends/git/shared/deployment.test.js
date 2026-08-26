import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  findURLInSummary,
  getPreviewContext,
  normalizeURL,
  pickDeployment,
} from '$lib/services/backends/git/shared/deployment';

/**
 * @import { DeployCandidate } from '$lib/services/backends/git/shared/deployment';
 */

vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));

/**
 * Create a candidate with sensible defaults.
 * @param {Partial<DeployCandidate>} [overrides] Properties to override.
 * @returns {DeployCandidate} Candidate.
 */
const createCandidate = (overrides = {}) => ({
  name: 'ci/build',
  url: 'https://example.com',
  state: 'ready',
  source: 'status',
  ...overrides,
});

describe('Git deployment selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(get).mockReturnValue({ backend: { name: 'github' } });
  });

  describe('getPreviewContext', () => {
    test('returns the configured context', () => {
      vi.mocked(get).mockReturnValue({
        backend: { name: 'github', preview_context: 'netlify/site/deploy-preview' },
      });

      expect(getPreviewContext()).toBe('netlify/site/deploy-preview');
    });

    test('returns an empty string when the option is unset', () => {
      expect(getPreviewContext()).toBe('');
    });

    test('returns an empty string without a backend', () => {
      vi.mocked(get).mockReturnValue({});
      expect(getPreviewContext()).toBe('');
    });

    test('returns an empty string without a config', () => {
      vi.mocked(get).mockReturnValue(undefined);
      expect(getPreviewContext()).toBe('');
    });
  });

  describe('normalizeURL', () => {
    /** @type {[any, string | undefined][]} */
    const cases = [
      ['https://example.com', 'https://example.com'],
      ['https://example.com/', 'https://example.com'],
      ['https://example.com/preview/', 'https://example.com/preview'],
      ['https://example.com/preview', 'https://example.com/preview'],
      // An insecure URL would be blocked by the browser anyway
      ['http://example.com', undefined],
      ['not a url', undefined],
      ['', undefined],
      [undefined, undefined],
      [null, undefined],
    ];

    test.each(cases)('normalizes %o to %o', (input, expected) => {
      expect(normalizeURL(input)).toBe(expected);
    });
  });

  describe('findURLInSummary', () => {
    // The structure of a real Cloudflare Pages check run summary, with the site, account and
    // deployment identifiers replaced. The dashboard link at the end is the one that has to be
    // passed over
    const summary = [
      '<table><tr><td><strong>Latest commit:</strong> </td><td>\n<code>abc123</code>\n</td></tr>\n',
      '<tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr>\n',
      "<tr><td><strong>Preview URL:</strong></td><td>\n<a href='https://deadbeef.example-site.pages.dev'>",
      'https://deadbeef.example-site.pages.dev</a>\n</td></tr>\n',
      "<tr><td><strong>Branch Preview URL:</strong></td><td>\n<a href='https://cms-posts-hello.example-site.pages.dev'>",
      'https://cms-posts-hello.example-site.pages.dev</a>\n</td></tr>\n</table>\n\n',
      '[View logs](https://dash.cloudflare.com/?to=/account-id/pages/view/example-site/deadbeef)\n',
    ].join('');

    const detailsURL =
      'https://dash.cloudflare.com/?to=/account-id/pages/view/example-site/deadbeef';

    test('finds the preview URL a provider publishes in its output', () => {
      // The commit’s own deployment, not the branch alias, because the lookup is per commit
      expect(findURLInSummary(summary, detailsURL)).toBe('https://deadbeef.example-site.pages.dev');
    });

    test('passes over links back to the provider’s dashboard', () => {
      const onlyDashboard = '[View logs](https://dash.cloudflare.com/?to=/account-id/pages/view/x)';

      expect(findURLInSummary(onlyDashboard, detailsURL)).toBeUndefined();
    });

    test('returns nothing without a summary', () => {
      expect(findURLInSummary(undefined, detailsURL)).toBeUndefined();
      expect(findURLInSummary('', detailsURL)).toBeUndefined();
    });

    test('returns nothing when the summary holds no URL', () => {
      expect(findURLInSummary('Deployed successfully', detailsURL)).toBeUndefined();
    });

    test('copes with a check run that has no URL of its own', () => {
      expect(findURLInSummary(summary, undefined)).toBe('https://deadbeef.example-site.pages.dev');
    });

    test('skips a URL that can’t be used as a site address', () => {
      expect(findURLInSummary('see http://insecure.example.com then https://ok.example.com')).toBe(
        'https://ok.example.com',
      );
    });
  });

  describe('pickDeployment', () => {
    test('returns unknown without any candidate', () => {
      const result = pickDeployment([], { kind: 'preview' });

      expect(result).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
    });

    test('returns the only candidate with its URL and context', () => {
      const result = pickDeployment([createCandidate({ name: 'netlify/site/deploy-preview' })], {
        kind: 'preview',
      });

      expect(result).toEqual({
        state: 'ready',
        url: 'https://example.com',
        context: 'netlify/site/deploy-preview',
        checkedTime: expect.any(Number),
      });
    });

    test('prefers a deployment over a commit status', () => {
      const result = pickDeployment(
        [
          createCandidate({ name: 'status', url: 'https://status.example.com' }),
          createCandidate({ name: 'env', url: 'https://env.example.com', source: 'deployment' }),
        ],
        { kind: 'preview' },
      );

      expect(result.url).toBe('https://env.example.com');
    });

    test('prefers a ready candidate over a pending one', () => {
      const result = pickDeployment(
        [
          createCandidate({ name: 'a', url: 'https://a.example.com' }),
          createCandidate({ name: 'b', url: 'https://b.example.com', state: 'pending' }),
        ],
        { kind: 'preview' },
      );

      expect(result.url).toBe('https://a.example.com');
    });

    test('prefers a name that looks like a deploy preview', () => {
      const result = pickDeployment(
        [
          createCandidate({ name: 'netlify/site', url: 'https://a.example.com' }),
          createCandidate({ name: 'lint', url: 'https://b.example.com' }),
        ],
        { kind: 'preview' },
      );

      expect(result.url).toBe('https://a.example.com');
    });

    test('prefers a production environment for a production lookup', () => {
      const result = pickDeployment(
        [
          createCandidate({ name: 'preview', url: 'https://a.example.com', source: 'deployment' }),
          createCandidate({
            name: 'production',
            url: 'https://b.example.com',
            source: 'deployment',
          }),
        ],
        { kind: 'production' },
      );

      expect(result.url).toBe('https://b.example.com');
    });

    test('avoids a production environment for a preview lookup', () => {
      const result = pickDeployment(
        [
          createCandidate({
            name: 'production',
            url: 'https://a.example.com',
            source: 'deployment',
          }),
          createCandidate({ name: 'preview', url: 'https://b.example.com', source: 'deployment' }),
        ],
        { kind: 'preview' },
      );

      expect(result.url).toBe('https://b.example.com');
    });

    test('breaks a tie with the later candidate, which is the newer one', () => {
      const result = pickDeployment(
        [
          createCandidate({ name: 'deploy', url: 'https://old.example.com' }),
          createCandidate({ name: 'deploy', url: 'https://new.example.com' }),
        ],
        { kind: 'preview' },
      );

      expect(result.url).toBe('https://new.example.com');
    });

    test('drops a ready candidate without a usable URL', () => {
      const result = pickDeployment(
        [
          createCandidate({ name: 'deploy', url: 'http://insecure.example.com' }),
          createCandidate({ name: 'lint', url: 'https://lint.example.com' }),
        ],
        { kind: 'preview' },
      );

      expect(result.url).toBe('https://lint.example.com');
    });

    test('keeps a pending candidate without a URL', () => {
      const result = pickDeployment(
        [createCandidate({ name: 'netlify/site', url: undefined, state: 'pending' })],
        { kind: 'preview' },
      );

      expect(result).toEqual({
        state: 'pending',
        url: undefined,
        context: 'netlify/site',
        checkedTime: expect.any(Number),
      });
    });

    test('keeps an error candidate without a URL', () => {
      const result = pickDeployment(
        [createCandidate({ name: 'netlify/site', url: undefined, state: 'error' })],
        { kind: 'preview' },
      );

      expect(result.state).toBe('error');
    });

    test('still reports the state of a finished build that offers no URL', () => {
      // The caller pairs the state with the site’s own address, so a provider that reports a
      // result without one is still worth listening to
      const result = pickDeployment([createCandidate({ url: undefined })], { kind: 'preview' });

      expect(result).toEqual(expect.objectContaining({ state: 'ready', url: undefined }));
    });

    test('prefers a ready commit status over a pending deployment', () => {
      // Reporting “still building” would hide a preview that is already live
      const result = pickDeployment(
        [
          createCandidate({ name: 'netlify/site', url: 'https://live.example.com' }),
          createCandidate({ name: 'preview', state: 'pending', source: 'deployment' }),
        ],
        { kind: 'preview' },
      );

      expect(result).toEqual(
        expect.objectContaining({ state: 'ready', url: 'https://live.example.com' }),
      );
    });

    describe('canceled builds', () => {
      // @see https://github.com/decaporg/decap-cms/issues/5107
      test('skips a canceled deploy in favour of the one that ran', () => {
        // A monorepo posts one status per site, and the site the commit didn’t touch reports a
        // canceled deploy with a success state and a URL that goes nowhere useful
        const result = pickDeployment(
          [
            createCandidate({
              name: 'netlify/site-a/deploy-preview',
              url: 'https://canceled.example.com',
              description: 'Deploy preview canceled.',
            }),
            createCandidate({
              name: 'netlify/site-b/deploy-preview',
              url: 'https://ready.example.com',
              description: 'Deploy preview ready!',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result.url).toBe('https://ready.example.com');
      });

      test('skips a canceled deploy listed after the one that ran', () => {
        const result = pickDeployment(
          [
            createCandidate({
              name: 'netlify/site-b/deploy-preview',
              url: 'https://ready.example.com',
              description: 'Deploy preview ready!',
            }),
            createCandidate({
              name: 'netlify/site-a/deploy-preview',
              url: 'https://canceled.example.com',
              description: 'Deploy preview canceled.',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result.url).toBe('https://ready.example.com');
      });

      /** @type {string[]} */
      const descriptions = [
        'Deploy preview canceled.',
        'Deploy cancelled',
        'Build skipped',
        'No changes detected',
      ];

      test.each(descriptions)('treats %o as no build at all', (description) => {
        const result = pickDeployment([createCandidate({ description })], { kind: 'preview' });

        expect(result.state).toBe('unknown');
      });

      test('keeps a candidate whose description says nothing of the sort', () => {
        const result = pickDeployment([createCandidate({ description: 'Deploy preview ready!' })], {
          kind: 'preview',
        });

        expect(result.state).toBe('ready');
      });
    });

    describe('check runs', () => {
      // @see https://github.com/decaporg/decap-cms/issues/5161
      test('accepts a check run whose name says it’s a preview', () => {
        // AWS Amplify posts no commit status at all; the URL is only on the check run
        const result = pickDeployment(
          [
            createCandidate({
              name: 'AWS Amplify Console Web Preview',
              url: 'https://pr-1.example.amplifyapp.com',
              source: 'check',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result).toEqual(
          expect.objectContaining({
            state: 'ready',
            url: 'https://pr-1.example.amplifyapp.com',
            context: 'AWS Amplify Console Web Preview',
          }),
        );
      });

      test('counts a check run named after the provider’s build service', () => {
        // Cloudflare Workers Builds names its run “Workers Builds: <script>” and links it at the
        // dashboard, so the state is all there is — but a failed build is worth saying out loud
        const result = pickDeployment(
          [
            createCandidate({
              name: 'Workers Builds: my-site',
              url: 'https://dash.cloudflare.com/account-id/workers/builds/abc',
              state: 'error',
              source: 'check',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result).toEqual(
          expect.objectContaining({ state: 'error', context: 'Workers Builds: my-site' }),
        );
      });

      test('ignores an ordinary CI check run, whose URL is a build log', () => {
        const result = pickDeployment(
          [
            createCandidate({
              name: 'unit tests',
              url: 'https://ci.example.com/run/1',
              source: 'check',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result.state).toBe('unknown');
      });

      test('ranks a check run below a commit status reporting the same state', () => {
        const result = pickDeployment(
          [
            createCandidate({
              name: 'deploy preview',
              url: 'https://check.example.com',
              source: 'check',
            }),
            createCandidate({ name: 'deploy preview', url: 'https://status.example.com' }),
          ],
          { kind: 'preview' },
        );

        expect(result.url).toBe('https://status.example.com');
      });
    });

    describe('with preview_context configured', () => {
      beforeEach(() => {
        vi.mocked(get).mockReturnValue({
          backend: { name: 'github', preview_context: 'Deploy-Preview' },
        });
      });

      test('falls back to a case-insensitive substring match', () => {
        const result = pickDeployment(
          [
            createCandidate({ name: 'lint', url: 'https://a.example.com' }),
            createCandidate({
              name: 'netlify/site/deploy-preview',
              url: 'https://b.example.com',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result.url).toBe('https://b.example.com');
      });

      test('prefers an exact match over a substring one, like Decap CMS', () => {
        const result = pickDeployment(
          [
            createCandidate({
              name: 'netlify/site/deploy-preview',
              url: 'https://a.example.com',
              source: 'deployment',
            }),
            createCandidate({ name: 'deploy-preview', url: 'https://b.example.com' }),
          ],
          { kind: 'preview' },
        );

        // The substring match would otherwise win on being a deployment
        expect(result.url).toBe('https://b.example.com');
      });

      test('matches a deployment environment name too', () => {
        const result = pickDeployment(
          [
            createCandidate({
              name: 'Deploy-Preview',
              url: 'https://b.example.com',
              source: 'deployment',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result.url).toBe('https://b.example.com');
      });

      test('accepts a check run the configured context names, whatever it’s called', () => {
        vi.mocked(get).mockReturnValue({
          backend: { name: 'github', preview_context: 'my-provider/deployment' },
        });

        const result = pickDeployment(
          [
            createCandidate({
              name: 'my-provider/deployment',
              url: 'https://custom.example.com',
              source: 'check',
            }),
          ],
          { kind: 'preview' },
        );

        expect(result.url).toBe('https://custom.example.com');
      });

      test('returns unknown rather than falling back when nothing matches', () => {
        const result = pickDeployment(
          [createCandidate({ name: 'netlify/site', url: 'https://a.example.com' })],
          { kind: 'preview' },
        );

        expect(result).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
      });
    });

    describe('a URL leading to a build page rather than a site', () => {
      test('waits out a provider that links to its dashboard until the build lands', () => {
        // Cloudflare Pages posts its dashboard while the build runs, then replaces it with the
        // preview address on success, so the entry must not offer the dashboard in the meantime
        const building = pickDeployment(
          [
            createCandidate({
              name: 'Cloudflare Pages',
              url: 'https://dash.cloudflare.com/?to=/:account/pages/view/my-site/eefc4d6e',
              state: 'pending',
            }),
          ],
          { kind: 'preview', selfURL: 'https://gitlab.com/group/project' },
        );

        expect(building.state).toBe('pending');
        expect(building.url).toBeUndefined();

        const built = pickDeployment(
          [
            createCandidate({
              name: 'Cloudflare Pages',
              url: 'https://eefc4d6e.my-site.pages.dev',
            }),
          ],
          { kind: 'preview', selfURL: 'https://gitlab.com/group/project' },
        );

        expect(built.state).toBe('ready');
        expect(built.url).toBe('https://eefc4d6e.my-site.pages.dev');
      });

      test('ignores the address a failed build left behind', () => {
        const result = pickDeployment(
          [createCandidate({ url: 'https://a.example.com/build/log', state: 'error' })],
          { kind: 'preview' },
        );

        expect(result.state).toBe('error');
        expect(result.url).toBeUndefined();
      });

      test('reports the build state without offering a job page as the site', () => {
        // Every GitLab CI job posts a commit status pointing at its own log
        const result = pickDeployment(
          [
            createCandidate({ name: 'test', url: 'https://gitlab.com/group/project/-/jobs/101' }),
            createCandidate({ name: 'build', url: 'https://gitlab.com/group/project/-/jobs/102' }),
          ],
          { kind: 'preview', selfURL: 'https://gitlab.com/group/project' },
        );

        expect(result.state).toBe('ready');
        expect(result.url).toBeUndefined();
      });

      test('lets the real deploy win over the jobs that only report a log', () => {
        const result = pickDeployment(
          [
            createCandidate({ name: 'test', url: 'https://gitlab.com/group/project/-/jobs/101' }),
            createCandidate({
              name: 'pages',
              url: 'https://group.gitlab.io/project',
              source: 'deployment',
            }),
          ],
          { kind: 'preview', selfURL: 'https://gitlab.com/group/project' },
        );

        expect(result.url).toBe('https://group.gitlab.io/project');
      });

      test('keeps a site hosted elsewhere when the repository URL is unknown', () => {
        const result = pickDeployment([createCandidate({ url: 'https://a.example.com' })], {
          kind: 'preview',
        });

        expect(result.url).toBe('https://a.example.com');
      });
    });
  });
});
