import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import {
  appLogoType,
  appLogoURL,
  appTitle,
  DEFAULT_APP_LOGO_URL,
  DEFAULT_APP_TITLE,
} from './branding.js';

// Mock the cmsConfig store
vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    subscribe: vi.fn(),
  },
}));

// Mock the mime library
vi.mock('mime', () => ({
  default: {
    getType: vi.fn((url) => {
      if (url.endsWith('.png')) return 'image/png';
      if (url.endsWith('.svg')) return 'image/svg+xml';
      if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
      if (url.endsWith('.webp')) return 'image/webp';
      return null;
    }),
  },
}));

describe('branding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('exports DEFAULT_APP_TITLE', () => {
      expect(DEFAULT_APP_TITLE).toBe('Sveltia CMS');
    });

    it('exports DEFAULT_APP_LOGO_URL as a data URL', () => {
      expect(DEFAULT_APP_LOGO_URL).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('DEFAULT_APP_LOGO_URL contains valid base64 content', () => {
      const base64Part = DEFAULT_APP_LOGO_URL.split(',')[1];

      expect(() => {
        atob(base64Part);
      }).not.toThrow();
    });
  });

  describe('appTitle derived store', () => {
    it('returns DEFAULT_APP_TITLE when config is null', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        callback(undefined);
        return vi.fn();
      });

      let value;

      const unsubscribe = appTitle.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_TITLE);
      unsubscribe();
    });

    it('returns DEFAULT_APP_TITLE when app_title is not set', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({});
        return vi.fn();
      });

      let value;

      const unsubscribe = appTitle.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_TITLE);
      unsubscribe();
    });

    it('returns custom app_title from config', () => {
      const customTitle = 'My Custom CMS';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: customTitle });
        return vi.fn();
      });

      let value;

      const unsubscribe = appTitle.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(customTitle);
      unsubscribe();
    });
  });

  describe('appLogoURL derived store', () => {
    it('returns DEFAULT_APP_LOGO_URL when config is null', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        callback(undefined);
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_LOGO_URL);
      unsubscribe();
    });

    it('returns logo.src from config when available', () => {
      const logoURL = 'https://example.com/logo.png';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: logoURL } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(logoURL);
      unsubscribe();
    });

    it('returns deprecated logo_url when logo.src is not available', () => {
      const logoURL = 'https://example.com/legacy-logo.svg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo_url: logoURL });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(logoURL);
      unsubscribe();
    });

    it('prefers logo.src over deprecated logo_url', () => {
      const newLogoURL = 'https://example.com/new-logo.png';
      const oldLogoURL = 'https://example.com/old-logo.svg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: newLogoURL }, logo_url: oldLogoURL });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(newLogoURL);
      unsubscribe();
    });

    it('returns DEFAULT_APP_LOGO_URL when no logo is configured', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ app_title: 'Some CMS' });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoURL.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(DEFAULT_APP_LOGO_URL);
      unsubscribe();
    });
  });

  describe('appLogoType derived store', () => {
    it('extracts MIME type from data URL', () => {
      const dataURL = 'data:image/png;base64,iVBORw0KG';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: dataURL } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/png');
      unsubscribe();
    });

    it('extracts SVG MIME type from data URL', () => {
      const dataURL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: dataURL } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/svg+xml');
      unsubscribe();
    });

    it('detects MIME type from file extension for PNG', () => {
      const url = 'https://example.com/logo.png';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/png');
      unsubscribe();
    });

    it('detects MIME type from file extension for SVG', () => {
      const url = 'https://example.com/logo.svg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/svg+xml');
      unsubscribe();
    });

    it('detects MIME type from file extension for JPEG', () => {
      const url = 'https://example.com/logo.jpg';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/jpeg');
      unsubscribe();
    });

    it('returns undefined for unknown file type', () => {
      const url = 'https://example.com/logo.unknown';

      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        // @ts-expect-error - test mocking
        callback({ logo: { src: url } });
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBeUndefined();
      unsubscribe();
    });

    it('returns image/svg+xml when using DEFAULT_APP_LOGO_URL', () => {
      vi.mocked(cmsConfig.subscribe).mockImplementation((callback) => {
        callback(undefined);
        return vi.fn();
      });

      let value;

      const unsubscribe = appLogoType.subscribe((v) => {
        value = v;
      });

      expect(value).toBe('image/svg+xml');
      unsubscribe();
    });
  });
});
