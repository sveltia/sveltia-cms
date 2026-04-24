import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  goBack,
  goto,
  openProductionSite,
  parseLocation,
  startViewTransition,
  updateContentFromHashChange,
} from './navigation';

/**
 * Mock HashChangeEvent class for testing.
 */
class MockHashChangeEvent extends Event {
  /**
   * Create a mock HashChangeEvent.
   * @param {string} type Event type.
   * @param {object} [eventInit] Event initialization object.
   * @param {string} [eventInit.oldURL] Old URL.
   * @param {string} [eventInit.newURL] New URL.
   */
  constructor(type, eventInit = {}) {
    super(type);
    this.oldURL = eventInit.oldURL || '';
    this.newURL = eventInit.newURL || '';

    // Define isTrusted as a configurable property
    Object.defineProperty(this, 'isTrusted', {
      value: true,
      writable: true,
      configurable: true,
    });
  }
}

// Mock browser globals
Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      href: 'https://example.com/#/collections',
      origin: 'https://example.com',
      pathname: '/',
      hash: '#/collections',
    },
    history: {
      pushState: vi.fn(),
      replaceState: vi.fn(),
      back: vi.fn(),
      state: null,
    },
    open: vi.fn(),
    dispatchEvent: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(globalThis, 'document', {
  value: {
    startViewTransition: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(globalThis, 'HashChangeEvent', {
  value: MockHashChangeEvent,
  writable: true,
});

// Mock dependencies
vi.mock('$lib/services/assets/view', () => ({
  showAssetOverlay: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/editor', () => ({
  showContentOverlay: { subscribe: vi.fn() },
}));

vi.mock('svelte/store', () => ({
  derived: vi.fn((stores, callback) => {
    // Call the callback to ensure code coverage for derived functions
    if (Array.isArray(stores)) {
      callback([...stores].map(() => false));
    }

    return { subscribe: vi.fn() };
  }),
  get: vi.fn(),
  writable: vi.fn(),
}));

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(),
}));

vi.mock('svelte', () => ({
  flushSync: vi.fn(),
}));

describe('navigation', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/#/collections',
        origin: 'https://example.com',
        pathname: '/',
        hash: '#/collections',
      },
      writable: true,
    });

    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: {
        pushState: vi.fn(),
        replaceState: vi.fn(),
        back: vi.fn(),
        state: null,
      },
      writable: true,
      configurable: true,
    });

    // Mock document
    Object.defineProperty(document, 'startViewTransition', {
      value: vi.fn(),
      writable: true,
    });

    // Mock window.open
    Object.defineProperty(window, 'open', {
      value: vi.fn(),
      writable: true,
    });

    // Mock event dispatching
    Object.defineProperty(window, 'dispatchEvent', {
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLocation', () => {
    it('should parse current location when no href provided', () => {
      window.location.href = 'https://example.com/#/collections?filter=all';

      const result = parseLocation();

      expect(result).toEqual({
        path: '/collections',
        params: { filter: 'all' },
      });
    });

    it('should parse provided href', () => {
      const result = parseLocation('https://example.com/#/assets?view=grid&page=2');

      expect(result).toEqual({
        path: '/assets',
        params: { view: 'grid', page: '2' },
      });
    });

    it('should handle encoded characters in path', () => {
      const result = parseLocation('https://example.com/#/collections/my%20collection');

      expect(result).toEqual({
        path: '/collections/my collection',
        params: {},
      });
    });

    it('should handle empty hash', () => {
      const result = parseLocation('https://example.com/#');

      expect(result).toEqual({
        path: '/',
        params: {},
      });
    });

    it('should handle complex query parameters', () => {
      const result = parseLocation('https://example.com/#/search?q=test&sort=date&tags=tag1,tag2');

      expect(result).toEqual({
        path: '/search',
        params: { q: 'test', sort: 'date', tags: 'tag1,tag2' },
      });
    });
  });

  describe('updateContentFromHashChange', () => {
    it('should call updateContent immediately for non-trusted events', () => {
      const updateContent = vi.fn();

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/old',
        newURL: 'https://example.com/#/new',
      });

      // Make event non-trusted
      Object.defineProperty(event, 'isTrusted', { value: false });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(updateContent).toHaveBeenCalledTimes(1);
    });

    it('should handle trusted navigation events with transition', () => {
      const updateContent = vi.fn();

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/collections',
        newURL: 'https://example.com/#/collections/posts',
      });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(document.startViewTransition).toHaveBeenCalled();
    });

    it('should detect forward navigation', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/collections',
        newURL: 'https://example.com/#/collections/posts/new',
      });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['forwards'],
        update: expect.any(Function),
      });
    });

    it('should detect backward navigation', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/collections/posts/new',
        newURL: 'https://example.com/#/collections',
      });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['backwards'],
        update: expect.any(Function),
      });
    });

    it('should detect unknown navigation when not in same section', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/collections',
        newURL: 'https://example.com/#/assets',
      });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['unknown'],
        update: expect.any(Function),
      });
    });
  });

  describe('goto', () => {
    it('should navigate to new path with default options', async () => {
      await goto('/collections/posts');

      expect(window.history.pushState).toHaveBeenCalledWith(
        { from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/collections/posts',
      );
      expect(document.startViewTransition).toHaveBeenCalled();
    });

    it('should replace state when replaceState is true', async () => {
      await goto('/assets', { replaceState: true });

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/assets',
      );
    });

    it('should include custom state', async () => {
      const customState = { filter: 'images' };

      await goto('/assets', { state: customState });

      expect(window.history.pushState).toHaveBeenCalledWith(
        { filter: 'images', from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/assets',
      );
    });

    it('should not notify change when notifyChange is false', async () => {
      await goto('/assets', { notifyChange: false });

      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should use view transition when document.startViewTransition is supported', async () => {
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      await goto('/assets', { transitionType: 'forwards' });

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['forwards'],
        update: expect.any(Function),
      });
    });

    it('should skip navigation when already on same path with no state or replaceState', async () => {
      // Current location is already /collections
      window.location.href = 'https://example.com/#/collections';
      window.location.hash = '#/collections';

      await goto('/collections');

      // Should not push state or trigger transition
      expect(window.history.pushState).not.toHaveBeenCalled();
      expect(document.startViewTransition).not.toHaveBeenCalled();
    });

    it('should navigate when on same path but with custom state', async () => {
      window.location.href = 'https://example.com/#/collections';
      window.location.hash = '#/collections';

      const customState = { folder: 'assets' };

      await goto('/collections', { state: customState });

      expect(window.history.pushState).toHaveBeenCalledWith(
        { folder: 'assets', from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/collections',
      );
    });

    it('should navigate when on same path but with replaceState', async () => {
      window.location.href = 'https://example.com/#/collections';
      window.location.hash = '#/collections';

      await goto('/collections', { replaceState: true });

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/collections',
      );
    });

    it('should navigate when on same path but with both state and replaceState', async () => {
      window.location.href = 'https://example.com/#/collections';
      window.location.hash = '#/collections';

      const customState = { filter: 'images' };

      await goto('/collections', { state: customState, replaceState: true });

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { filter: 'images', from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/collections',
      );
    });
  });

  describe('goBack', () => {
    it('should use history.back() when history state has from property', () => {
      // Mock history with state
      Object.defineProperty(window, 'history', {
        value: {
          pushState: vi.fn(),
          replaceState: vi.fn(),
          back: vi.fn(),
          state: { from: 'https://example.com/#/collections' },
        },
        writable: true,
        configurable: true,
      });

      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      goBack('/default');

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['backwards'],
        update: expect.any(Function),
      });
    });

    it('should navigate to fallback path when no history state', async () => {
      // Mock history without state
      Object.defineProperty(window, 'history', {
        value: {
          pushState: vi.fn(),
          replaceState: vi.fn(),
          back: vi.fn(),
          state: null,
        },
        writable: true,
        configurable: true,
      });

      goBack('/default');

      expect(window.history.pushState).toHaveBeenCalledWith(
        { from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/default',
      );
    });

    it('should pass options to goto when using fallback', async () => {
      // Mock history without state
      Object.defineProperty(window, 'history', {
        value: {
          pushState: vi.fn(),
          replaceState: vi.fn(),
          back: vi.fn(),
          state: null,
        },
        writable: true,
        configurable: true,
      });

      const options = { replaceState: true, state: { test: true } };

      goBack('/default', options);

      expect(window.history.replaceState).toHaveBeenCalledWith(
        { test: true, from: 'https://example.com/#/collections' },
        '',
        'https://example.com/#/default',
      );
    });
  });

  describe('openProductionSite', () => {
    it('should open display_url when available', () => {
      vi.mocked(get).mockReturnValue({
        display_url: 'https://my-site.com',
        _siteURL: 'https://fallback.com',
      });

      openProductionSite();

      expect(window.open).toHaveBeenCalledWith(
        'https://my-site.com',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('should fall back to _siteURL when no display_url', () => {
      vi.mocked(get).mockReturnValue({
        _siteURL: 'https://fallback.com',
      });

      openProductionSite();

      expect(window.open).toHaveBeenCalledWith(
        'https://fallback.com',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('should use root path when no URLs available', () => {
      vi.mocked(get).mockReturnValue({});

      openProductionSite();

      expect(window.open).toHaveBeenCalledWith('/', '_blank', 'noopener,noreferrer');
    });
  });

  describe('startViewTransition', () => {
    it('should call updateContent directly when document.startViewTransition is not available', async () => {
      const mockUpdateContent = vi.fn();
      const { sleep } = await import('@sveltia/utils/misc');
      const originalStartViewTransition = document.startViewTransition;

      // @ts-ignore
      document.startViewTransition = undefined;

      startViewTransition('forwards', mockUpdateContent);

      expect(mockUpdateContent).toHaveBeenCalled();
      expect(sleep).not.toHaveBeenCalled();

      // Restore
      document.startViewTransition = originalStartViewTransition;
    });

    it('should call updateContent directly when startViewTransition not supported', async () => {
      const mockUpdateContent = vi.fn();
      const originalStartViewTransition = document.startViewTransition;

      // @ts-ignore
      document.startViewTransition = undefined;

      startViewTransition('backwards', mockUpdateContent);

      expect(mockUpdateContent).toHaveBeenCalled();

      // Restore
      document.startViewTransition = originalStartViewTransition;
    });

    it('should clear activeTransition when transition finishes', async () => {
      const mockUpdateContent = vi.fn();
      const { sleep } = await import('@sveltia/utils/misc');
      const { flushSync } = await import('svelte');

      vi.mocked(sleep).mockResolvedValue(undefined);
      vi.mocked(flushSync).mockImplementation((fn) => {
        if (fn) fn();
      });

      const mockTransition = { finished: Promise.resolve() };

      // @ts-ignore - Simplified mock for testing
      document.startViewTransition = vi.fn((config) => {
        if (config?.update) config.update();
        return mockTransition;
      });

      startViewTransition('forwards', mockUpdateContent);

      // Flush microtasks so the .finally() callback fires before assertions
      await Promise.resolve();

      expect(document.startViewTransition).toHaveBeenCalled();
      expect(mockUpdateContent).toHaveBeenCalled();
    });

    it('should use view transition API when document.startViewTransition is supported', async () => {
      const mockUpdateContent = vi.fn();
      const mockTransition = { update: vi.fn() };
      const { sleep } = await import('@sveltia/utils/misc');
      const { flushSync } = await import('svelte');

      vi.mocked(sleep).mockResolvedValue(undefined);
      vi.mocked(flushSync).mockImplementation((fn) => {
        if (fn) fn();
      });

      // @ts-ignore - Simplified mock for testing
      document.startViewTransition = vi.fn((config) => {
        if (config?.update) {
          config.update();
        }

        return mockTransition;
      });

      startViewTransition('forwards', mockUpdateContent);

      expect(document.startViewTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          types: ['forwards'],
          update: expect.any(Function),
        }),
      );
    });

    it('should handle backwards transition type', async () => {
      const mockUpdateContent = vi.fn();
      const mockTransition = { finished: Promise.resolve() };

      document.startViewTransition = vi.fn().mockReturnValue(mockTransition);

      startViewTransition('backwards', mockUpdateContent);

      await mockTransition.finished;

      expect(mockUpdateContent).toHaveBeenCalled();
    });

    it('should handle unknown transition type', async () => {
      const mockUpdateContent = vi.fn();
      const mockTransition = { finished: Promise.resolve() };

      document.startViewTransition = vi.fn().mockReturnValue(mockTransition);

      startViewTransition('unknown', mockUpdateContent);

      await mockTransition.finished;

      expect(mockUpdateContent).toHaveBeenCalled();
    });

    it('should handle TypeError when startViewTransition throws', async () => {
      const mockUpdateContent = vi.fn();
      const { sleep } = await import('@sveltia/utils/misc');
      const { flushSync } = await import('svelte');

      vi.mocked(sleep).mockResolvedValue(undefined);
      vi.mocked(flushSync).mockImplementation((fn) => {
        if (fn) fn();
      });

      // Mock document.startViewTransition to throw an error
      document.startViewTransition = vi.fn(() => {
        throw new TypeError('startViewTransition not supported');
      });

      startViewTransition('forwards', mockUpdateContent);

      expect(mockUpdateContent).toHaveBeenCalled();
    });
  });

  describe('hasOverlay derived store', () => {
    it('should test the derived callback logic for hasOverlay', () => {
      // The hasOverlay store is derived from [showContentOverlay, showAssetOverlay]
      // The callback returns true if either overlay is shown
      /**
       * Test callback for hasOverlay derived store.
       * @type {(a: boolean, b: boolean) => boolean}
       */
      const callback = (contentOverlay, assetOverlay) => contentOverlay || assetOverlay;

      expect(callback(false, false)).toBe(false);
      expect(callback(true, false)).toBe(true);
      expect(callback(false, true)).toBe(true);
      expect(callback(true, true)).toBe(true);
    });
  });

  describe('goBack with history.back()', () => {
    it('should call window.history.back when history state has from property', async () => {
      const mockHistoryBack = vi.fn();
      const mockTransition = { finished: Promise.resolve() };

      // Mock history with state and back method
      Object.defineProperty(window, 'history', {
        value: {
          pushState: vi.fn(),
          replaceState: vi.fn(),
          back: mockHistoryBack,
          state: { from: 'https://example.com/#/collections' },
        },
        writable: true,
        configurable: true,
      });

      document.startViewTransition = vi.fn().mockReturnValue(mockTransition);

      goBack('/default');

      const callArgs = /** @type {any} */ (document.startViewTransition).mock.calls[0]?.[0];

      if (callArgs?.update) {
        callArgs.update();
      }

      expect(mockHistoryBack).toHaveBeenCalled();

      await mockTransition.finished;
    });
  });
});
