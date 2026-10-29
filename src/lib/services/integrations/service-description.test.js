import { describe, expect, it, vi } from 'vitest';

import {
  getAuthKeyLabel,
  getServiceDescription,
} from '$lib/services/integrations/service-description';

/**
 * Localization strings for the credential labels.
 * @type {Record<string, string>}
 */
const strings = {
  'cloud_storage.auth.api_key.key_label': 'API Key',
  'cloud_storage.s3.auth_key_label': 'Secret Access Key',
  'cloud_storage.bunny_storage.auth_key_label': 'Storage Zone Password',
};

// Look up the credential labels, and mimic a description string that wraps the interpolated values
// in bidi isolates
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values, default: defaultValue } = {}) =>
    values
      ? `${key}: \u2068${values.service}\u2069 <a \u2068${values.homeHref}\u2069>site</a> ` +
        `<a \u2068${values.apiKeyHref}\u2069 onclick="x()">key</a><img src="x">`
      : (strings[key] ?? defaultValue ?? key),
  ),
}));

describe('getAuthKeyLabel', () => {
  it('should use the service’s own label', () => {
    expect(
      getAuthKeyLabel({ serviceId: 'bunny_storage', compatibleAPI: 's3', authType: 'api_key' }),
    ).toBe('Storage Zone Password');
  });

  it('should fall back to the label shared by the services with the same API', () => {
    expect(getAuthKeyLabel({ serviceId: 'aws_s3', compatibleAPI: 's3', authType: 'api_key' })).toBe(
      'Secret Access Key',
    );
  });

  it('should fall back to the default label for the authentication type', () => {
    expect(getAuthKeyLabel({ serviceId: 'example', authType: 'api_key' })).toBe('API Key');
  });
});

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
