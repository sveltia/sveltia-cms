import { highlightCodeToHTML } from '@sveltia/ui';
import { parse } from 'marked';
import { describe, expect, test, vi } from 'vitest';

import { addMarkedExtensions, renderCode } from './marked';

vi.mock('@sveltia/ui', () => ({ highlightCodeToHTML: vi.fn() }));

describe('renderCode()', () => {
  test('returns the highlighted HTML', () => {
    vi.mocked(highlightCodeToHTML).mockReturnValue('<pre class="shiki">x</pre>');

    expect(renderCode(/** @type {any} */ ({ text: 'x', lang: 'js' }))).toBe(
      '<pre class="shiki">x</pre>',
    );
    expect(highlightCodeToHTML).toHaveBeenCalledWith('x', 'js');
  });

  test('falls back to the default renderer until the grammar is loaded', () => {
    vi.mocked(highlightCodeToHTML).mockReturnValue(undefined);

    expect(renderCode(/** @type {any} */ ({ text: 'x', lang: 'js' }))).toBe(false);
  });

  test('falls back to the default renderer without a language', () => {
    expect(renderCode(/** @type {any} */ ({ text: 'x', lang: '' }))).toBe(false);
    expect(renderCode(/** @type {any} */ ({ text: 'x' }))).toBe(false);
    expect(highlightCodeToHTML).not.toHaveBeenCalled();
  });
});

describe('addMarkedExtensions()', () => {
  test('adds the extensions to the shared instance only once', () => {
    addMarkedExtensions();
    addMarkedExtensions();
    addMarkedExtensions();

    vi.mocked(highlightCodeToHTML).mockReturnValue(undefined);

    expect(parse('Hello')).toBe('<p dir="auto">Hello</p>\n');
    expect(parse('```js\nconst a = 1;\n```')).toBe(
      '<pre><code class="language-js">const a = 1;\n</code></pre>\n',
    );
    // Not once per call
    expect(highlightCodeToHTML).toHaveBeenCalledOnce();
  });
});
