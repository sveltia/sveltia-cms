import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { showAssetOverlay } from '$lib/services/assets/view';
import { cmsConfig } from '$lib/services/config';
import { showContentOverlay } from '$lib/services/contents/editor';

import {
  goBack,
  goto,
  hasOverlay,
  openProductionSite,
  parseLocation,
  redirectLegacyEntryLink,
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
    navigation: {
      currentEntry: null,
      entries: vi.fn(() => []),
      back: vi.fn(),
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
  showAssetOverlay: { current: undefined },
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents/editor', () => ({
  showContentOverlay: { current: undefined },
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

    // Mock window.navigation
    Object.defineProperty(window, 'navigation', {
      value: {
        currentEntry: null,
        entries: vi.fn(() => []),
        back: vi.fn(),
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

    it('should strip a trailing slash from the path', () => {
      expect(parseLocation('https://example.com/#/collections/').path).toEqual('/collections');
      expect(parseLocation('https://example.com/#/assets/-/all/').path).toEqual('/assets/-/all');
      expect(parseLocation('https://example.com/#/collections/?filter=all')).toEqual({
        path: '/collections',
        params: { filter: 'all' },
      });
    });

    it('should keep the root path as is', () => {
      expect(parseLocation('https://example.com/#/').path).toEqual('/');
      expect(parseLocation('https://example.com/#//').path).toEqual('/');
    });

    it('should join duplicate keys with commas', () => {
      const result = parseLocation('https://example.com/#/search?foo=1&foo=2&foo=3');

      expect(result).toEqual({
        path: '/search',
        params: { foo: '1,2,3' },
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

    /**
     * Mock the session history exposed by the Navigation API.
     * @param {number} currentIndex Index of the current entry.
     * @param {string[]} urls URLs of all the entries, in order.
     */
    const mockHistory = (currentIndex, urls) => {
      const entries = urls.map((url, index) => ({ index, url, sameDocument: true }));

      Object.defineProperty(window, 'navigation', {
        value: {
          currentEntry: entries[currentIndex],
          entries: vi.fn(() => entries),
          back: vi.fn(),
        },
        writable: true,
        configurable: true,
      });
    };

    it('should detect forward navigation with the Navigation API', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      // Both paths have the same number of segments, so only the history knows the direction
      const oldURL = 'https://example.com/#/collections/posts';
      const newURL = 'https://example.com/#/collections/pages';

      mockHistory(2, ['https://example.com/#/collections', oldURL, newURL]);

      const event = new HashChangeEvent('hashchange', { oldURL, newURL });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['forwards'],
        update: expect.any(Function),
      });
    });

    it('should detect backward navigation with the Navigation API across sections', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const oldURL = 'https://example.com/#/assets';
      const newURL = 'https://example.com/#/collections/posts';

      mockHistory(0, [newURL, oldURL]);

      const event = new HashChangeEvent('hashchange', { oldURL, newURL });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['backwards'],
        update: expect.any(Function),
      });
    });

    it('should use the history entry closest to the current one', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const oldURL = 'https://example.com/#/collections/posts';
      const newURL = 'https://example.com/#/collections';

      // The old URL appears twice; the one at index 3 is where the user has just been
      mockHistory(2, [oldURL, 'https://example.com/#/assets', newURL, oldURL]);

      const event = new HashChangeEvent('hashchange', { oldURL, newURL });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['backwards'],
        update: expect.any(Function),
      });
    });

    it('should ignore the current history entry when it has the old URL', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const oldURL = 'https://example.com/#/collections/posts';
      const newURL = 'https://example.com/#/collections';

      mockHistory(1, [oldURL, oldURL]);

      const event = new HashChangeEvent('hashchange', { oldURL, newURL });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['forwards'],
        update: expect.any(Function),
      });
    });

    it('should compare paths when the old URL is no longer in the history', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const oldURL = 'https://example.com/#/collections';
      const newURL = 'https://example.com/#/collections/posts';

      // The old entry has been replaced, e.g. with `goto(path, { replaceState: true })`
      mockHistory(0, [newURL]);

      const event = new HashChangeEvent('hashchange', { oldURL, newURL });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['forwards'],
        update: expect.any(Function),
      });
    });

    it('should compare paths when the current entry is not in the history', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      const oldURL = 'https://example.com/#/collections/posts';
      const newURL = 'https://example.com/#/collections';

      Object.defineProperty(window, 'navigation', {
        value: {
          currentEntry: { index: -1, url: newURL },
          entries: vi.fn(() => []),
          back: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const event = new HashChangeEvent('hashchange', { oldURL, newURL });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['backwards'],
        update: expect.any(Function),
      });
    });

    it('should compare paths when the Navigation API is unavailable', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      // Simulate a browser without the Navigation API
      Object.defineProperty(window, 'navigation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/collections',
        newURL: 'https://example.com/#/collections/posts',
      });

      Object.defineProperty(event, 'isTrusted', { value: true });

      updateContentFromHashChange(event, updateContent, /^\/collections/);

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['forwards'],
        update: expect.any(Function),
      });
    });

    it('should treat navigation between paths of the same depth as unknown', () => {
      const updateContent = vi.fn();
      const mockStartViewTransition = vi.fn();

      document.startViewTransition = mockStartViewTransition;

      // Simulate a browser without the Navigation API
      Object.defineProperty(window, 'navigation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const event = new HashChangeEvent('hashchange', {
        oldURL: 'https://example.com/#/collections/posts',
        newURL: 'https://example.com/#/collections/pages',
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

  describe('redirectLegacyEntryLink', () => {
    it('should redirect a Netlify/Decap CMS shorthand link to the entry route', () => {
      window.location.href = 'https://example.com/#/edit/posts/hello';
      window.location.hash = '#/edit/posts/hello';

      expect(redirectLegacyEntryLink()).toBe(true);

      // The shorthand is replaced rather than pushed, so it doesn’t sit in the history
      expect(window.history.replaceState).toHaveBeenCalledWith(
        { from: 'https://example.com/#/edit/posts/hello' },
        '',
        'https://example.com/#/collections/posts/entries/hello',
      );
    });

    it('should redirect a link to a file collection entry', () => {
      window.location.href = 'https://example.com/#/edit/settings/general';
      window.location.hash = '#/edit/settings/general';

      expect(redirectLegacyEntryLink()).toBe(true);

      expect(window.history.replaceState).toHaveBeenCalledWith(
        expect.any(Object),
        '',
        'https://example.com/#/collections/settings/entries/general',
      );
    });

    it('should keep a sub path containing slashes', () => {
      window.location.href = 'https://example.com/#/edit/posts/2026/hello';
      window.location.hash = '#/edit/posts/2026/hello';

      expect(redirectLegacyEntryLink()).toBe(true);

      expect(window.history.replaceState).toHaveBeenCalledWith(
        expect.any(Object),
        '',
        'https://example.com/#/collections/posts/entries/2026/hello',
      );
    });

    it('should carry the query string over', () => {
      window.location.href = 'https://example.com/#/edit/posts/hello?_locale=fr';
      window.location.hash = '#/edit/posts/hello?_locale=fr';

      expect(redirectLegacyEntryLink()).toBe(true);

      expect(window.history.replaceState).toHaveBeenCalledWith(
        expect.any(Object),
        '',
        'https://example.com/#/collections/posts/entries/hello?_locale=fr',
      );
    });

    it('should leave any other route alone', () => {
      [
        'https://example.com/#/collections/posts/entries/hello',
        'https://example.com/#/collections',
        'https://example.com/#/edit',
        // A collection name with nothing after it doesn’t address an entry
        'https://example.com/#/edit/posts',
        'https://example.com/#/edit/posts/',
      ].forEach((href) => {
        const [, hash] = href.split('#');

        window.location.href = href;
        window.location.hash = hash;

        expect(redirectLegacyEntryLink()).toBe(false);
      });

      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('goBack', () => {
    it('should use window.navigation.back() when the previous entry matches the fallback path', () => {
      const mockNavigationBack = vi.fn();
      const mockStartViewTransition = vi.fn();

      Object.defineProperty(window, 'navigation', {
        value: {
          currentEntry: { index: 1 },
          entries: vi.fn(() => [{ sameDocument: true, url: 'https://example.com/#/default' }]),
          back: mockNavigationBack,
        },
        writable: true,
        configurable: true,
      });

      document.startViewTransition = mockStartViewTransition;

      goBack('/default');

      expect(mockStartViewTransition).toHaveBeenCalledWith({
        types: ['backwards'],
        update: expect.any(Function),
      });

      const callArgs = /** @type {any} */ (mockStartViewTransition).mock.calls[0]?.[1];

      if (callArgs) {
        callArgs();
      }

      expect(mockNavigationBack).toHaveBeenCalled();
    });

    it('should fall back to goto when the previous navigation entry does not match the target path', () => {
      Object.defineProperty(window, 'navigation', {
        value: {
          currentEntry: { index: 1 },
          entries: vi.fn(() => [{ sameDocument: true, url: 'https://example.com/#/collections' }]),
          back: vi.fn(),
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

    it('should fall back to goto when the previous navigation entry is missing', () => {
      Object.defineProperty(window, 'navigation', {
        value: {
          currentEntry: { index: 1 },
          entries: vi.fn(() => []),
          back: vi.fn(),
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
      cmsConfig.current = /** @type {any} */ ({
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
      cmsConfig.current = /** @type {any} */ ({
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
      cmsConfig.current = /** @type {any} */ ({});

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

      const mockTransition = { ready: Promise.resolve(), finished: Promise.resolve() };

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
      const mockTransition = { ready: Promise.resolve(), finished: Promise.resolve() };
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
      const mockTransition = { ready: Promise.resolve(), finished: Promise.resolve() };

      // @ts-ignore - Simplified mock for testing
      document.startViewTransition = vi.fn((config) => {
        config.update();

        return mockTransition;
      });

      startViewTransition('backwards', mockUpdateContent);

      await mockTransition.finished;

      expect(document.startViewTransition).toHaveBeenCalledWith(
        expect.objectContaining({ types: ['backwards'] }),
      );
      expect(mockUpdateContent).toHaveBeenCalled();
    });

    it('should handle unknown transition type', async () => {
      const mockUpdateContent = vi.fn();
      const mockTransition = { ready: Promise.resolve(), finished: Promise.resolve() };

      // @ts-ignore - Simplified mock for testing
      document.startViewTransition = vi.fn((config) => {
        config.update();

        return mockTransition;
      });

      startViewTransition('unknown', mockUpdateContent);

      await mockTransition.finished;

      expect(document.startViewTransition).toHaveBeenCalledWith(
        expect.objectContaining({ types: ['unknown'] }),
      );
      expect(mockUpdateContent).toHaveBeenCalled();
    });

    it('should observe a rejected ready promise when the transition is skipped', async () => {
      const mockUpdateContent = vi.fn();
      const unhandled = vi.fn();

      // A skipped transition still runs `update` and still resolves `finished`; only `ready` is
      // rejected, which is what reaches the console when nothing observes it
      const mockTransition = {
        ready: Promise.reject(new DOMException('Transition was aborted', 'InvalidStateError')),
        finished: Promise.resolve(),
      };

      process.on('unhandledRejection', unhandled);
      document.startViewTransition = vi.fn().mockReturnValue(mockTransition);

      startViewTransition('forwards', mockUpdateContent);

      // Give the rejection a chance to go unhandled
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      process.off('unhandledRejection', unhandled);

      expect(unhandled).not.toHaveBeenCalled();
    });

    it('should report and observe a rejected finished promise', async () => {
      const mockUpdateContent = vi.fn();
      const unhandled = vi.fn();
      const error = new Error('update failed');
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const mockTransition = {
        ready: Promise.resolve(),
        finished: Promise.reject(error),
      };

      process.on('unhandledRejection', unhandled);
      document.startViewTransition = vi.fn().mockReturnValue(mockTransition);

      startViewTransition('forwards', mockUpdateContent);

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      process.off('unhandledRejection', unhandled);

      expect(consoleError).toHaveBeenCalledWith(error);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('should start a new transition once a skipped one has settled', async () => {
      const mockUpdateContent = vi.fn();

      const skipped = {
        ready: Promise.reject(new DOMException('Transition was aborted', 'InvalidStateError')),
        finished: Promise.resolve(),
      };

      const startViewTransitionMock = vi.fn().mockReturnValue(skipped);

      document.startViewTransition = startViewTransitionMock;

      startViewTransition('forwards', mockUpdateContent);

      // Wait for `finished` to settle, which releases the guard against nested transitions
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      startViewTransitionMock.mockReturnValue({
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      });

      startViewTransition('backwards', mockUpdateContent);

      expect(startViewTransitionMock).toHaveBeenCalledTimes(2);
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

  describe('hasOverlay derived state', () => {
    it('should be true if either overlay is shown', () => {
      showContentOverlay.current = false;
      showAssetOverlay.current = false;
      expect(hasOverlay.current).toBe(false);

      showContentOverlay.current = true;
      expect(hasOverlay.current).toBe(true);

      showContentOverlay.current = false;
      showAssetOverlay.current = true;
      expect(hasOverlay.current).toBe(true);

      showContentOverlay.current = true;
      expect(hasOverlay.current).toBe(true);
    });
  });

  describe('goBack with history.back()', () => {
    it('should call window.history.back when history state has from property', async () => {
      const mockHistoryBack = vi.fn();
      const mockTransition = { ready: Promise.resolve(), finished: Promise.resolve() };

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
