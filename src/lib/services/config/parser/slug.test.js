import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseSlugConfig } from '$lib/services/config/parser/slug';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/**
 * Run the check with the given `slug` options.
 * @param {any} [slug] The `slug` option value.
 * @returns {void}
 */
const check = (slug) => parseSlugConfig(/** @type {any} */ ({ slug }), collectors);

/**
 * Assert that the replacement was reported as unsafe.
 * @param {string} replacement Replacement the message names.
 */
const expectReported = (replacement) => {
  expect(addMessage).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      strKey: 'invalid_sanitize_replacement',
      values: { replacement },
      collectors,
    }),
  );
};

describe('parseSlugConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing without slug options', () => {
    check();
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('says nothing without a replacement', () => {
    check({ encoding: 'ascii' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts the usual replacements', () => {
    check({ sanitize_replacement: '-' });
    check({ sanitize_replacement: '_' });
    check({ sanitize_replacement: '~' });
    check({ sanitize_replacement: '--' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts an empty replacement, which joins the words together', () => {
    check({ sanitize_replacement: '' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('leaves a replacement of the wrong type to the schema', () => {
    check({ sanitize_replacement: 1 });
    check({ sanitize_replacement: null });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a space, which the slug is meant to be rid of', () => {
    check({ sanitize_replacement: ' ' });
    expectReported(' ');
  });

  test('reports a slash, which would turn the slug into a path', () => {
    check({ sanitize_replacement: '/' });
    expectReported('/');
  });

  test('reports a replacement that is only partly unsafe', () => {
    check({ sanitize_replacement: '-!-' });
    expectReported('-!-');
  });

  test('accepts a non-ASCII replacement with the default encoding', () => {
    check({ sanitize_replacement: '・' });
    check({ encoding: 'unicode', sanitize_replacement: 'ー' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a non-ASCII replacement with the ascii encoding', () => {
    check({ encoding: 'ascii', sanitize_replacement: '・' });
    expectReported('・');
  });

  test('reports a control character', () => {
    check({ sanitize_replacement: '\t' });
    expectReported('\t');
  });
});
