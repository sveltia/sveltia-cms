import { describe, expect, test, vi } from 'vitest';

import {
  getForkBranchName,
  getForkEntryNotice,
  getForkHead,
  getUpstreamBranchName,
  isForkEntry,
  isLockedFork,
  isLockedForkEntry,
  parseForkBranchName,
} from '$lib/services/workflow/forks';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => `${key}:${JSON.stringify(values)}`),
}));

/**
 * Create an unpublished entry from the given pull request properties.
 * @param {Record<string, any>} [pullRequest] Pull request properties.
 * @returns {any} Entry.
 */
const createEntry = (pullRequest = {}) => ({
  id: 'id',
  slug: 'hello',
  subPath: 'hello',
  locales: {},
  workflow: { pullRequest: { branch: 'cms/posts/hello', ...pullRequest } },
});

describe('workflow/forks', () => {
  describe('getForkBranchName()', () => {
    test('qualifies the branch with the fork', () => {
      expect(
        getForkBranchName({ owner: 'alice', repo: 'website', branch: 'cms/posts/hello' }),
      ).toBe('alice/website:cms/posts/hello');
    });
  });

  describe('parseForkBranchName()', () => {
    test('reads the fork and the branch back', () => {
      expect(parseForkBranchName('alice/website:cms/posts/hello')).toEqual({
        owner: 'alice',
        repo: 'website',
        branch: 'cms/posts/hello',
      });
    });

    test('reads a namespace with subgroups as the owner', () => {
      expect(parseForkBranchName('acme/docs/website:cms/posts/hello')).toEqual({
        owner: 'acme/docs',
        repo: 'website',
        branch: 'cms/posts/hello',
      });
    });

    test('takes everything after the first separator as the branch', () => {
      expect(parseForkBranchName('alice/website:cms/posts/a:b')?.branch).toBe('cms/posts/a:b');
    });

    test('returns undefined for a branch of the workflow repository', () => {
      expect(parseForkBranchName('cms/posts/hello')).toBeUndefined();
    });

    test.each([
      ['no owner', '/website:cms/posts/hello'],
      ['no repository', 'alice:cms/posts/hello'],
      ['an empty repository', 'alice/:cms/posts/hello'],
      ['an empty namespace segment', 'acme//website:cms/posts/hello'],
      ['no branch', 'alice/website:'],
    ])('returns undefined for a name with %s', (_label, name) => {
      expect(parseForkBranchName(name)).toBeUndefined();
    });
  });

  describe('getUpstreamBranchName()', () => {
    test('takes the fork and its path off a contributor’s branch', () => {
      expect(getUpstreamBranchName('alice/website:cms/alice/website/posts/hello')).toBe(
        'cms/posts/hello',
      );
      // GitHub user and repository names don’t depend on case
      expect(getUpstreamBranchName('alice/website:cms/Alice/Website/posts/hello')).toBe(
        'cms/posts/hello',
      );
    });

    test('takes only the fork off a contributor’s branch named without its path', () => {
      expect(getUpstreamBranchName('alice/website:cms/posts/hello')).toBe('cms/posts/hello');
      expect(getUpstreamBranchName('alice/website:cms/bob/website/posts/hello')).toBe(
        'cms/bob/website/posts/hello',
      );
      expect(getUpstreamBranchName('alice/website:hello')).toBe('hello');
    });

    test('leaves any other name as it is', () => {
      expect(getUpstreamBranchName('cms/posts/hello')).toBe('cms/posts/hello');
    });
  });

  describe('getForkHead(), isForkEntry() and isLockedForkEntry()', () => {
    test('report an entry from a fork that maintainers can edit', () => {
      const fork = { owner: 'alice', repo: 'website', editable: true };
      const entry = createEntry({ fork });

      expect(getForkHead(entry)).toBe(fork);
      expect(isForkEntry(entry)).toBe(true);
      expect(isLockedForkEntry(entry)).toBe(false);
    });

    test('report an entry from a fork that maintainers can’t edit', () => {
      const entry = createEntry({ fork: { owner: 'alice', repo: 'website', editable: false } });

      expect(isForkEntry(entry)).toBe(true);
      expect(isLockedForkEntry(entry)).toBe(true);
    });

    test('report nothing for the maintainers’ own entry or a published one', () => {
      expect(isForkEntry(createEntry())).toBe(false);
      expect(isLockedForkEntry(createEntry())).toBe(false);
      expect(isForkEntry(/** @type {any} */ ({ slug: 'hello', locales: {} }))).toBe(false);
      expect(isForkEntry(undefined)).toBe(false);
      expect(isLockedForkEntry(null)).toBe(false);
    });
  });

  describe('isLockedFork()', () => {
    test('tells whether maintainers can’t push to the branch', () => {
      expect(isLockedFork({ owner: 'alice', repo: 'website', editable: false })).toBe(true);
      expect(isLockedFork({ owner: 'alice', repo: 'website', editable: true })).toBe(false);
      expect(isLockedFork(undefined)).toBe(false);
    });
  });

  describe('getForkEntryNotice()', () => {
    test('says the changes go to the contributor’s branch', () => {
      expect(
        getForkEntryNotice(
          createEntry({ fork: { owner: 'alice', repo: 'website', editable: true } }),
        ),
      ).toBe('workflow.fork_entry_editable:{"fork":"alice/website"}');
    });

    test('says the entry can only be viewed', () => {
      expect(
        getForkEntryNotice(
          createEntry({ fork: { owner: 'alice', repo: 'website', editable: false } }),
        ),
      ).toBe('workflow.fork_entry_locked:{"fork":"alice/website"}');
    });

    test('returns undefined for an entry not from a fork', () => {
      expect(getForkEntryNotice(createEntry())).toBeUndefined();
    });
  });
});
