import { beforeEach, describe, expect, test } from 'vitest';

import {
  forkedRepository,
  forkPermissionRequest,
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
