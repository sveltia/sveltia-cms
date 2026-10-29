import { afterEach, describe, expect, test } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import {
  getBranchListPrefix,
  getBranchName,
  getMaxSlugBytes,
  getSlugByteLength,
  isEntryBranch,
  parseBranchName,
  truncateSlugBytes,
} from '$lib/services/workflow/branch';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * Configure the `root_dir` backend option.
 * @param {string} rootDir Option value.
 */
const setRootDir = (rootDir) => {
  // @ts-ignore Partial configuration
  cmsConfig.current = { backend: { name: 'github', repo: 'owner/repo', root_dir: rootDir } };
};

describe('workflow/branch', () => {
  afterEach(() => {
    forkedRepository.current = undefined;
    cmsConfig.current = undefined;
  });

  describe('getBranchName', () => {
    test('creates a branch name from a collection name and slug', () => {
      expect(getBranchName({ collectionName: 'posts', slug: 'hello-world' })).toBe(
        'cms/posts/hello-world',
      );
    });

    test('encodes slashes in a slug', () => {
      // Git can’t hold a branch `cms/pages/about` next to `cms/pages/about/ethos`, so a page and
      // its sub-page in a collection with nested entries couldn’t both be in draft
      expect(getBranchName({ collectionName: 'pages', slug: 'about' })).toBe('cms/pages/about');
      expect(getBranchName({ collectionName: 'pages', slug: 'about/ethos' })).toBe(
        'cms/pages/about%2Fethos',
      );
      expect(getBranchName({ collectionName: 'pages', slug: 'about/ethos/index' })).toBe(
        'cms/pages/about%2Fethos%2Findex',
      );
    });

    test('encodes a percent sign so the slug can be decoded exactly', () => {
      expect(getBranchName({ collectionName: 'posts', slug: '100%/done' })).toBe(
        'cms/posts/100%25%2Fdone',
      );
      expect(getBranchName({ collectionName: 'posts', slug: 'a%2Fb' })).toBe('cms/posts/a%252Fb');
    });

    test('includes the fork path with Open Authoring', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(getBranchName({ collectionName: 'posts', slug: 'hello-world' })).toBe(
        'cms/contributor/repo/posts/hello-world',
      );
    });
    test('includes the root directory', () => {
      setRootDir('/apps/site/');

      expect(getBranchName({ collectionName: 'posts', slug: 'hello-world' })).toBe(
        'cms/apps/site/posts/hello-world',
      );
    });

    test('includes the fork path and the root directory with Open Authoring', () => {
      setRootDir('apps/site');
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(getBranchName({ collectionName: 'posts', slug: 'hello-world' })).toBe(
        'cms/contributor/repo/apps/site/posts/hello-world',
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

    test('decodes an encoded slug', () => {
      expect(parseBranchName('cms/pages/about%2Fethos')).toEqual({
        collectionName: 'pages',
        slug: 'about/ethos',
      });
      expect(parseBranchName('cms/posts/100%25%2Fdone')).toEqual({
        collectionName: 'posts',
        slug: '100%/done',
      });
      expect(parseBranchName('cms/posts/a%252Fb')).toEqual({
        collectionName: 'posts',
        slug: 'a%2Fb',
      });
    });

    test('parses a slug containing slashes', () => {
      // A branch created by Netlify/Decap CMS, or by an earlier version, keeps the slashes
      expect(parseBranchName('cms/posts/2024/hello')).toEqual({
        collectionName: 'posts',
        slug: '2024/hello',
      });
    });

    test('round-trips a slug', () => {
      ['hello', '2024/hello', 'a/b/c', '100%', '%2F', '%25/x', 'a%252Fb'].forEach((slug) => {
        expect(parseBranchName(getBranchName({ collectionName: 'posts', slug }))?.slug).toBe(slug);
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
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(parseBranchName('cms/contributor/repo/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
      });

      // A branch that belongs to another fork, or to the regular flow, isn’t the contributor’s
      expect(parseBranchName('cms/posts/hello-world')).toBeUndefined();
    });
    test('parses a branch of the root directory', () => {
      setRootDir('apps/site');

      expect(parseBranchName('cms/apps/site/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
      });
    });

    test('marks a branch named without the root directory as legacy', () => {
      setRootDir('apps/site');

      // A branch created before the option was set, whose files tell whether it’s this site’s
      expect(parseBranchName('cms/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
        legacy: true,
      });
      // So is another site’s, which its files outside the directory rule out
      expect(parseBranchName('cms/apps/other/posts/hello-world')).toEqual({
        collectionName: 'apps',
        slug: 'other/posts/hello-world',
        legacy: true,
      });
      expect(parseBranchName('feature/foo')).toBeUndefined();
    });

    test('marks a fork branch named without the root directory as legacy', () => {
      setRootDir('apps/site');
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };

      expect(parseBranchName('cms/contributor/repo/apps/site/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
      });
      expect(parseBranchName('cms/contributor/repo/posts/hello-world')).toEqual({
        collectionName: 'posts',
        slug: 'hello-world',
        legacy: true,
      });
      expect(parseBranchName('cms/posts/hello-world')).toBeUndefined();
    });

    test('doesn’t mark anything as legacy without a root directory', () => {
      expect(parseBranchName('cms/posts/hello-world')).not.toHaveProperty('legacy');
    });
  });

  describe('getBranchListPrefix', () => {
    test('leaves the root directory out', () => {
      setRootDir('apps/site');
      expect(getBranchListPrefix()).toBe('cms/');

      forkedRepository.current = { owner: 'contributor', repo: 'repo' };
      expect(getBranchListPrefix()).toBe('cms/contributor/repo/');
    });
  });

  describe('isEntryBranch', () => {
    test('matches the branch of the given entry', () => {
      expect(
        isEntryBranch({ branch: 'cms/posts/hello', collectionName: 'posts', slug: 'hello' }),
      ).toBe(true);
      expect(
        isEntryBranch({
          branch: 'cms/pages/about%2Fethos',
          collectionName: 'pages',
          slug: 'about/ethos',
        }),
      ).toBe(true);
    });

    test('matches a branch whose slug slashes weren’t encoded', () => {
      expect(
        isEntryBranch({
          branch: 'cms/pages/about/ethos',
          collectionName: 'pages',
          slug: 'about/ethos',
        }),
      ).toBe(true);
    });

    test('rejects another entry or an unmanaged branch', () => {
      expect(
        isEntryBranch({ branch: 'cms/posts/hello', collectionName: 'posts', slug: 'hi' }),
      ).toBe(false);
      expect(
        isEntryBranch({ branch: 'cms/posts/hello', collectionName: 'pages', slug: 'hello' }),
      ).toBe(false);
      expect(isEntryBranch({ branch: 'main', collectionName: 'posts', slug: 'hello' })).toBe(false);
    });
  });

  describe('getSlugByteLength', () => {
    test('counts UTF-8 bytes', () => {
      expect(getSlugByteLength('hello')).toBe(5);
      expect(getSlugByteLength('café')).toBe(5);
      expect(getSlugByteLength('日本語')).toBe(9);
      expect(getSlugByteLength('😀')).toBe(4);
    });

    test('counts a slash or percent sign as encoded in a branch name', () => {
      expect(getSlugByteLength('about/us')).toBe(10);
      expect(getSlugByteLength('100%')).toBe(6);
    });
  });

  describe('getMaxSlugBytes', () => {
    const longName = 'c'.repeat(60);

    test('allows 200 bytes with a short branch name prefix', () => {
      expect(getMaxSlugBytes({ collectionName: 'posts' })).toBe(200);
    });

    test('leaves room for a long collection name in the branch name', () => {
      // 244 bytes for the branch name after `refs/heads/`, minus `cms/` and the name with a slash
      expect(getMaxSlugBytes({ collectionName: longName })).toBe(179);
      expect(getMaxSlugBytes({ collectionName: '日'.repeat(20) })).toBe(179);
    });

    test('counts the fork and the root directory in the branch name prefix', () => {
      forkedRepository.current = { owner: 'contributor', repo: 'repo' };
      expect(getMaxSlugBytes({ collectionName: longName })).toBe(162);

      forkedRepository.current = undefined;
      setRootDir('apps/site');
      expect(getMaxSlugBytes({ collectionName: longName })).toBe(169);
    });

    test('counts the folder of an entry in a collection with nested entries', () => {
      expect(getMaxSlugBytes({ collectionName: longName, dirPath: 'docs' })).toBe(172);
      expect(getMaxSlugBytes({ collectionName: longName, dirPath: 'a/b' })).toBe(171);
      expect(getMaxSlugBytes({ collectionName: longName, dirPath: '' })).toBe(179);
    });

    test('never goes below 32 bytes', () => {
      expect(getMaxSlugBytes({ collectionName: 'c'.repeat(250) })).toBe(32);
    });
  });

  describe('truncateSlugBytes', () => {
    test('returns a short slug as is', () => {
      expect(truncateSlugBytes('hello', 5)).toBe('hello');
      expect(truncateSlugBytes('', 5)).toBe('');
    });

    test('cuts an ASCII slug at the given number of bytes', () => {
      expect(truncateSlugBytes('hello-world', 7)).toBe('hello-w');
    });

    test('never cuts inside a multi-byte character', () => {
      expect(truncateSlugBytes('日本語', 8)).toBe('日本');
      expect(truncateSlugBytes('日本語', 6)).toBe('日本');
      expect(truncateSlugBytes('日本語', 2)).toBe('');
    });

    test('never breaks a character made up of several code points', () => {
      // A thumbs up with a skin tone (8 bytes) and an `e` with a combining acute accent (3 bytes)
      expect(truncateSlugBytes('a👍🏽', 8)).toBe('a');
      expect(truncateSlugBytes('ae\u0301', 3)).toBe('a');
    });

    test('counts a slash as encoded in a branch name', () => {
      expect(truncateSlugBytes('a/b', 3)).toBe('a');
      expect(truncateSlugBytes('a/b', 4)).toBe('a/');
    });
  });
});
