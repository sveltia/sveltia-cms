import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { getPreviewLinkControl, resolveEntryPreviewLink } from '$lib/services/deployments/control';
import { getEntryPreviewLink } from '$lib/services/deployments/link';

vi.mock('$lib/services/deployments/link', async (importOriginal) => {
  /** @type {typeof import('$lib/services/deployments/link')} */
  const actual = await importOriginal();

  return { ...actual, getEntryPreviewLink: vi.fn() };
});

/**
 * @import { EntryPreviewLink } from '$lib/types/private';
 */

const entry = /** @type {any} */ ({ slug: 'hello' });
const collection = /** @type {any} */ ({ name: 'posts' });
const pullRequest = /** @type {any} */ ({ number: 1, headSHA: 'abc' });
const deployMap = { def: { state: /** @type {const} */ ('pending'), checkedTime: 0 } };

/**
 * Build a resolved link.
 * @param {Partial<EntryPreviewLink>} [overrides] Properties to override.
 * @returns {EntryPreviewLink} Link.
 */
const createLink = (overrides = {}) => ({
  url: 'https://example.com/posts/hello',
  state: 'unknown',
  isDeployPreview: false,
  awaitingPreview: false,
  pingable: true,
  ...overrides,
});

describe('resolveEntryPreviewLink()', () => {
  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({ _baseURL: 'https://example.com' });
    deployments.current = deployMap;
    productionSHA.current = 'def';
    deployPollTimedOut.current = true;
  });

  test('follows the deploy state by default', () => {
    resolveEntryPreviewLink({ entry, locale: 'en', collection });

    expect(getEntryPreviewLink).toHaveBeenCalledWith({
      entry,
      locale: 'en',
      collection,
      deployments: deployMap,
      productionSHA: 'def',
      pollTimedOut: true,
    });
  });

  test('leaves the deploy state out for a published entry on the configured site', () => {
    resolveEntryPreviewLink({ entry, locale: 'en', collection, trackDeployState: false });

    expect(getEntryPreviewLink).toHaveBeenCalledWith({
      entry,
      locale: 'en',
      collection,
      deployments: {},
      productionSHA: '',
      pollTimedOut: false,
    });
  });

  test('always follows the deploy state of an unpublished entry', () => {
    resolveEntryPreviewLink({
      entry,
      locale: 'en',
      collection,
      pullRequest,
      trackDeployState: false,
    });

    expect(getEntryPreviewLink).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest, deployments: deployMap, productionSHA: 'def' }),
    );
  });

  test('follows the deploy state without `site_url`, as the deployment’s URL stands in', () => {
    cmsConfig.current = /** @type {any} */ ({ _baseURL: '' });
    resolveEntryPreviewLink({ entry, locale: 'en', collection, trackDeployState: false });
    expect(getEntryPreviewLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ deployments: deployMap, productionSHA: 'def' }),
    );

    cmsConfig.current = undefined;
    resolveEntryPreviewLink({ entry, locale: 'en', collection, trackDeployState: false });
    expect(getEntryPreviewLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ deployments: deployMap, productionSHA: 'def' }),
    );
  });
});

describe('getPreviewLinkControl()', () => {
  test('links to the live site', () => {
    expect(getPreviewLinkControl(createLink())).toEqual({
      disabled: false,
      labelKey: 'view_on_live_site',
      descriptionKey: undefined,
    });
  });

  test('links to a deploy preview, describing a build that isn’t finished', () => {
    expect(getPreviewLinkControl(createLink({ isDeployPreview: true, state: 'ready' }))).toEqual({
      disabled: false,
      labelKey: 'deploy_preview.view',
      descriptionKey: undefined,
    });

    // A page that doesn’t answer yet is still being propagated
    expect(
      getPreviewLinkControl(createLink({ isDeployPreview: true, state: 'ready' }), 'pending'),
    ).toEqual({
      disabled: false,
      labelKey: 'deploy_preview.view',
      descriptionKey: 'deploy_preview.building',
    });
  });

  test('waits for a deploy preview that’s on its way', () => {
    expect(getPreviewLinkControl(createLink({ awaitingPreview: true, state: 'pending' }))).toEqual({
      disabled: true,
      labelKey: 'deploy_preview.awaiting',
      descriptionKey: 'deploy_preview.building',
    });
  });

  test('offers nothing to open without a URL, or for a failed deploy preview', () => {
    expect(getPreviewLinkControl(createLink({ url: undefined })).disabled).toBe(true);
    expect(
      getPreviewLinkControl(createLink({ isDeployPreview: true, state: 'error' })).disabled,
    ).toBe(true);
    // The live site is worth opening whatever the build did
    expect(getPreviewLinkControl(createLink({ state: 'error' })).disabled).toBe(false);
  });
});
