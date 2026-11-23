import { afterEach, describe, expect, test } from 'vitest';

import {
  getLeadingComment,
  prependLeadingComment,
  rememberLeadingComment,
} from '$lib/services/contents/file/leading-comments';
import { fileStates } from '$lib/services/contents/file/state';

afterEach(() => {
  fileStates.clear();
});

describe('Test getLeadingComment()', () => {
  test('returns `undefined` for a document not starting with a comment', () => {
    expect(getLeadingComment('title: Hello\n# Not at the top')).toBeUndefined();
    expect(getLeadingComment('')).toBeUndefined();
  });

  test('returns the comments above a blank line', () => {
    expect(getLeadingComment('# Oh hai!\n# Never mind these.\n\nsome:\n  thing: test')).toBe(
      '# Oh hai!\n# Never mind these.',
    );
  });

  test('ignores whitespace before the comments', () => {
    expect(getLeadingComment('\n  # Note\n\ntitle = "Hello"')).toBe('# Note');
  });

  test('keeps the blank lines between the comments', () => {
    expect(getLeadingComment('# One\n\n\n#Two\n\ntitle: Hello')).toBe('# One\n\n\n#Two');
  });

  test('leaves out the comments right above the first line of data', () => {
    expect(getLeadingComment('# File note\n\n# Title\ntitle: Hello')).toBe('# File note');
    expect(getLeadingComment('# Title\ntitle: Hello')).toBeUndefined();
  });

  test('stops at the first line of data, including a document marker', () => {
    expect(getLeadingComment('# Note\n---\n\ntitle: Hello')).toBeUndefined();
    expect(getLeadingComment('# Note\n\n[section]\n\n# Not at the top\nkey = 1')).toBe('# Note');
  });

  test('returns all the comments of a document holding nothing else', () => {
    expect(getLeadingComment('# Only\n\n# comments\n')).toBe('# Only\n\n# comments');
  });
});

describe('Test rememberLeadingComment()', () => {
  test('remembers the comments of a file and forgets them once they’re gone', () => {
    rememberLeadingComment('data.yml', '# Note\n\ntitle: Hello');
    expect(fileStates.get('data.yml')?.leadingComment).toBe('# Note');

    rememberLeadingComment('data.yml', 'title: Hello');
    expect(fileStates.get('data.yml')?.leadingComment).toBeUndefined();
  });
});

describe('Test prependLeadingComment()', () => {
  test('adds the comments followed by a blank line', () => {
    expect(prependLeadingComment('title: Hello', '# Note')).toBe('# Note\n\ntitle: Hello');
  });

  test('returns the comments alone for an empty document', () => {
    expect(prependLeadingComment('', '# Note')).toBe('# Note');
  });

  test('returns the document as is without comments', () => {
    expect(prependLeadingComment('title: Hello')).toBe('title: Hello');
  });
});
