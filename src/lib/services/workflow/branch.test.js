import { afterEach, describe, expect, test } from 'vitest';

import { getBranchName, parseBranchName } from '$lib/services/workflow/branch';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

describe('workflow/branch', () => {
  afterEach(() => {
    forkedRepository.set(undefined);
  });

  describe('getBranchName', () => {
    test('creates a branch name from a collection name and slug', () => {
      expect(getBranchName({ collectionName: 'posts', slug: 'hello-world' })).toBe(
        'cms/posts/hello-world',
      );
    });

    test('keeps slashes in a slug', () => {
      expect(getBranchName({ collectionName: 'posts', slug: '2024/hello' })).toBe(
        'cms/posts/2024/hello',
      );
    });

    test('includes the fork path with Open Authoring', () => {
      forkedRepository.set({ owner: 'contributor', repo: 'repo' });

      expect(getBranchName({ collectionName: 'posts', slug: 'hello-world' })).toBe(
        'cms/contributor/repo/posts/hello-world',
      );
    });
  });

  describe('parseBranchName', () => {
    test('parses a valid branch name', () => {
      expect(parseBranchName('cms/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
      });
    });

    test('parses a slug containing slashes', () => {
      expect(parseBranchName('cms/posts/2024/hello')).toEqual({
        collectionName: 'posts',
        slug: '2024/hello',
      });
    });

    test('returns undefined for a branch not managed by the CMS', () => {
      expect(parseBranchName('main')).toBeUndefined();
      expect(parseBranchName('feature/foo')).toBeUndefined();
      expect(parseBranchName('cms/posts')).toBeUndefined();
      expect(parseBranchName('cms/posts/')).toBeUndefined();
      expect(parseBranchName('cms//hello')).toBeUndefined();
    });

    test('parses a fork branch with Open Authoring', () => {
      forkedRepository.set({ owner: 'contributor', repo: 'repo' });

      expect(parseBranchName('cms/contributor/repo/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
      });

      // A branch that belongs to another fork, or to the regular flow, isn’t the contributor’s
      expect(parseBranchName('cms/posts/hello-world')).toBeUndefined();
    });
  });
});
