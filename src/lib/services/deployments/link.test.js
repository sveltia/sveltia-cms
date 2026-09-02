import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getEntryPreviewURL } from '$lib/services/contents/entry';
import { getEntryPreviewLink, refineState } from '$lib/services/deployments/link';

vi.mock('$lib/services/contents/entry');

/**
 * @import { DeployState, PageLiveness } from '$lib/types/private';
 */

const entry = /** @type {any} */ ({ slug: 'hello' });
const collection = /** @type {any} */ ({ name: 'posts' });

/**
 * Call the composition function with sensible defaults.
 * @param {object} [overrides] Arguments to override.
 * @returns {any} Resolved link.
 */
const resolve = (overrides = {}) =>
  getEntryPreviewLink(
    /** @type {any} */ ({
      entry,
      locale: 'en',
      collection,
      collectionFile: undefined,
      pullRequest: undefined,
      deployments: {},
      productionSHA: '',
      ...overrides,
    }),
  );

describe('Preview link composition', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('refineState', () => {
    /** @type {[DeployState, PageLiveness | undefined, DeployState][]} */
    const cases = [
      // A page that responds beats whatever the provider said
      ['pending', 'ready', 'ready'],
      ['unknown', 'ready', 'ready'],
      ['checking', 'ready', 'ready'],
      // A finished build whose page is missing is a CDN that hasn’t propagated
      ['ready', 'pending', 'pending'],
      ['pending', 'pending', 'pending'],
      ['unknown', 'pending', 'unknown'],
      // An inconclusive check never overrides the provider
      ['pending', 'unknown', 'pending'],
      ['ready', 'unknown', 'ready'],
      ['pending', undefined, 'pending'],
      // A check never turns into or out of a failure
      ['error', 'ready', 'error'],
      ['error', 'pending', 'error'],
    ];

    test.each(cases)('refines %s with %s to %s', (state, liveness, expected) => {
      expect(refineState(state, liveness)).toBe(expected);
    });
  });

  describe('getEntryPreviewLink', () => {
    describe('for a published entry', () => {
      test('returns the live site link', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(resolve()).toEqual({
          url: 'https://example.com/posts/hello',
          state: 'unknown',
          isDeployPreview: false,
          awaitingPreview: false,
          pingable: true,
        });
      });

      test('returns undefined without a usable URL', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue(undefined);

        expect(resolve()).toBeUndefined();
      });

      test('reports the production build state', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            productionSHA: 'abc',
            deployments: { abc: { state: 'pending', checkedTime: 0 } },
          }).state,
        ).toBe('pending');
      });

      // The liveness is folded in by the caller, via `refineState()`, so that the check made on
      // this URL can’t change the URL it was made on
      // @see https://github.com/sveltia/sveltia-cms/issues/943
      test('reports the provider state without folding in the liveness', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            productionSHA: 'abc',
            deployments: { abc: { state: 'ready', checkedTime: 0 } },
          }).state,
        ).toBe('ready');
      });

      test('falls back to the deployment URL when site_url is unset', () => {
        // The first call has no base URL to work with, the second gets the deployment’s
        vi.mocked(getEntryPreviewURL).mockImplementation((_e, _l, _c, _f, options) =>
          options?.baseURL ? `${options.baseURL}/posts/hello` : undefined,
        );

        expect(
          resolve({
            productionSHA: 'abc',
            deployments: {
              abc: { state: 'ready', url: 'https://built.example.com', checkedTime: 0 },
            },
          }),
        ).toEqual({
          url: 'https://built.example.com/posts/hello',
          state: 'ready',
          isDeployPreview: false,
          awaitingPreview: false,
          pingable: true,
        });
      });
    });

    describe('for an unpublished entry', () => {
      const pullRequest = /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' });
      const withSHA = /** @type {any} */ ({ ...pullRequest, headSHA: 'abc' });

      test('returns the deploy preview link', () => {
        vi.mocked(getEntryPreviewURL).mockImplementation(
          (_e, _l, _c, _f, options) => `${options?.baseURL}/posts/hello`,
        );

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: {
              abc: { state: 'ready', url: 'https://preview.example.com', checkedTime: 0 },
            },
          }),
        ).toEqual({
          url: 'https://preview.example.com/posts/hello',
          state: 'ready',
          isDeployPreview: true,
          awaitingPreview: false,
          // The build is done, so all that’s left to confirm is that the page is being served
          pingable: true,
        });
      });

      test('marks a reported preview as worth checking for liveness', () => {
        // A preview address is only reported once the build is done, so a page that doesn’t answer
        // is a CDN that hasn’t caught up rather than a build still running. That distinction is
        // made by the caller, which folds the liveness of this URL into the state with
        // `refineState()`; here the build state is reported as the provider gave it
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://preview.example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: {
              abc: { state: 'ready', url: 'https://preview.example.com', checkedTime: 0 },
            },
          }),
        ).toEqual(expect.objectContaining({ state: 'ready', pingable: true }));
      });

      test('returns undefined when the preview path cannot be composed', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue(undefined);

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: {
              abc: { state: 'ready', url: 'https://preview.example.com', checkedTime: 0 },
            },
          }),
        ).toBeUndefined();
      });

      test('keeps the live site link while the build has no URL yet', () => {
        // Dropping the link would take away the one the CMS has always shown, and `checking` is
        // the state on the first render of every unpublished entry
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'pending', checkedTime: 0 } },
          }),
        ).toEqual({
          url: 'https://example.com/posts/hello',
          // The state travels with it, so the control can say a preview is on its way rather than
          // offering a link to the published version — or to nothing, for a new entry
          state: 'pending',
          isDeployPreview: false,
          awaitingPreview: true,
          pingable: false,
        });
      });

      test('waits rather than linking a brand-new entry to a page that isn’t there', () => {
        // Nothing has ever been published under this path, so the live site would 404
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'pending', checkedTime: 0 } },
          }).awaitingPreview,
        ).toBe(true);
      });

      test('stops waiting once the re-checks have given up', () => {
        // A spinner still turning while nothing is being checked would be a lie
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'pending', checkedTime: 0 } },
            pollTimedOut: true,
          }),
        ).toEqual(
          expect.objectContaining({
            url: 'https://example.com/posts/hello',
            state: 'pending',
            awaitingPreview: false,
          }),
        );
      });

      test('offers the live site link once the wait is over', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        // A build that failed or reported nothing isn’t worth waiting on any longer
        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'error', checkedTime: 0 } },
          }).awaitingPreview,
        ).toBe(false);
      });

      test('keeps the live site link while the lookup is in flight', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'checking', checkedTime: 0 } },
          }),
        ).toEqual(
          expect.objectContaining({
            url: 'https://example.com/posts/hello',
            state: 'checking',
            isDeployPreview: false,
          }),
        );
      });

      test('returns undefined when there’s no live site link either', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue(undefined);

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'pending', checkedTime: 0 } },
          }),
        ).toBeUndefined();
      });

      test('falls back to the live site link without a deploy preview', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'unknown', checkedTime: 0 } },
          }),
        ).toEqual({
          url: 'https://example.com/posts/hello',
          state: 'unknown',
          isDeployPreview: false,
          // Nothing is coming, so the link is offered rather than withheld
          awaitingPreview: false,
          // The entry isn’t on the production site yet, so checking it would always report a 404
          pingable: false,
        });
      });

      test('falls back to the live site link when the build failed', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(
          resolve({
            pullRequest: withSHA,
            deployments: { abc: { state: 'error', checkedTime: 0 } },
          }),
        ).toEqual(expect.objectContaining({ state: 'error', isDeployPreview: false }));
      });

      test('falls back to the live site link before the head commit is known', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue('https://example.com/posts/hello');

        expect(resolve({ pullRequest })).toEqual(
          expect.objectContaining({ state: 'unknown', isDeployPreview: false }),
        );
      });

      test('returns undefined when even the live site link is unavailable', () => {
        vi.mocked(getEntryPreviewURL).mockReturnValue(undefined);

        expect(resolve({ pullRequest })).toBeUndefined();
      });
    });
  });
});
