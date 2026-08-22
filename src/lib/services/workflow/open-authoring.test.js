import { get } from 'svelte/store';
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
    forkedRepository.set(undefined);
    forkPermissionRequest.set(undefined);
  });

  describe('openAuthoring', () => {
    test('is off until a fork is set', () => {
      expect(get(openAuthoring)).toBe(false);

      forkedRepository.set({ owner: 'contributor', repo: 'repo' });
      expect(get(openAuthoring)).toBe(true);

      forkedRepository.set(undefined);
      expect(get(openAuthoring)).toBe(false);
    });
  });

  describe('workflowStages', () => {
    test('offers every stage to a maintainer', () => {
      expect(get(workflowStages)).toEqual(['draft', 'pending_review', 'pending_publish']);
    });

    test('leaves out the publishing stage for a contributor', () => {
      forkedRepository.set({ owner: 'contributor', repo: 'repo' });
      expect(get(workflowStages)).toEqual(['draft', 'pending_review']);
    });
  });

  describe('requestForkPermission', () => {
    test('resolves with the answer and takes the request down', async () => {
      const promise = requestForkPermission('owner/repo');
      const request = get(forkPermissionRequest);

      expect(request?.repo).toBe('owner/repo');

      request?.respond(true);

      await expect(promise).resolves.toBe(true);
      expect(get(forkPermissionRequest)).toBeUndefined();
    });

    test('resolves with false when the user declines', async () => {
      const promise = requestForkPermission('owner/repo');

      get(forkPermissionRequest)?.respond(false);

      await expect(promise).resolves.toBe(false);
    });

    test('answering a stale request leaves the current one alone', async () => {
      const firstPromise = requestForkPermission('owner/repo');
      const firstRequest = get(forkPermissionRequest);
      // A second request cancels the first one, which resolves as declined
      const secondPromise = requestForkPermission('owner/other');

      await expect(firstPromise).resolves.toBe(false);

      const secondRequest = get(forkPermissionRequest);

      expect(secondRequest?.repo).toBe('owner/other');

      // The stale request can’t dismiss the dialog belonging to the new one
      firstRequest?.respond(true);
      expect(get(forkPermissionRequest)).toBe(secondRequest);

      secondRequest?.respond(true);
      await expect(secondPromise).resolves.toBe(true);
    });
  });
});
