import { describe, expect, it, vi } from 'vitest';

import { getServiceDescription } from '$lib/services/integrations/service-description';

// Mimic a localization string that wraps the interpolated values in bidi isolates
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(
    (key, { values }) =>
      `${key}: \u2068${values.service}\u2069 <a \u2068${values.homeHref}\u2069>site</a> ` +
      `<a \u2068${values.apiKeyHref}\u2069 onclick="x()">key</a><img src="x">`,
  ),
}));

describe('getServiceDescription', () => {
  it('should add links, remove bidi isolates and sanitize the result', () => {
    expect(
      getServiceDescription('prefs.test.description', {
        service: 'Example',
        developerURL: 'https://example.com/',
        apiKeyURL: 'https://example.com/keys',
      }),
    ).toBe(
      'prefs.test.description: Example <a href="https://example.com/">site</a> ' +
        '<a href="https://example.com/keys">key</a>',
    );
  });
});
