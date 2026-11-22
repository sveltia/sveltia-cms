import { describe, expect, test } from 'vitest';

import { getBotCoAuthor, getCommitAuthorName } from '$lib/services/utils/commit-author';

describe('getCommitAuthorName()', () => {
  test('prefers the name, then the login, then the email', () => {
    expect(getCommitAuthorName({ name: 'Name', login: 'login', email: 'a@b.c' })).toBe('Name');
    expect(getCommitAuthorName({ name: '', login: 'login', email: 'a@b.c' })).toBe('login');
    expect(getCommitAuthorName({ email: 'a@b.c' })).toBe('a@b.c');
  });

  test('returns an empty value without an author or a name', () => {
    expect(getCommitAuthorName(undefined)).toBeUndefined();
    expect(getCommitAuthorName({ name: '', email: '' })).toBe('');
  });
});

describe('getBotCoAuthor()', () => {
  const bot = { name: 'my-app[bot]' };

  test('gives the person an app committed for, credited in a trailer', () => {
    expect(
      getBotCoAuthor(
        bot,
        'Signed-off-by: Ada <ada@example.com>\nCo-authored-by: Ada Lovelace <ada@example.com>',
      ),
    ).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' });
    // The first one, whatever its case and spacing
    expect(
      getBotCoAuthor(bot, 'co-authored-by:Ada <a@x.org>\r\nCo-authored-by: Bea <b@x.org>'),
    ).toEqual({ name: 'Ada', email: 'a@x.org' });
  });

  test('leaves a person’s own commit and a bot’s commit without a co-author alone', () => {
    expect(getBotCoAuthor({ name: 'Ada' }, 'Co-authored-by: Bea <b@x.org>')).toBeUndefined();
    expect(getBotCoAuthor(bot, 'Update Post')).toBeUndefined();
    expect(getBotCoAuthor(bot, null)).toBeUndefined();
    expect(getBotCoAuthor(null, 'Co-authored-by: Bea <b@x.org>')).toBeUndefined();
    // Only a trailer at the start of a line counts
    expect(getBotCoAuthor(bot, 'Not a Co-authored-by: Bea <b@x.org>')).toBeUndefined();
  });
});
