import { sanitize } from 'isomorphic-dompurify';
import { marked } from 'marked';
import { describe, expect, test, vi } from 'vitest';

import { renderCommentBody } from '$lib/services/additions/comment-body';

vi.mock('isomorphic-dompurify', async (importOriginal) => {
  const original = /** @type {typeof import('isomorphic-dompurify')} */ (await importOriginal());

  return { ...original, sanitize: vi.fn(original.sanitize) };
});

describe('renderCommentBody', () => {
  test('renders GitHub-flavoured Markdown, with line breaks kept', () => {
    expect(renderCommentBody('**Bold** and _em_\nnext line')).toBe(
      '<p><strong>Bold</strong> and <em>em</em><br>next line</p>\n',
    );
    expect(renderCommentBody('- [x] Done')).toContain(
      '<input checked="" disabled="" type="checkbox">',
    );
  });

  test('opens links in a new tab', () => {
    expect(renderCommentBody('[Preview](https://preview.example)')).toBe(
      '<p><a href="https://preview.example" target="_blank" rel="noopener noreferrer">Preview</a></p>\n',
    );
  });

  test('drops anything that could run script or change the page', () => {
    const html = renderCommentBody(
      '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>' +
        '<style>body{}</style><form><button>Go</button></form><iframe src="https://x"></iframe>',
    );

    expect(html).not.toMatch(/script|onerror|javascript:|style|form|button|iframe|img/);
  });

  test('shows a remote image as a link, so it isn’t loaded for everyone who reads the comment', () => {
    expect(
      renderCommentBody('![Chart](https://tracker.example/p.gif) ![](https://x.example/a.png)'),
    ).toBe(
      '<p><a href="https://tracker.example/p.gif" target="_blank" rel="noopener noreferrer">Chart</a>' +
        ' <a href="https://x.example/a.png" target="_blank" rel="noopener noreferrer">' +
        'https://x.example/a.png</a></p>\n',
    );
  });

  test('keeps an image in a data URL, and drops one with a relative URL', () => {
    const dataURL = 'data:image/png;base64,iVBORw0KGgo=';

    expect(renderCommentBody(`![a](${dataURL}) ![b](chart.png)<img alt="c">`)).toBe(
      `<p><img src="${dataURL}" alt="a"> </p>\n`,
    );
  });

  test('keeps only a task list item’s check box, disabled', () => {
    const html = renderCommentBody(
      '- [x] Done\n\n<input type="image" src="https://tracker.example/p.gif"><input type="text">',
    );

    expect(html).toContain('<input checked="" disabled="" type="checkbox">');
    expect(html).not.toMatch(/tracker|type="image"|type="text"/);
  });

  test('ignores the extensions a site adds to the shared Markdown parser', () => {
    marked.use({
      async: true,
      renderer: {
        /**
         * Render bold text differently from the default.
         * @returns {string} HTML.
         */
        strong: () => '<em>changed</em>',
      },
    });

    expect(renderCommentBody('**bold**')).toBe('<p><strong>bold</strong></p>\n');
  });

  test('renders the same Markdown once, keeping the most recently used results', () => {
    const first = renderCommentBody('Cached **once**');

    vi.mocked(sanitize).mockClear();
    expect(renderCommentBody('Cached **once**')).toBe(first);
    expect(sanitize).not.toHaveBeenCalled();

    // Fill the cache, using the first one along the way so it stays
    [...Array(250).keys()].forEach((index) => {
      renderCommentBody(`Comment ${index}`);

      if (index % 50 === 0) {
        renderCommentBody('Cached **once**');
      }
    });
    vi.mocked(sanitize).mockClear();
    renderCommentBody('Cached **once**');
    expect(sanitize).not.toHaveBeenCalled();

    // The least recently used one has been dropped
    renderCommentBody('Comment 0');
    expect(sanitize).toHaveBeenCalledOnce();
  });
});
