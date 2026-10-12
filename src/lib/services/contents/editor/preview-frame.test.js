import { describe, expect, test } from 'vitest';

import { buildPreviewFrameHTML } from '$lib/services/contents/editor/preview-frame';

describe('buildPreviewFrameHTML()', () => {
  test('sets the language, direction, base URL and stylesheets', () => {
    const html = buildPreviewFrameHTML({
      lang: 'ar',
      dir: 'rtl',
      styleURLs: ['/a.css', '/b.css?x="1"'],
      origin: 'https://example.com',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('<base href="https://example.com" target="_blank">');
    expect(html).toContain(
      '<link rel="stylesheet" href="/a.css">\n<link rel="stylesheet" href="/b.css?x=&quot;1&quot;">',
    );
    expect(html).toContain('<body></body>');
  });

  test('leaves out the language and direction when not given', () => {
    const html = buildPreviewFrameHTML({ styleURLs: [], origin: 'http://localhost' });

    expect(html).toContain('<html>');
    expect(html).not.toContain('<link');
  });
});
