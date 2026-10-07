import { beforeEach, describe, expect, test } from 'vitest';

import {
  ENTRY_ALREADY_PUBLISHED,
  forkedRepository,
  forkPermissionRequest,
  getForkPath,
  getForkURL,
  isEntryAlreadyPublished,
  openAuthoring,
  requestForkPermission,
  workflowStages,
} from '$lib/services/workflow/open-authoring';

describe('workflow/open-authoring', () => {
  beforeEach(() => {
    forkedRepository.current = undefined;
    forkPermissionRequest.current = undefined;
  });

  describe('openAuthoring', () => {
    test('is off until a fork is set', () => {
      expect(openAuthoring.current).toBe(false);

      forkedRepository.current = { owner: 'contributor', repo: 'repo' };
      expect(openAuthoring.current).toBe(true);

      forkedRepository.current = undefined;
      expect(openAuthoring.current).toBe(false);
    });
  });

  describe('workflowStages', () => {
    test('offers every stage to a maintainer', () => {
      expect(workflowStages.current).toEqual(['draft', 'pending_review', 'pending_publish']);
    });

    test('leaves out the publishing stage for a contributor', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };
      expect(workflowStages.current).toEqual(['draft', 'pending_review']);
    });
  });

  describe('isEntryAlreadyPublished', () => {
    test('tells the error that says an entry has been published', () => {
      expect(isEntryAlreadyPublished(new Error(ENTRY_ALREADY_PUBLISHED))).toBe(true);
      expect(isEntryAlreadyPublished(new Error('Failed'))).toBe(false);
      expect(isEntryAlreadyPublished(undefined)).toBe(false);
    });
  });

  describe('getForkPath', () => {
    test('names the fork', () => {
      expect(getForkPath({ owner: 'contributor', repo: 'site' })).toBe('contributor/site');
    });

    test('is empty without a fork', () => {
      expect(getForkPath(undefined)).toBe('');
    });
  });

  describe('getForkURL', () => {
    /** @type {any} */
    const fork = { owner: 'me', repo: 'site' };

    test('swaps the configured path for the fork’s', () => {
      expect(
        getForkURL(
          /** @type {any} */ ({
            repoURL: 'https://github.com/acme/site',
            owner: 'acme',
            repo: 'site',
          }),
          fork,
        ),
      ).toBe('https://github.com/me/site');
    });

    test('keeps the path a self-hosted instance sits under', () => {
      // GitLab can be served under a relative URL root, which resolving the fork against the origin
      // would drop, leaving the link pointing at a page that isn’t there
      expect(
        getForkURL(
          /** @type {any} */ ({
            repoURL: 'https://example.com/gitlab/group/project',
            owner: 'group',
            repo: 'project',
          }),
          /** @type {any} */ ({ owner: 'me', repo: 'project' }),
        ),
      ).toBe('https://example.com/gitlab/me/project');
    });

    test('takes a fork out of a nested group', () => {
      // The configured project can sit in a nested group, while a fork on GitLab lands directly
      // under the contributor’s namespace, so the path is swapped whole rather than by segment
      expect(
        getForkURL(
          /** @type {any} */ ({
            repoURL: 'https://gitlab.com/acme/web/site',
            owner: 'acme/web',
            repo: 'site',
          }),
          fork,
        ),
      ).toBe('https://gitlab.com/me/site');
    });

    test('is empty while the repository isn’t known', () => {
      expect(getForkURL(undefined, fork)).toBe('');
      expect(getForkURL(/** @type {any} */ ({ repoURL: '' }), fork)).toBe('');
    });

    test('is empty without a fork', () => {
      expect(
        getForkURL(
          /** @type {any} */ ({
            repoURL: 'https://github.com/acme/site',
            owner: 'acme',
            repo: 'site',
          }),
          undefined,
        ),
      ).toBe('');
    });
  });

  describe('requestForkPermission', () => {
    test('resolves with the answer and takes the request down', async () => {
      const promise = requestForkPermission('owner/repo');
      const request = forkPermissionRequest.current;

      expect(request?.repo).toBe('owner/repo');

      request?.respond(true);

      await expect(promise).resolves.toBe(true);
      expect(forkPermissionRequest.current).toBeUndefined();
    });

    test('resolves with false when the user declines', async () => {
      const promise = requestForkPermission('owner/repo');

      forkPermissionRequest.current?.respond(false);

      await expect(promise).resolves.toBe(false);
    });

    test('answering a stale request leaves the current one alone', async () => {
      const firstPromise = requestForkPermission('owner/repo');
      const firstRequest = forkPermissionRequest.current;
      // A second request cancels the first one, which resolves as declined
      const secondPromise = requestForkPermission('owner/other');

      await expect(firstPromise).resolves.toBe(false);

      const secondRequest = forkPermissionRequest.current;

      expect(secondRequest?.repo).toBe('owner/other');

      // The stale request can’t dismiss the dialog belonging to the new one
      firstRequest?.respond(true);
      expect(forkPermissionRequest.current).toBe(secondRequest);

      secondRequest?.respond(true);
      await expect(secondPromise).resolves.toBe(true);
    });
  });
});
