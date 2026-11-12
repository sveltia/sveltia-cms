import { beforeEach, describe, expect, test } from 'vitest';

import {
  fileStates,
  setFileState,
  takeOverFileState,
  updateFileState,
} from '$lib/services/contents/file/state';

beforeEach(() => {
  fileStates.clear();
});

describe('setFileState()', () => {
  test('replaces what is remembered about a file, leaving out what is `undefined`', () => {
    updateFileState('a.md', { format: 'toml-frontmatter' });
    setFileState('a.md', { leadingComment: '# Note', valueSources: undefined });

    expect(fileStates.get('a.md')).toEqual({ leadingComment: '# Note' });

    setFileState('a.md', {});

    expect(fileStates.has('a.md')).toBe(false);
  });
});

describe('updateFileState()', () => {
  test('adds to what is remembered about a file', () => {
    updateFileState('a.md', { format: 'toml-frontmatter' });
    updateFileState('a.md', { leadingComment: '# Note' });

    expect(fileStates.get('a.md')).toEqual({
      format: 'toml-frontmatter',
      leadingComment: '# Note',
    });
  });

  test('forgets a property set to `undefined`, and the file once nothing is left', () => {
    updateFileState('a.md', { format: 'toml-frontmatter', leadingComment: '# Note' });
    updateFileState('a.md', { leadingComment: undefined });

    expect(fileStates.get('a.md')).toEqual({ format: 'toml-frontmatter' });

    updateFileState('a.md', { format: undefined });

    expect(fileStates.has('a.md')).toBe(false);

    // Nothing to remember about a file never adds it
    updateFileState('b.md', { leadingComment: undefined });

    expect(fileStates.has('b.md')).toBe(false);
  });
});

describe('takeOverFileState()', () => {
  const state = {
    format: /** @type {const} */ ('toml-frontmatter'),
    valueSources: { a: { value: 10, source: '10.0' } },
    leadingComment: '# Note',
  };

  test('hands what is remembered about the previous file over to the saved file', () => {
    updateFileState('old.md', state);

    expect(takeOverFileState({ previousPath: 'old.md', path: 'new.md' })).toEqual(state);
    expect(fileStates.get('new.md')).toEqual(state);
  });

  test('returns nothing for a new file or a file nothing is remembered about', () => {
    // Remembered about a file deleted since, so a new file doesn’t take it over
    updateFileState('new.md', state);

    expect(takeOverFileState({ path: 'new.md' })).toEqual({});
    expect(fileStates.has('new.md')).toBe(false);

    updateFileState('new.md', state);

    expect(takeOverFileState({ previousPath: 'old.md', path: 'new.md' })).toEqual({});
    expect(fileStates.has('new.md')).toBe(false);
  });
});
