import { describe, expect, test } from 'vitest';

import { getBranchName, parseBranchName } from '$lib/services/workflow/branch';

describe('workflow/branch', () => {
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
    });
  });
});
