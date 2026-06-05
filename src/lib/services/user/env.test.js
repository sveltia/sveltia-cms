import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Create a mock MediaQueryList object.
 * @param {boolean} matches Initial matches value.
 * @returns {object} Mock MediaQueryList.
 */
const createMockMediaQueryList = (matches = false) => ({
  matches,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

describe('env service', () => {
  /** @type {any} */
  let env;
  /** @type {any} */
  let initUserEnvDetection;
  /** @type {any} */
  let mockMediaQueries;

  beforeEach(async () => {
    vi.resetModules();

    mockMediaQueries = {
      small: createMockMediaQueryList(false),
      medium: createMockMediaQueryList(false),
      large: createMockMediaQueryList(true),
      pointer: createMockMediaQueryList(true),
    };

    vi.stubGlobal(
      'matchMedia',
      vi.fn((query) => {
        if (query === '(width < 768px)') return mockMediaQueries.small;
        if (query === '(768px <= width < 1024px)') return mockMediaQueries.medium;
        if (query === '(1024px <= width)') return mockMediaQueries.large;
        if (query === '(pointer: fine)') return mockMediaQueries.pointer;

        return createMockMediaQueryList();
      }),
    );

    vi.stubGlobal('location', { hostname: 'localhost' });

    vi.stubGlobal('navigator', {
      userAgentData: { brands: [], platform: '' },
      platform: '',
    });

    ({ env, initUserEnvDetection } = await import('./env.svelte.js'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('should export env with correct default values', () => {
      expect(env.isLocalHost).toBe(false);
      expect(env.isLocalBackendSupported).toBe(false);
      expect(env.isBrave).toBe(false);
      expect(env.isMacOS).toBe(false);
      expect(env.isSmallScreen).toBe(false);
      expect(env.isMediumScreen).toBe(false);
      expect(env.isLargeScreen).toBe(false);
      expect(env.hasMouse).toBe(true);
    });
  });

  describe('initUserEnvDetection', () => {
    it('should detect localhost hostname and set isLocalHost', () => {
      globalThis.location.hostname = 'localhost';

      initUserEnvDetection();

      expect(env.isLocalHost).toBe(true);
    });

    it('should detect 127.0.0.1 and set isLocalHost', () => {
      vi.stubGlobal('location', { hostname: '127.0.0.1' });

      initUserEnvDetection();

      expect(env.isLocalHost).toBe(true);
    });

    it('should detect subdomain localhost and set isLocalHost', () => {
      vi.stubGlobal('location', { hostname: 'example.localhost' });

      initUserEnvDetection();

      expect(env.isLocalHost).toBe(true);
    });

    it('should not set isLocalHost for remote hostnames', () => {
      vi.stubGlobal('location', { hostname: 'example.com' });

      initUserEnvDetection();

      expect(env.isLocalHost).toBe(false);
    });

    it('should detect showDirectoryPicker support and set isLocalBackendSupported', () => {
      vi.stubGlobal('showDirectoryPicker', vi.fn());

      initUserEnvDetection();

      expect(env.isLocalBackendSupported).toBe(true);
    });

    it('should set isLocalBackendSupported to false when showDirectoryPicker is not available', () => {
      // @ts-expect-error - intentionally deleting global property for testing
      delete globalThis.showDirectoryPicker;

      initUserEnvDetection();

      expect(env.isLocalBackendSupported).toBe(false);
    });

    it('should detect Brave browser and set isBrave', () => {
      vi.stubGlobal('navigator', {
        userAgentData: { platform: 'macOS', brands: [{ brand: 'Chromium' }, { brand: 'Brave' }] },
        platform: '',
      });

      initUserEnvDetection();

      expect(env.isBrave).toBe(true);
    });

    it('should set isBrave to false for non-Brave browsers', () => {
      vi.stubGlobal('navigator', {
        userAgentData: { platform: 'Linux', brands: [{ brand: 'Chrome' }] },
        platform: 'Linux x86_64',
      });

      initUserEnvDetection();

      expect(env.isBrave).toBe(false);
    });

    it('should handle missing userAgentData gracefully', () => {
      vi.stubGlobal('navigator', { userAgentData: undefined, platform: '' });

      initUserEnvDetection();

      expect(env.isBrave).toBe(false);
    });

    it('should detect macOS from userAgentData.platform', () => {
      vi.stubGlobal('navigator', {
        userAgentData: { platform: 'macOS', brands: [] },
        platform: 'Linux',
      });

      initUserEnvDetection();

      expect(env.isMacOS).toBe(true);
    });

    it('should detect macOS from navigator.platform', () => {
      vi.stubGlobal('navigator', { userAgentData: undefined, platform: 'MacIntel' });

      initUserEnvDetection();

      expect(env.isMacOS).toBe(true);
    });

    it('should detect MacPPC from navigator.platform', () => {
      vi.stubGlobal('navigator', { userAgentData: undefined, platform: 'MacPPC' });

      initUserEnvDetection();

      expect(env.isMacOS).toBe(true);
    });

    it('should set isMacOS to false for non-macOS platforms', () => {
      vi.stubGlobal('navigator', {
        userAgentData: { platform: 'Linux', brands: [] },
        platform: 'Linux x86_64',
      });

      initUserEnvDetection();

      expect(env.isMacOS).toBe(false);
    });

    it('should set isMacOS to false when both platform sources are unavailable', () => {
      vi.stubGlobal('navigator', { userAgentData: undefined, platform: '' });

      initUserEnvDetection();

      expect(env.isMacOS).toBe(false);
    });

    it('should set up media query listeners and initial values', () => {
      initUserEnvDetection();

      expect(globalThis.matchMedia).toHaveBeenCalledWith('(width < 768px)');
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(768px <= width < 1024px)');
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(1024px <= width)');
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(pointer: fine)');

      expect(env.isSmallScreen).toBe(false);
      expect(env.isMediumScreen).toBe(false);
      expect(env.isLargeScreen).toBe(true);
      expect(env.hasMouse).toBe(true);

      expect(mockMediaQueries.small.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(mockMediaQueries.medium.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(mockMediaQueries.large.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(mockMediaQueries.pointer.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should handle media query changes', () => {
      initUserEnvDetection();

      const [, smallChangeHandler] = mockMediaQueries.small.addEventListener.mock.calls[0];
      const [, mediumChangeHandler] = mockMediaQueries.medium.addEventListener.mock.calls[0];
      const [, largeChangeHandler] = mockMediaQueries.large.addEventListener.mock.calls[0];
      const [, pointerChangeHandler] = mockMediaQueries.pointer.addEventListener.mock.calls[0];

      mockMediaQueries.small.matches = true;
      smallChangeHandler();
      expect(env.isSmallScreen).toBe(true);

      mockMediaQueries.medium.matches = true;
      mediumChangeHandler();
      expect(env.isMediumScreen).toBe(true);

      mockMediaQueries.large.matches = false;
      largeChangeHandler();
      expect(env.isLargeScreen).toBe(false);

      mockMediaQueries.pointer.matches = false;
      pointerChangeHandler();
      expect(env.hasMouse).toBe(false);
    });

    it('should work with different initial media query states', () => {
      mockMediaQueries.small.matches = true;
      mockMediaQueries.medium.matches = false;
      mockMediaQueries.large.matches = false;
      mockMediaQueries.pointer.matches = false;

      initUserEnvDetection();

      expect(env.isSmallScreen).toBe(true);
      expect(env.isMediumScreen).toBe(false);
      expect(env.isLargeScreen).toBe(false);
      expect(env.hasMouse).toBe(false);
    });
  });
});
