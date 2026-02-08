import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockWritable = vi.fn();

const mockStores = {
  isLocalHost: { set: vi.fn() },
  isLocalBackendSupported: { set: vi.fn() },
  isBrave: { set: vi.fn() },
  isMacOS: { set: vi.fn() },
  isSmallScreen: { set: vi.fn() },
  isMediumScreen: { set: vi.fn() },
  isLargeScreen: { set: vi.fn() },
  hasMouse: { set: vi.fn() },
};

vi.mock('svelte/store', () => ({
  writable: mockWritable,
}));

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
  let envModule;
  /** @type {any} */
  let mockMediaQueries;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up mock stores
    let storeIndex = 0;

    const storeNames = [
      'isLocalHost',
      'isLocalBackendSupported',
      'isBrave',
      'isMacOS',
      'isSmallScreen',
      'isMediumScreen',
      'isLargeScreen',
      'hasMouse',
    ];

    mockWritable.mockImplementation(() => {
      const storeName = storeNames[storeIndex];

      storeIndex += 1;

      return mockStores[/** @type {keyof typeof mockStores} */ (storeName)];
    });

    // Set up mock media queries
    mockMediaQueries = {
      small: createMockMediaQueryList(false),
      medium: createMockMediaQueryList(false),
      large: createMockMediaQueryList(true),
      pointer: createMockMediaQueryList(true),
    };

    // Mock globalThis.matchMedia
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

    // Mock location.hostname
    Object.defineProperty(globalThis, 'location', {
      value: {
        hostname: 'localhost',
      },
      writable: true,
    });

    // Mock navigator.userAgentData
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgentData: {
          brands: [],
        },
        platform: '',
      },
      writable: true,
    });

    // Mock showDirectoryPicker
    vi.stubGlobal('window', {
      showDirectoryPicker: undefined,
    });

    // Import the module after mocks are set up
    envModule = await import('./env.js');
  });

  describe('store creation', () => {
    it('should create all environment detection stores', () => {
      expect(mockWritable).toHaveBeenCalledTimes(8);
      expect(mockWritable).toHaveBeenNthCalledWith(1, false); // isLocalHost
      expect(mockWritable).toHaveBeenNthCalledWith(2, false); // isLocalBackendSupported
      expect(mockWritable).toHaveBeenNthCalledWith(3, false); // isBrave
      expect(mockWritable).toHaveBeenNthCalledWith(4, false); // isMacOS
      expect(mockWritable).toHaveBeenNthCalledWith(5, false); // isSmallScreen
      expect(mockWritable).toHaveBeenNthCalledWith(6, false); // isMediumScreen
      expect(mockWritable).toHaveBeenNthCalledWith(7, false); // isLargeScreen
      expect(mockWritable).toHaveBeenNthCalledWith(8, true); // hasMouse

      expect(envModule.isLocalHost).toBe(mockStores.isLocalHost);
      expect(envModule.isLocalBackendSupported).toBe(mockStores.isLocalBackendSupported);
      expect(envModule.isBrave).toBe(mockStores.isBrave);
      expect(envModule.isMacOS).toBe(mockStores.isMacOS);
      expect(envModule.isSmallScreen).toBe(mockStores.isSmallScreen);
      expect(envModule.isMediumScreen).toBe(mockStores.isMediumScreen);
      expect(envModule.isLargeScreen).toBe(mockStores.isLargeScreen);
      expect(envModule.hasMouse).toBe(mockStores.hasMouse);
    });
  });

  describe('initUserEnvDetection', () => {
    it('should detect localhost hostname and set isLocalHost', () => {
      globalThis.location.hostname = 'localhost';

      envModule.initUserEnvDetection();

      expect(mockStores.isLocalHost.set).toHaveBeenCalledWith(true);
    });

    it('should detect 127.0.0.1 and set isLocalHost', () => {
      globalThis.location.hostname = '127.0.0.1';

      envModule.initUserEnvDetection();

      expect(mockStores.isLocalHost.set).toHaveBeenCalledWith(true);
    });

    it('should detect subdomain localhost and set isLocalHost', () => {
      globalThis.location.hostname = 'example.localhost';

      envModule.initUserEnvDetection();

      expect(mockStores.isLocalHost.set).toHaveBeenCalledWith(true);
    });

    it('should not set isLocalHost for remote hostnames', () => {
      vi.clearAllMocks();
      globalThis.location.hostname = 'example.com';

      envModule.initUserEnvDetection();

      expect(mockStores.isLocalHost.set).toHaveBeenCalledWith(false);
    });

    it('should detect showDirectoryPicker support and set isLocalBackendSupported', () => {
      vi.stubGlobal('window', { showDirectoryPicker: vi.fn() });

      envModule.initUserEnvDetection();

      expect(mockStores.isLocalBackendSupported.set).toHaveBeenCalledWith(true);
    });

    it('should set isLocalBackendSupported to false when showDirectoryPicker is not available', () => {
      vi.clearAllMocks();
      vi.stubGlobal('window', {});

      envModule.initUserEnvDetection();

      expect(mockStores.isLocalBackendSupported.set).toHaveBeenCalledWith(false);
    });

    it('should detect Brave browser and set isBrave', () => {
      globalThis.navigator.userAgentData = {
        platform: 'macOS',
        brands: [{ brand: 'Chromium' }, { brand: 'Brave' }],
      };

      envModule.initUserEnvDetection();

      expect(mockStores.isBrave.set).toHaveBeenCalledWith(true);
    });

    it('should set isBrave to false for non-Brave browsers', () => {
      vi.clearAllMocks();
      globalThis.navigator.userAgentData = {
        platform: 'Linux',
        brands: [{ brand: 'Chrome' }],
      };

      envModule.initUserEnvDetection();

      expect(mockStores.isBrave.set).toHaveBeenCalledWith(false);
    });

    it('should handle missing userAgentData gracefully', () => {
      vi.clearAllMocks();
      globalThis.navigator.userAgentData = undefined;

      envModule.initUserEnvDetection();

      expect(mockStores.isBrave.set).toHaveBeenCalledWith(false);
    });

    it('should detect macOS from userAgentData.platform', () => {
      vi.clearAllMocks();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgentData: {
            platform: 'macOS',
            brands: [],
          },
          platform: 'Linux',
        },
        writable: true,
      });

      envModule.initUserEnvDetection();

      expect(mockStores.isMacOS.set).toHaveBeenCalledWith(true);
    });

    it('should detect macOS from navigator.platform', () => {
      vi.clearAllMocks();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgentData: undefined,
          platform: 'MacIntel',
        },
        writable: true,
      });

      envModule.initUserEnvDetection();

      expect(mockStores.isMacOS.set).toHaveBeenCalledWith(true);
    });

    it('should detect MacPPC from navigator.platform', () => {
      vi.clearAllMocks();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgentData: undefined,
          platform: 'MacPPC',
        },
        writable: true,
      });

      envModule.initUserEnvDetection();

      expect(mockStores.isMacOS.set).toHaveBeenCalledWith(true);
    });

    it('should set isMacOS to false for non-macOS platforms', () => {
      vi.clearAllMocks();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgentData: {
            platform: 'Linux',
            brands: [],
          },
          platform: 'Linux x86_64',
        },
        writable: true,
      });

      envModule.initUserEnvDetection();

      expect(mockStores.isMacOS.set).toHaveBeenCalledWith(false);
    });

    it('should set isMacOS to false when both platform sources are unavailable', () => {
      vi.clearAllMocks();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgentData: undefined,
          platform: '',
        },
        writable: true,
      });

      envModule.initUserEnvDetection();

      expect(mockStores.isMacOS.set).toHaveBeenCalledWith(false);
    });

    it('should set up media query listeners and initial values', () => {
      envModule.initUserEnvDetection();

      // Check that matchMedia was called with correct queries
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(width < 768px)');
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(768px <= width < 1024px)');
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(1024px <= width)');
      expect(globalThis.matchMedia).toHaveBeenCalledWith('(pointer: fine)');

      // Check that initial values are set based on media query matches
      expect(mockStores.isSmallScreen.set).toHaveBeenCalledWith(false);
      expect(mockStores.isMediumScreen.set).toHaveBeenCalledWith(false);
      expect(mockStores.isLargeScreen.set).toHaveBeenCalledWith(true);
      expect(mockStores.hasMouse.set).toHaveBeenCalledWith(true);

      // Check that event listeners are added
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
      envModule.initUserEnvDetection();

      // Get the change handlers
      const [, smallChangeHandler] = mockMediaQueries.small.addEventListener.mock.calls[0];
      const [, mediumChangeHandler] = mockMediaQueries.medium.addEventListener.mock.calls[0];
      const [, largeChangeHandler] = mockMediaQueries.large.addEventListener.mock.calls[0];
      const [, pointerChangeHandler] = mockMediaQueries.pointer.addEventListener.mock.calls[0];

      // Reset store calls to test change handlers
      vi.clearAllMocks();

      // Simulate media query changes
      mockMediaQueries.small.matches = true;
      smallChangeHandler();

      mockMediaQueries.medium.matches = true;
      mediumChangeHandler();

      mockMediaQueries.large.matches = false;
      largeChangeHandler();

      mockMediaQueries.pointer.matches = false;
      pointerChangeHandler();

      // Check that stores are updated with new values
      expect(mockStores.isSmallScreen.set).toHaveBeenCalledWith(true);
      expect(mockStores.isMediumScreen.set).toHaveBeenCalledWith(true);
      expect(mockStores.isLargeScreen.set).toHaveBeenCalledWith(false);
      expect(mockStores.hasMouse.set).toHaveBeenCalledWith(false);
    });

    it('should work with different initial media query states', () => {
      // Update mock media queries for small screen
      mockMediaQueries.small.matches = true;
      mockMediaQueries.medium.matches = false;
      mockMediaQueries.large.matches = false;
      mockMediaQueries.pointer.matches = false;

      envModule.initUserEnvDetection();

      expect(mockStores.isSmallScreen.set).toHaveBeenCalledWith(true);
      expect(mockStores.isMediumScreen.set).toHaveBeenCalledWith(false);
      expect(mockStores.isLargeScreen.set).toHaveBeenCalledWith(false);
      expect(mockStores.hasMouse.set).toHaveBeenCalledWith(false);
    });
  });
});
