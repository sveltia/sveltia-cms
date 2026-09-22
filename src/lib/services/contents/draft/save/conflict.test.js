import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkForRemoteChanges } from '$lib/services/backends/refresh';
import { allEntries } from '$lib/services/contents';

import { compareWithStore, describeConflict, detectEntryConflict } from './conflict';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, options) => (options?.values ? `${key}:${JSON.stringify(options.values)}` : key)),
}));
vi.mock('$lib/services/backends/refresh', () => ({ checkForRemoteChanges: vi.fn() }));
vi.mock('$lib/services/contents', () => ({ allEntries: { current: [] } }));
vi.mock('$lib/services/utils/date', () => ({
  formatDate: vi.fn((date, locale) => `${date.toISOString()}@${locale}`),
}));

/**
 * Make a minimal entry.
 * @param {string} id Entry ID.
 * @param {string} title Title in the content.
 * @param {Record<string, any>} [extra] Any other properties.
 * @returns {any} Entry.
 */
const makeEntry = (id, title, extra = {}) => ({
  id,
  locales: { _default: { slug: id, path: `${id}.md`, content: { title } } },
  ...extra,
});

describe('compareWithStore', () => {
  test('reports a deleted entry', () => {
    allEntries.current = [];

    expect(compareWithStore(makeEntry('a', 'A'))).toEqual({ type: 'deleted' });
  });

  test('reports a modified entry along with its current version', () => {
    const current = makeEntry('a', 'A, revised');

    allEntries.current = [current];

    expect(compareWithStore(makeEntry('a', 'A'))).toEqual({ type: 'modified', entry: current });
  });

  test('reports a locale file added as a change', () => {
    const current = makeEntry('a', 'A');

    current.locales.fr = { slug: 'a', path: 'fr/a.md', content: { title: 'A (fr)' } };
    allEntries.current = [current];

    expect(compareWithStore(makeEntry('a', 'A'))).toEqual({ type: 'modified', entry: current });
  });

  test('reports nothing when the content is the same, whatever the object', () => {
    // Different objects and commit metadata, same parsed content
    allEntries.current = [makeEntry('a', 'A', { commitDate: new Date() })];

    expect(compareWithStore(makeEntry('a', 'A'))).toBeUndefined();
  });
});

describe('detectEntryConflict', () => {
  beforeEach(() => {
    allEntries.current = [];
  });

  test('has nothing to check for a new entry', async () => {
    expect(await detectEntryConflict(/** @type {any} */ ({ isNew: true }))).toBeUndefined();
    expect(checkForRemoteChanges).not.toHaveBeenCalled();
  });

  test('checks the repository, then compares', async () => {
    const original = makeEntry('a', 'A');
    const current = makeEntry('a', 'A, revised');

    // Store still has the original until the check brings in the change
    allEntries.current = [original];
    vi.mocked(checkForRemoteChanges).mockImplementation(async () => {
      allEntries.current = [current];

      return undefined;
    });

    expect(
      await detectEntryConflict(/** @type {any} */ ({ isNew: false, originalEntry: original })),
    ).toEqual({ type: 'modified', entry: current });
  });

  test('compares against what’s known when the check fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = makeEntry('a', 'A');

    // A previous check already brought the change in
    allEntries.current = [makeEntry('a', 'A, revised')];
    vi.mocked(checkForRemoteChanges).mockRejectedValue(new Error('offline'));

    expect(
      await detectEntryConflict(/** @type {any} */ ({ isNew: false, originalEntry: original })),
    ).toMatchObject({ type: 'modified' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('finds nothing when the entry is untouched', async () => {
    const original = makeEntry('a', 'A');

    allEntries.current = [original];
    vi.mocked(checkForRemoteChanges).mockResolvedValue(undefined);

    expect(
      await detectEntryConflict(/** @type {any} */ ({ isNew: false, originalEntry: original })),
    ).toBeUndefined();
  });
});

describe('describeConflict', () => {
  test('describes a deletion', () => {
    expect(describeConflict({ type: 'deleted' })).toEqual({
      description: 'save_conflict.deleted',
      warning: 'save_conflict.recreate_warning',
    });
  });

  test('names the author and date when known', () => {
    const commitDate = new Date('2026-01-02T03:04:05Z');

    const entry = makeEntry('a', 'A', {
      commitAuthor: { name: 'Alex', login: 'alex', email: 'alex@example.com' },
      commitDate,
    });

    expect(describeConflict({ type: 'modified', entry }, 'en-US')).toEqual({
      description: `save_conflict.modified_by:${JSON.stringify({
        name: 'Alex',
        date: `${commitDate.toISOString()}@en-US`,
      })}`,
      warning: 'save_conflict.overwrite_warning',
    });
  });

  test('falls back to the login or email for the name', () => {
    const commitDate = new Date('2026-01-02T03:04:05Z');

    expect(
      describeConflict(
        {
          type: 'modified',
          entry: makeEntry('a', 'A', { commitAuthor: { login: 'alex' }, commitDate }),
        },
        'en-US',
      ).description,
    ).toContain('"name":"alex"');

    expect(
      describeConflict(
        {
          type: 'modified',
          entry: makeEntry('a', 'A', { commitAuthor: { email: 'alex@example.com' }, commitDate }),
        },
        'en-US',
      ).description,
    ).toContain('"name":"alex@example.com"');
  });

  test('describes a change without naming anyone when the author isn’t known', () => {
    expect(describeConflict({ type: 'modified', entry: makeEntry('a', 'A') })).toEqual({
      description: 'save_conflict.modified',
      warning: 'save_conflict.overwrite_warning',
    });

    // Or when the date isn’t
    expect(
      describeConflict({
        type: 'modified',
        entry: makeEntry('a', 'A', { commitAuthor: { name: 'Alex' } }),
      }).description,
    ).toBe('save_conflict.modified');
  });
});
