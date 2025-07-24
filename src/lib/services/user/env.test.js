import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockWritable = vi.fn();

const mockStores = {
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
    const storeNames = ['isSmallScreen', 'isMediumScreen', 'isLargeScreen', 'hasMouse'];

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

    // Import the module after mocks are set up
    envModule = await import('./env.js');
  });

  describe('store creation', () => {
    it('should create all environment detection stores', () => {
      expect(mockWritable).toHaveBeenCalledTimes(4);
      expect(mockWritable).toHaveBeenNthCalledWith(1, false);
      expect(mockWritable).toHaveBeenNthCalledWith(2, false);
      expect(mockWritable).toHaveBeenNthCalledWith(3, false);
      expect(mockWritable).toHaveBeenNthCalledWith(4, true);

      expect(envModule.isSmallScreen).toBe(mockStores.isSmallScreen);
      expect(envModule.isMediumScreen).toBe(mockStores.isMediumScreen);
      expect(envModule.isLargeScreen).toBe(mockStores.isLargeScreen);
      expect(envModule.hasMouse).toBe(mockStores.hasMouse);
    });
  });

  describe('initUserEnvDetection', () => {
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
